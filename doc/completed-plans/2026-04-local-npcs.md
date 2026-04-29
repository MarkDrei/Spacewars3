# Development Plan: Player-Local NPCs

## Vision

As a player, I see up to 4 "Iron Horde Pirate" NPC ships circling my nearest starbase so the world feels alive. NPCs are local to each player (other players don't see mine), scale with my level, and can be attacked using the existing battle system. Defeated NPCs respawn at midnight with newly randomised stats.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (NPC users upserted lazily on first attack)
- **Testing**: Vitest
- **Module System**: ES Modules exclusively

## Goals

### Goal 1: Server-Side NPC Definition & Orbital Movement

**Description**: Define NPC state per player and compute circular patrol positions around the starbase.

#### Task 1.1: NPC data model & ID scheme

**Status**: ✅ COMPLETED
**Implementation Summary**: Created NPC type definitions, constants with ID scheme utilities, and NPCManager singleton with per-player NPC generation, orbital movement, midnight respawn, level refresh, defeat/battle tracking. Also migrated STARBASE_ID_OFFSET to 2B and added 'npc_ship' to shared SpaceObject type union.
**Files Modified/Created**:
- `src/lib/server/npc/npcTypes.ts` — NpcShip interface definition
- `src/lib/server/npc/npcConstants.ts` — Constants (offsets, orbit params) and utility functions (npcUserId, isNpcId, parseNpcId)
- `src/lib/server/npc/NPCManager.ts` — Singleton with getNpcsForPlayer, updateNpcPositions, markDefeated, setInBattle, getNpcById, positionForAngle
- `src/shared/starbases.ts` — Changed STARBASE_ID_OFFSET from 9000 to 2_000_000_000
- `src/shared/src/types/gameTypes.ts` — Added 'npc_ship' to SpaceObject.type union, added orbitAngleDeg and angularVelocityDegPerSec optional fields
- `src/app/api/world/route.ts` — Inject per-player NPCs into world response (Task 1.3 combined)
- `src/__tests__/unit/npc/NPCManager.test.ts` — 46 unit tests covering all NPC logic
- `src/__tests__/unit/api/world-api.test.ts` — Updated to mock UserCache and use STARBASE_ID_OFFSET constant
- `src/__tests__/unit/lib/Starbase.test.ts` — Updated to use STARBASE_ID_OFFSET constant
- `src/__tests__/unit/lib/Game-starbase-callback.test.ts` — Updated to use STARBASE_ID_OFFSET constant
**Deviations from Plan**: Tasks 1.1–1.5 and 1.3 were implemented together as a single cohesive unit since the NPCManager naturally contains all of this logic (generation, position update, midnight respawn, level refresh, defeat/battle flags). This avoids artificial separation of tightly coupled code.
**Arc42 Updates**: None required (no new architectural layer — follows existing singleton pattern)
**Test Results**: ✅ All 1633 tests passing across 151 files, no linting errors, build succeeds

**Action**: Create an NPC type and an `NPCManager` singleton (globalThis-based, like other caches) that holds per-player NPC state in memory. No DB persistence for orbit state — NPCs are regenerated on server start. The explicit numeric ID scheme is shared between the in-memory space-object entry and the lazily-created users-table row.

**Files**:

- `src/lib/server/npc/npcTypes.ts` — types: `NpcShip { id, ownerId, npcIndex, level, orbitAngleDeg, defeated, defeatTime, npcUserCreated }`
- `src/lib/server/npc/npcConstants.ts` — constants: `NPC_USER_ID_OFFSET = 1_000_000`, `NPC_IDS_PER_USER = 1_000`
- `src/lib/server/npc/NPCManager.ts` — singleton; `getNpcsForPlayer(userId, playerLevel): NpcShip[]`; generate 4 NPCs on first access (levels = playerLevel…playerLevel+3); stores in `Map<userId, NpcShip[]>`

**Design decisions — ID scheme**:

> **NPC user ID formula**: `NPC_USER_ID_OFFSET + ownerId * NPC_IDS_PER_USER + npcIndex`
>
> - ownerId up to 999 999 → max NPC user ID ≈ 1 000 999 999 (< int32 max 2 147 483 647 ✓)
> - Note: slightly above the domain cap of 1 000 000 000 for ownerId near the upper limit, but never overflows PostgreSQL `INTEGER` / int32.
> - The same numeric ID is used for the in-memory space-object entry so the attack API can resolve the NPC without a separate lookup.

**Starbase ID migration (prerequisite)**:

- Current: `STARBASE_ID_OFFSET = 9000` in `src/shared/starbases.ts`
- Change to: `STARBASE_ID_OFFSET = 2_000_000_000`
- Starbases are in-memory only — not stored in the DB columns — so no int32 DB overflow risk. JavaScript clients handle large safe integers fine.
- This frees the entire 9 000 … 999 999 range and makes the distinction between "regular space objects", "NPC objects" (≥ 1 000 000), and "starbases" (≥ 2 000 000 000) unambiguous.

**Orbit constants**:

- Orbit radius: 750 units from starbase centre (4000, 4000).
- Orbit speed: constant angular velocity (e.g. 0.5 deg/s → full circle ≈ 12 min). Clockwise = decreasing angle.
- Position formula: `x = starbaseX + 750 * cos(angleDeg * π/180)`, `y = starbaseY + 750 * sin(angleDeg * π/180)`.
- Each NPC starts at a different quadrant (0°, 90°, 180°, 270°) so they are spread out.
- Direction angle for rendering: tangent to circle, clockwise → `angleDeg − 90`.

#### Task 1.2: NPC position update (speed-multiplier-aware, per-player)

**Action**: Add `updateNpcPositions(nowMs: number)` to `NPCManager`. It advances each NPC's orbit angle based on elapsed time × the current time-multiplier. The method is called from `/api/world` only for the **requesting player's** NPCs — no global tick over all players is needed.

- Angular advance: `Δangle = BASE_ANGULAR_VELOCITY_DEG_PER_SEC × elapsedSec × TimeMultiplierService.getInstance().getMultiplier()`
- Defeated or in-battle NPCs skip position update (speed = 0).

**Files**:

- `src/lib/server/npc/NPCManager.ts` — `updateNpcPositions(userId, nowMs)`
- `src/app/api/world/route.ts` — call `NPCManager.updateNpcPositions(userId, Date.now())` before building world response

#### Task 1.3: Inject NPCs into world API response

**Status**: ✅ COMPLETED (implemented as part of Task 1.1)
**Implementation Summary**: NPCs are injected into world API response per-player. Each player only sees their own NPCs.

**Action**: In the `/api/world` route, after the existing spaceObjects + starbases, append the player's NPC ships as entries with `type: 'npc_ship'`. Player level and userId are already available from UserCache / session.

**Files**:

- `src/app/api/world/route.ts` — append NPC space objects
- `src/lib/server/world/world.ts` (or shared types) — extend `SpaceObject.type` union to include `'npc_ship'`

**Quality Requirements**: NPCs must NOT appear in other players' world responses.

#### Task 1.4: Midnight respawn

**Action**: In `getNpcsForPlayer`, check if any defeated NPC's `defeatTime` is before today's midnight UTC. If so, reset `defeated = false`, re-place on orbit, and reset `npcUserCreated` so stats are re-randomised on the next attack. No cron needed — lazy check on each world poll.

**Files**:

- `src/lib/server/npc/NPCManager.ts` — midnight check inside `getNpcsForPlayer`

#### Task 1.5: Level refresh

**Action**: When `getNpcsForPlayer` is called and the player's level has changed since last generation, regenerate the NPCs (reset levels to playerLevel…playerLevel+3, reset positions, clear defeated status, clear `npcUserCreated`). Store `lastGeneratedAtLevel` per player entry.

**Files**:

- `src/lib/server/npc/NPCManager.ts`

---

### Goal 2: Client-Side Rendering & Smooth Movement

**Description**: Render NPC ships on canvas with smooth interpolated movement, correct facing direction, per-level ship image, and faction name label.

#### Task 2.1: Add `'npc_ship'` to client types and routing

**Status**: ✅ COMPLETED
**Implementation Summary**: Created NPCShipRenderer extending SpaceObjectRendererBase with NPC image loading (npc1-4.png), hostile red fallback triangle, and red name label. Added 'npc_ship' case to SpaceObjectsRenderer dispatch and NPCShipRenderer field.
**Files Modified/Created**:
- `src/lib/client/renderers/NPCShipRenderer.ts` — New renderer with image selection by picture_id, hostile red fallback, and name label
- `src/lib/client/renderers/SpaceObjectsRenderer.ts` — Added NPCShipRenderer import, field, constructor init, and 'npc_ship' case in renderObject
- `src/__tests__/unit/renderers/SpaceObjectsRenderer.test.ts` — Added mock for NPCShipRenderer and dispatch test for npc_ship type
**Deviations from Plan**: Image selection uses picture_id directly (1-4 as set by server's npcIndex+1) rather than computing from level offset, since the server already provides the correct picture_id.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1634 tests passing, no linting errors

**Action**: Extend the client-side `SpaceObject` type. In `SpaceObjectsRenderer`, route `'npc_ship'` to a new `NPCShipRenderer`. The renderer:

- Selects image `npc1.png` … `npc4.png` based on the NPC's level offset (level − playerBaseLevel ∈ 0…3).
- Shows name label: `"Iron Horde Pirate Lv.<level>"`.

**Files**:

- `src/lib/client/renderers/SpaceObjectsRenderer.ts` — add case for `'npc_ship'`
- `src/lib/client/renderers/NPCShipRenderer.ts` — new renderer; image selection by level; name label

#### Task 2.2: Client-side optimistic position interpolation

**Status**: ✅ COMPLETED
**Implementation Summary**: Implemented client-side orbit interpolation in NPCShipRenderer.drawNpcShip that advances the NPC's orbit angle based on elapsed time since server snapshot, computing interpolated x/y coordinates and tangent-to-orbit facing direction before delegating to the base renderer.
**Files Modified/Created**:
- `src/lib/client/renderers/NPCShipRenderer.ts` — Added interpolateOrbitPosition private method called before drawSpaceObject
**Deviations from Plan**: No changes needed in World.ts — orbit metadata (orbitAngleDeg, angularVelocityDegPerSec, last_position_update_ms) flows through SpaceObject naturally.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1634 tests passing, no linting errors

**Action**: Between server polls, extrapolate NPC positions along their circular orbit. The server sends `orbitAngleDeg` and `angularVelocityDegPerSec` as extra fields on NPC space objects. The client uses the server timestamp plus elapsed local time to advance the angle, then derives x/y and facing direction.

**Files**:

- `src/lib/client/renderers/NPCShipRenderer.ts` — compute interpolated position before drawing
- `src/lib/client/game/World.ts` — pass orbit metadata through if needed

**Quality Requirements**: Movement must look smooth (no visible teleporting between polls).

#### Task 2.3: NPC ship images

**Status**: ✅ COMPLETED
**Implementation Summary**: Copied npc1.png as placeholder for npc2.png, npc3.png, and npc4.png so the renderer can load all four NPC ship images.
**Files Modified/Created**:
- `public/assets/images/npc2.png` — copy of npc1.png (placeholder)
- `public/assets/images/npc3.png` — copy of npc1.png (placeholder)
- `public/assets/images/npc4.png` — copy of npc1.png (placeholder)
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All 1634 tests passing, no linting errors

---

### Goal 3: Combat with NPCs — including full user lifetime design

**Description**: Players can attack NPCs using the existing battle system. On attack, an NPC user row is upserted into the users table with deterministic computed stats. This section explicitly covers creation, cache initialisation, defeat, and respawn so every stage of the NPC user's lifetime is defined.

#### Task 3.0: NPC user lifetime overview

The NPC user lifecycle has four stages:

| Stage                  | Trigger                        | DB                                   | UserCache             | UserBonusCache                    | NPCManager flag                                                         |
| ---------------------- | ------------------------------ | ------------------------------------ | --------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| **Creation**           | First attack on NPC            | `UPSERT` by explicit ID              | Inject entry          | Invalidate → recomputed on demand | `npcUserCreated = true`                                                 |
| **Active battle**      | Battle in progress             | `hull_current` etc. updated normally | Normal                | Normal                            | `inBattle = true`                                                       |
| **Player wins**        | Battle resolves, NPC HP = 0    | No change needed                     | No change             | No change                         | `defeated = true`, `defeatTime = now`                                   |
| **Player loses**       | Battle resolves, player HP = 0 | No change needed                     | No change             | No change                         | `defeated = true`, `defeatTime = now` — NPC still disappears from world |
| **Respawn (midnight)** | Lazy check on next world poll  | `UPSERT` new random stats            | Overwrite cache entry | Invalidate                        | `defeated = false`, `npcUserCreated = false`                            |

Key principle: **NPC disappears from the world regardless of battle outcome** (player win OR player loss). It reappears only after midnight.

**No explicit UserCache eviction** is required. The in-memory NPC user entry behaves like any other user (persisted to DB on background flush, reloaded if the server restarts). On respawn the upsert overwrites both DB and cache.

#### Task 3.1: NPC user upsert with randomised stats

**Status**: ✅ COMPLETED
**Implementation Summary**: Implemented `upsertNpcUser` in `npcCombat.ts` with randomised tech counts (defense base 100 with 0.6–1.7 variance, weapon selection by npcIndex), DB upsert via ON CONFLICT DO UPDATE, bonus cache invalidation, UserCache injection via `getUserByIdWithLock`, and temporary space object injection into WorldCache for battle system compatibility. Also implemented `calculateNpcIronReward` and `removeNpcSpaceObject` helpers.
**Files Modified/Created**:
- `src/lib/server/npc/npcCombat.ts` — Created: `upsertNpcUser`, `generateNpcTechCounts`, `calculateNpcIronReward`, `removeNpcSpaceObject`, `injectNpcSpaceObject`
- `src/__tests__/unit/npc/npcCombat.test.ts` — 19 unit tests covering tech count generation and iron reward calculation
**Deviations from Plan**: No `loadUser` method added to UserCache — instead reused existing `getUserByIdWithLock` which loads from DB into cache. Space object injection into WorldCache was added (not in original plan) to make battle system's `getShipPosition` work for NPCs. `npcUserCreated` flag is set inside `upsertNpcUser` directly instead of in NPCManager.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1653 tests passing, no linting errors

#### Task 3.2: Wire NPC attack into attack API

**Status**: ✅ COMPLETED
**Implementation Summary**: Modified attack route to detect NPC targets via `isNpcId`, validate NPC state (not defeated, not in battle), upsert NPC user, mark NPC as in-battle, and skip level restriction check for NPCs. Rest of battle flow works normally since NPC is now a full user in cache with a space object.
**Files Modified/Created**:
- `src/app/api/attack/route.ts` — Added NPC detection branch with validation, upsert, and level-check skip
**Deviations from Plan**: No changes needed to `npcConstants.ts` (already exported `isNpcId`). Recent victims check works naturally since NPC IDs are unique per player.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1653 tests passing, no linting errors

#### Task 3.3: NPC defeat handling — player wins OR loses

**Status**: ✅ COMPLETED
**Implementation Summary**: Modified `resolveBattle` in battleService.ts to handle NPC participants: NPC loser → award fixed iron reward to player (no loser-to-winner transfer); NPC winner → skip iron transfer entirely; skip teleportation when loser is NPC; mark NPC as defeated and remove space object from WorldCache; skip messages and statistics events for NPC participants.
**Files Modified/Created**:
- `src/lib/server/battle/battleService.ts` — Added NPC-aware iron handling, teleport skip, defeat marking, space object cleanup, message/stats filtering
**Deviations from Plan**: Iron reward logic placed directly in resolveBattle rather than separate npcCombat function (simpler, avoids extra indirection). Statistics events also filtered for NPCs.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1653 tests passing, no linting errors

#### Task 3.4: Midnight respawn stats reset

**Action**: When NPCManager resets a defeated NPC (midnight check in Task 1.4), also call `upsertNpcUser(npc)` to re-randomise stats in DB and cache for the next battle. This ensures respawned NPCs are not trivially predictable.

**Files**:

- `src/lib/server/npc/NPCManager.ts` — call `upsertNpcUser` inside midnight-reset branch (only if `npcUserCreated` is true, i.e. a row exists to overwrite)
- `src/lib/server/npc/npcCombat.ts` — `upsertNpcUser` is already idempotent

#### Task 3.5: NPC stops orbiting during battle

**Status**: ✅ COMPLETED
**Implementation Summary**: Already implemented in Task 1.1 (NPCManager.updateNpcPositions skips NPCs with inBattle=true). Task 3.2 sets inBattle=true via NPCManager.setInBattle when attack starts; Task 3.3 clears it via setInBattle(false) then markDefeated when battle ends.
**Files Modified/Created**: No additional files — logic wired through Tasks 3.2 and 3.3
**Deviations from Plan**: None — inBattle flag and setInBattle helper already existed from Task 1.1
**Arc42 Updates**: None required
**Test Results**: ✅ All 1653 tests passing, no linting errors

---

### Goal 4: Testing

**Description**: Cover NPC business logic with unit tests.

#### Task 4.1: NPCManager unit tests

**Action**: Test NPC generation, orbital position calculation (including time-multiplier scaling), midnight respawn logic, level refresh, and `markDefeated` / `setInBattle`.

**Files**:

- `src/__tests__/unit/npc/NPCManager.test.ts`

#### Task 4.2: NPC combat unit tests

**Action**: Test `upsertNpcUser` stat generation: correct random-variance bounds (0.6–1.7), weapon selection by level offset (1–4 types), defense values computed via TechService path. Test defeat handling for both win and loss cases.

**Files**:

- `src/__tests__/unit/npc/npcCombat.test.ts`

#### Task 4.3: Integration test — attack NPC flow

**Action**: Test the full flow: player attacks NPC → NPC user upserted → battle starts → battle resolves → NPC marked defeated (regardless of outcome).

**Files**:

- `src/__tests__/integration/npcBattle.test.ts`

---

## Dependencies

- No new npm packages required. All functionality builds on existing systems.

## Arc42 Documentation Updates

**Proposed Changes**:

- Update `doc/architecture/arc42-architecture.md` Building Blocks section to add NPCManager as a new server-side component and document the NPC user lifetime states.
- Document the ID namespace partitioning (space objects, NPC users ≥ 1M, starbases ≥ 2B).

## Architecture Notes

- **NPCManager** follows the same globalThis singleton + lazy init pattern as UserCache, WorldCache, etc.
- NPC orbit state is **not** stored in DB — ephemeral, regenerated on server start.
- NPC users (for combat) **are** stored in the `users` table with explicit computed IDs; created lazily on first attack via upsert.
- `SERIAL PRIMARY KEY` in PostgreSQL is int32 (max 2 147 483 647). Max NPC user ID ≈ 1 001 000 000 — safely within int32.
- Starbases move to `STARBASE_ID_OFFSET = 2_000_000_000` (pure in-memory; no DB int32 concern).
- Defense values for NPCs flow through `TechService.calculateMaxDefense` + `UserBonusCache`, identical to real players. No parallel calculation path.
- Weapons: level offset 0 → 1 type; +1 → 2 types; +2 → 3 types; +3 → 4 types. Selected randomly per NPC instantiation.
- Random variance per tech count: `uniform(0.6, 1.7)` → significant spread making each NPC unique.
- NPC disappears from world on defeat regardless of who won — same behaviour for player win and player loss.
- No new lock level needed — NPCManager uses same USER_LOCK / WORLD_LOCK conventions as other caches.

## Agent Decisions

1. **In-memory NPCs, no DB table**: NPCs are stateless patrols — no benefit from DB persistence. Consistent with starbase pattern.
2. **Lazy NPC user upsert**: Only upsert to DB when combat starts. Avoids pre-creating user rows for players who never fight.
3. **Upsert (not insert-or-ignore)**: Using `ON CONFLICT DO UPDATE` means midnight respawn naturally re-randomises stats with a single statement.
4. **NPC user ID = NPC space-object ID**: Same numeric value used in both in-memory world response and users table. Simplifies lookup at attack time — no separate mapping needed.
5. **Starbase IDs → 2 000 000 000**: Keeps the three namespaces (DB space objects, NPC users, starbases) non-overlapping and easy to reason about. No DB concern since starbases are never stored.
6. **Circular interpolation on client**: Orbit parameters sent by server; client computes smooth positions. Bandwidth-efficient, jitter-free.
7. **Midnight respawn via lazy check**: No background timer — checked on next world poll. Consistent with polling architecture.
8. **Defeated regardless of outcome**: Ensures NPCs cannot be farmed indefinitely by deliberately losing battles.

## Resolved Questions

1. **x5 scaling per level**: Confirmed — keep x5 as specified.
2. **Rewards**: Iron reward = `5000 × 5^(level−1)`. L1=5k, L2=25k, L3=125k, L4=625k. Standard XP/score on top.
3. **NPCs fight back**: Yes — NPC weapons fire normally via the battle system.
4. **Which starbase**: Hardcode single starbase (4000, 4000) for now.
5. **Faction & naming**: Faction = "Iron Horde". Label = `"Iron Horde Pirate Lv.<level>"`.
6. **Ship images**: `npc1.png` for level +0, `npc2.png` for +1, `npc3.png` for +2, `npc4.png` for +3. Images npc2/3/4 are placeholder copies of npc1 until artwork is created.
7. **Both win and loss = defeated**: Decided — NPC disappears either way, respawns at midnight with new random stats.
