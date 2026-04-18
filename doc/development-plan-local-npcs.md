# Development Plan: Player-Local NPCs

## Vision

As a player, I see up to 4 NPC ships circling my nearest starbase so the world feels alive. NPCs are local to each player (other players don't see mine), scale with my level, and can be attacked using the existing battle system. Defeated NPCs respawn at midnight.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL (NPC users created lazily on first attack)
- **Testing**: Vitest
- **Module System**: ES Modules exclusively

## Goals

### Goal 1: Server-Side NPC Definition & Orbital Movement

**Description**: Define NPC state per player and compute circular patrol positions around the starbase.

#### Task 1.1: NPC data model

**Action**: Create an NPC type and an `NPCManager` singleton (globalThis-based, like other caches) that holds per-player NPC state in memory. No DB persistence — NPCs are regenerated on server start and on midnight reset.

**Files**:

- `src/lib/server/npc/npcTypes.ts` — types: `NpcShip { id, ownerId, level, orbitAngleDeg, speed, defeated, defeatTime }`
- `src/lib/server/npc/NPCManager.ts` — singleton; `getNpcsForPlayer(userId, playerLevel): NpcShip[]`; generates 4 NPCs on first access (levels = playerLevel … playerLevel+3); stores in `Map<userId, NpcShip[]>`

**Design decisions**:

- NPC IDs: use offset `NPC_ID_OFFSET = 20_000` + `(userId * 10) + index` to avoid collision with space objects and starbases (9000-range).
- Orbit radius: 750 units from starbase center (4000,4000).
- Orbit speed: constant angular velocity (e.g., 0.5 deg/s → full circle ≈ 12 min). Clockwise = decreasing angle.
- Position formula: `x = starbaseX + 750 * cos(angleDeg * π/180)`, `y = starbaseY + 750 * sin(angleDeg * π/180)`.
- Each NPC starts at a different quadrant (0°, 90°, 180°, 270°) offset so they're spread out.
- Direction (angle field for rendering): tangent to circle, clockwise → `angleDeg - 90` (perpendicular to radius, pointing clockwise).

#### Task 1.2: NPC position update

**Action**: Add a method `updateNpcPositions(nowMs: number)` to `NPCManager` that advances each NPC's orbit angle based on elapsed time since last update. Uses the same delta-time pattern as physics. Integrate into the world API response path (called from `/api/world` route).

**Files**:

- `src/lib/server/npc/NPCManager.ts` — `updateNpcPositions(nowMs)`
- `src/app/api/world/route.ts` — after building world response, call NPCManager to get player-specific NPC objects and append them

#### Task 1.3: Inject NPCs into world API response

**Action**: In the `/api/world` route, after the existing spaceObjects + starbases, append the player's NPC ships as `SpaceObject`-compatible entries with `type: 'npc_ship'`. The player's level is needed — fetch from UserCache.

**Files**:

- `src/app/api/world/route.ts` — append NPC space objects
- `src/lib/server/world/world.ts` — extend `SpaceObject.type` union to include `'npc_ship'`

**Quality Requirements**: NPCs must NOT appear in other players' world responses.

#### Task 1.4: Midnight respawn

**Action**: In `updateNpcPositions`, check if any defeated NPC's defeat time is before today's midnight. If so, reset `defeated = false` and re-place on orbit. No cron needed — lazy check on each world poll.

**Files**:

- `src/lib/server/npc/NPCManager.ts`

#### Task 1.5: Level refresh

**Action**: When `getNpcsForPlayer` is called and the player's level has changed since last generation, regenerate the NPCs (reset levels to playerLevel…playerLevel+3, reset positions, clear defeated status). Store `lastGeneratedAtLevel` per player.

**Files**:

- `src/lib/server/npc/NPCManager.ts`

---

### Goal 2: Client-Side Rendering & Smooth Movement

**Description**: Render NPC ships on canvas with smooth interpolated movement and correct facing direction.

#### Task 2.1: Add `'npc_ship'` to client types and routing

**Action**: Extend the client-side SpaceObject type. In `SpaceObjectsRenderer`, route `'npc_ship'` to a new `NPCShipRenderer`.

**Files**:

- `src/lib/client/renderers/SpaceObjectsRenderer.ts` — add case for `'npc_ship'`
- `src/lib/client/renderers/NPCShipRenderer.ts` — new renderer, extends `SpaceObjectRendererBase`, uses `npc1.png` image. Shows NPC level as name label.

#### Task 2.2: Client-side optimistic position interpolation

**Action**: Between server polls, the client should extrapolate NPC positions along their circular orbit. Since NPCs move on a known circular path at constant angular velocity, the client can compute the expected position at render time.

Approach: The server sends `orbitAngleDeg` and `angularVelocityDegPerSec` as extra fields on NPC space objects. The client uses `last_position_update_ms` plus elapsed time to compute current angle, then derives x/y and facing direction locally.

**Files**:

- `src/lib/client/game/World.ts` — add NPC interpolation logic in a helper, or handle in renderer
- `src/lib/client/renderers/NPCShipRenderer.ts` — compute interpolated position before drawing

**Quality Requirements**: Movement must look smooth (no visible teleporting between polls).

#### Task 2.3: NPC ship image loading

**Action**: Pre-load `npc1.png` in the image loading system used by other renderers. The asset already exists at `/public/assets/images/npc1.png`.

**Files**:

- `src/lib/client/renderers/NPCShipRenderer.ts` — load image in constructor

---

### Goal 3: Combat with NPCs

**Description**: Players can attack NPCs using the existing battle system. On first attack, a pseudo-user is created for the NPC to store battle stats.

#### Task 3.1: NPC user creation on attack

**Action**: When a player attacks an NPC (detected by target ID in NPC range), create a real user row for the NPC if one doesn't exist yet. The NPC user:

- Username: `npc_{ownerId}_{npcIndex}` (unique per player per NPC slot)
- Password: random hash (not loginable)
- Tech tree: all research types set to `level` (the NPC's level)
- Defense stats: hull/armor/shield current & max = `100 * 5^(level-1)` each. Fully repaired.
- Weapons: 10 of one random weapon type × `5^(level-1)`. e.g. level 1 = 10 weapons; level 2 = 50 weapons.
- `ship_id`: create a temporary space_object at the NPC's current orbital position.
- `in_battle`: set to 1

Store the mapping `npcId → npcUserId` in NPCManager so subsequent battle ticks reference the correct user.

**Files**:

- `src/lib/server/npc/npcCombat.ts` — `getOrCreateNpcUser(npc: NpcShip, attackerId: number): User`
- `src/lib/server/npc/NPCManager.ts` — add `npcUserIds: Map<npcId, userId>`

#### Task 3.2: Wire NPC attack into attack API

**Action**: In `/api/attack/route.ts`, detect if target is an NPC (ID in NPC range). If so, call `getOrCreateNpcUser()` then proceed with normal `battleService.initiateBattle()`.

**Files**:

- `src/app/api/attack/route.ts` — add NPC detection branch before normal attack flow

**Quality Requirements**: Must respect existing lock ordering (BATTLE_LOCK → USER_LOCK).

#### Task 3.3: NPC defeat handling

**Action**: In battle resolution (`battleService.resolveBattle` or equivalent), when the loser is an NPC user:

- Mark the NPC as `defeated = true` with `defeatTime = now` in NPCManager
- Remove the NPC's space_object from the world
- Award iron to the player: `5000 * 5^(level-1)` (L1=5k, L2=25k, L3=125k, L4=625k), plus standard XP/score
- The NPC user row can remain in DB (it's reused on respawn)

On respawn (midnight), the NPC's defense stats are reset to full and it reappears on orbit.

**Files**:

- `src/lib/server/battle/battleService.ts` — add NPC defeat hook in `resolveBattle()`
- `src/lib/server/npc/NPCManager.ts` — `markDefeated(npcId)`
- `src/lib/server/npc/npcCombat.ts` — `resetNpcUserStats(userId, level)` for respawn

#### Task 3.4: NPC stops during battle

**Action**: While in battle, the NPC should stop orbiting (speed = 0). When battle ends (NPC survives), resume orbit from current position.

**Files**:

- `src/lib/server/npc/NPCManager.ts` — check `inBattle` flag, skip position update

---

### Goal 4: Testing

**Description**: Cover NPC business logic with unit tests.

#### Task 4.1: NPCManager unit tests

**Action**: Test NPC generation, orbital position calculation, midnight respawn logic, level refresh.

**Files**:

- `src/__tests__/unit/npc/NPCManager.test.ts`

#### Task 4.2: NPC combat unit tests

**Action**: Test NPC user creation with correct stats at various levels, defeat handling, respawn stat reset.

**Files**:

- `src/__tests__/unit/npc/npcCombat.test.ts`

#### Task 4.3: Integration test — attack NPC flow

**Action**: Test the full flow: player attacks NPC → NPC user created → battle starts → battle resolves → NPC marked defeated.

**Files**:

- `src/__tests__/integration/npcBattle.test.ts`

---

## Dependencies

- No new npm packages required. All functionality builds on existing systems.

## Arc42 Documentation Updates

**Proposed Changes**:

- Update `doc/architecture/arc42-architecture.md` Building Blocks section to add NPCManager as a new server-side component
- Add NPC ship type to the Space Object type documentation

## Architecture Notes

- **NPCManager** follows the same globalThis singleton + lazy initialization pattern as UserCache, WorldCache, etc.
- NPCs are **not** stored in the space_objects DB table — they're ephemeral, generated per-player.
- NPC users (for combat) **are** stored in the users table but created lazily on first attack.
- The `5^(level-1)` scaling means: L1=100 defense/10 weapons, L2=500/50, L3=2500/250, L4=12500/1250. This is steep — verify balance is intentional.
- Client-side interpolation uses circular orbit math rather than linear extrapolation, which is more accurate for the known patrol path.
- No new lock level needed — NPCManager state is accessed under existing USER_LOCK (for user operations) and WORLD_LOCK (for position queries).

## Agent Decisions

1. **In-memory NPCs, no DB table**: NPCs are stateless patrols — storing them in DB adds complexity with no benefit. They regenerate on server restart, matching the starbase pattern.
2. **Lazy NPC user creation**: Only create a DB user when combat starts. This avoids pre-creating thousands of NPC users for players who never fight them.
3. **NPC ID offset scheme**: `20_000 + userId*10 + index` supports up to 10 NPCs per player and avoids collision with space objects (1-8999) and starbases (9000-9999).
4. **Circular interpolation on client**: Rather than sending frequent position updates, send orbit parameters and let the client compute smooth positions. This is bandwidth-efficient and jitter-free.
5. **Midnight respawn via lazy check**: No background timer needed — just check on next world poll. Simpler and consistent with the polling architecture.

## Resolved Questions

1. **x5 scaling per level**: Confirmed — keep x5 as specified.
2. **Rewards**: Iron reward = `5000 * 5^(level-1)`. L1=5k, L2=25k, L3=125k, L4=625k. Standard XP/score on top.
3. **NPCs fight back**: Yes — NPC weapons fire normally via the battle system.
4. **Which starbase**: Hardcode single starbase (4000,4000) for now.
