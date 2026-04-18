# Development Plan: Player-Local NPCs

## Vision

As a player, I want to see NPC ships orbiting the starbase so that I have combat targets available even when no other players are online. Each player sees up to 4 NPCs at levels matching their own progression (level, level+1, level+2, level+3). NPCs orbit the starbase clockwise at 750 units distance, can be attacked (creating a User record on first attack for stat storage), and respawn at midnight when defeated.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only, no CommonJS)
- **Lock System**: IronGuard TypeScript Locks for compile-time deadlock prevention

## Goals

### Goal 1: NPC Domain Model & Configuration

**Description**: Define the NPC data model, configuration constants, and factory functions for creating NPC instances.

#### Task 1.1: Create NPC Constants & Types

**Action**: Create a shared NPC configuration module defining NPC constants and types.
**Files**:
- `src/shared/npcConstants.ts` - NPC configuration (orbit radius, count per player, ID offsets, orbit speed)
- `src/shared/src/types/gameTypes.ts` - Add `'npc_ship'` to SpaceObject type union (or reuse `'player_ship'`)

**Key decisions**:
- NPCs will use type `'player_ship'` in the shared SpaceObject type to reuse the existing client rendering pipeline (OtherShipRenderer already handles `player_ship`). This avoids changes to the client World.ts and SpaceObjectsRenderer.ts.
- NPC IDs will use a dedicated offset range (e.g., `NPC_ID_OFFSET = 8000`) to avoid collision with DB-assigned IDs and starbase IDs (9000+).
- NPC user IDs will use negative numbers (e.g., `-1` through `-4` per player) stored as `NPC_USER_ID_OFFSET - npcIndex` to distinguish from real users.
- Each player gets 4 NPCs, evenly spaced 90° apart on the orbit.

**Constants**:
- `NPC_ORBIT_RADIUS = 750` (units from starbase center)
- `NPC_COUNT_PER_PLAYER = 4`
- `NPC_ID_OFFSET = 8000` (space object ID range)
- `NPC_ORBIT_SPEED_DEG_PER_SEC = 2` (clockwise rotation, ~3 minutes per orbit)
- `NPC_PICTURE_ID = 1` (use npc1.png when available, ship1.png fallback for now)

#### Task 1.2: Create NPC Factory (Server-Side)

**Action**: Create an NPC service that generates NPC space objects for a given player.
**Files**:
- `src/lib/server/npc/npcService.ts` - Core NPC service with:
  - `generateNpcsForPlayer(userId, playerLevel, currentTimeMs)` → returns `SpaceObject[]` (4 NPC ships)
  - `calculateNpcPosition(npcIndex, currentTimeMs)` → computes x, y position on orbit
  - `calculateNpcAngle(npcIndex, currentTimeMs)` → computes facing angle (tangent to orbit, clockwise)
  - `getNpcLevel(playerLevel, npcIndex)` → returns `playerLevel + npcIndex` (0-indexed: level, level+1, level+2, level+3)
  - `isNpcDefeated(userId, npcIndex)` → checks if NPC was defeated today
  - `generateNpcUsername(npcLevel)` → generates display name like "Pirate Lv.3"

**Orbit calculation**:
- Starbase at (4000, 4000), radius 750
- Base angle for NPC index i: `i * 90°` (evenly spaced)
- Time-based rotation: `angle = baseAngle + (currentTimeMs / 1000) * NPC_ORBIT_SPEED_DEG_PER_SEC`
- Clockwise means angle decreases over time (or use negative rotation direction)
- Position: `x = 4000 + 750 * cos(angle_rad)`, `y = 4000 + 750 * sin(angle_rad)`
- Facing direction: tangent to circle (perpendicular to radius, clockwise direction)

**NPC SpaceObject shape** (reuses `player_ship` type for rendering compatibility):
```typescript
{
  id: NPC_ID_OFFSET + npcIndex,  // e.g., 8000, 8001, 8002, 8003
  type: 'player_ship',
  x: computed_x,
  y: computed_y,
  speed: computed_orbital_speed,  // linear speed along orbit
  angle: facing_angle,
  last_position_update_ms: currentTimeMs,
  picture_id: 1,  // npc1.png or ship1.png fallback
  username: "Pirate Lv.3",
  userId: NPC_USER_ID_OFFSET - npcIndex,  // negative IDs for NPCs
  level: playerLevel + npcIndex
}
```

#### Task 1.3: NPC Defeat Tracking (In-Memory)

**Action**: Track which NPCs have been defeated by which players, with midnight reset.
**Files**:
- `src/lib/server/npc/npcService.ts` - Add defeat tracking:
  - `Map<number, Set<number>>` mapping `userId → Set<npcIndex>` for defeated NPCs
  - `markNpcDefeated(userId, npcIndex)` - marks NPC as defeated
  - `resetDefeatedNpcs()` - clears all defeats (called at midnight)
  - `isNpcDefeated(userId, npcIndex)` - checks if specific NPC is defeated for this player

**Midnight reset**: Use a simple timer that checks every minute if the date has changed, and resets the defeat map.

### Goal 2: Integrate NPCs into World API

**Description**: Modify the world API endpoint to inject player-specific NPCs into the response, similar to how starbases are injected.

#### Task 2.1: Modify World API Route

**Action**: Inject player-specific NPCs into the world API response.
**Files**:
- `src/app/api/world/route.ts` - After appending starbases, also append player-specific NPCs:
  1. Get player's level from UserCache (already have userId from session)
  2. Call `generateNpcsForPlayer(userId, playerLevel, Date.now())`
  3. Filter out defeated NPCs
  4. Append to `spaceObjects` array in response

**Lock considerations**: Need USER_LOCK to get player level. Current route only acquires WORLD_LOCK. Will need to acquire USER_LOCK first (or compute level from cached data without additional lock).

**Alternative approach**: Get user from UserCache using the existing WORLD_LOCK context, or acquire USER_LOCK before WORLD_LOCK (following the lock hierarchy: USER_LOCK level 4, WORLD_LOCK level 6).

### Goal 3: NPC Battle Support

**Description**: Allow players to attack NPCs. On first attack, create a User record for the NPC to store battle stats. Use the existing battle system.

#### Task 3.1: Create NPC User on Attack

**Action**: When a player attacks an NPC, create (or retrieve) a User record for that NPC with stats based on level.
**Files**:
- `src/lib/server/npc/npcService.ts` - Add:
  - `getOrCreateNpcUser(npcLevel, npcIndex, playerUserId)` → creates a User in UserCache if not exists
  - `createNpcTechCounts(npcLevel)` → generates TechCounts based on level:
    - Defense: `100 * npcLevel` of each (ship_hull, kinetic_armor, energy_shield)
    - Note: Problem statement says "100 of each defense item ... factor x5 per level, so level 2 has 500" 
    - This means: level 1 = 100, level 2 = 500 (100 * 5), level 3 = 2500 (100 * 25)?  
    - Or: level 1 = 100, level 2 = 500 (100 * 5^1), level 3 = 2500 (100 * 5^2)?
    - Interpretation: `100 * 5^(level-1)` for defense, `10 * 5^(level-1)` for weapons
    - Actually re-reading: "100 of each defense item and 10 of one random weapon type, all fully repaired. This takes a factor x5 per level, so level 2 has already 500 of each defense item, 50 of a weapon."
    - So: defense count = `100 * 5^(level-1)`, weapon count = `10 * 5^(level-1)` for one random weapon type
    - But wait: `TechCounts` represents the NUMBER of items, not HP. And max HP = `techCount * baseValue` (e.g., 150 HP per hull unit). So 100 hull units = 15,000 HP at level 1.
    - Need to clarify: Does "100 of each defense item" mean 100 tech count units? That seems very high for level 1. Maybe it means 100 HP? 
    - Given the problem says "level 2 has 500 of each defense item", and the x5 factor, this seems like raw stat values, not tech counts. We should compute tech counts to achieve the desired HP values.
    - Actually, simpler interpretation: the values are tech counts directly. 100 hull units at level 1 = 15,000 max HP. That's quite strong but it's NPCs.
    
  - `createNpcTechTree(npcLevel)` → generates TechTree with all researches at `npcLevel`
  - `createNpcDefense(npcLevel, techCounts)` → generates defense values at full (100% repaired)
  - Random weapon selection: pick one of the 6 weapon types randomly

**NPC User record fields**:
- `id`: Use a deterministic negative ID based on playerUserId and npcIndex
- `username`: "Pirate Lv.{level}"
- `password_hash`: dummy value (NPC cannot login)
- `iron`: 0
- `xp`: calculated to produce the desired level
- `techTree`: all researches at npcLevel
- `techCounts`: defense = 100 * 5^(level-1), one random weapon = 10 * 5^(level-1)
- `hullCurrent/armorCurrent/shieldCurrent`: max values (fully repaired)
- `inBattle`: false
- `ship_id`: The NPC's space object ID

**Ship creation for NPC**: Need to create a space_object for the NPC ship in the WorldCache so the battle system can find it for distance checks.

#### Task 3.2: Modify Attack API for NPC Support

**Action**: Modify the attack endpoint to handle NPC targets.
**Files**:
- `src/app/api/attack/route.ts` - Add NPC detection:
  1. Check if `targetUserId` is in the NPC range (negative ID or special offset)
  2. If NPC target: call `getOrCreateNpcUser()` to ensure User exists
  3. Add NPC's ship to WorldCache if not already there (for distance check)
  4. Skip the "recent victims" check for NPCs (or include it)
  5. Skip the level range check for NPCs (NPCs are always attackable since they're already level-appropriate)
  6. Proceed with normal `initiateBattle()` flow

#### Task 3.3: Handle NPC Battle Resolution

**Action**: When an NPC loses a battle, mark it as defeated and handle cleanup.
**Files**:
- `src/lib/server/battle/battleService.ts` - In `resolveBattle()`:
  1. After battle ends, check if loser is an NPC (negative userId or special flag)
  2. If NPC lost: call `markNpcDefeated(playerUserId, npcIndex)`
  3. Skip iron transfer from NPC (or give fixed iron reward)
  4. Award XP to player based on NPC level
  5. Remove NPC ship from WorldCache
  6. Remove NPC User from UserCache (cleanup)
  7. If NPC won: teleport player as usual, NPC continues orbiting

### Goal 4: Client-Side Rendering

**Description**: NPCs render using the existing `player_ship` pipeline via OtherShipRenderer. The server sends them as `player_ship` type objects, so no client changes are needed for basic rendering.

#### Task 4.1: Add NPC Image Asset

**Action**: Add the npc1.png image asset. For now, NPCs will use an existing ship sprite since no npc1.png was found.
**Files**:
- `public/assets/images/npc1.png` - Add NPC ship sprite (or document that ship1.png is used as fallback)

**Note**: The OtherShipRenderer loads images as `/assets/images/ship${pictureId}.png`. To use npc1.png, we'd either:
1. Use a high picture_id (e.g., 99) and name the file `ship99.png` 
2. Or modify the image loading to handle NPC-specific images

For simplicity, use approach 1: copy/rename npc1.png to a ship{N}.png filename, or just use picture_id=1 (ship1.png) for now.

#### Task 4.2: Smooth Client-Side Position Updates (Optimistic)

**Description**: Since the server computes NPC positions based on time, and the client polls every ~1 second, the NPCs will appear to jump between positions. For smooth movement:

**Approach**: The server already sends `speed` and `angle` with each NPC. The client's existing position interpolation (if any) or the server's frequent position updates should provide reasonably smooth movement. Since the NPCs are sent as `player_ship` type with correct `speed` and `angle`, the client already handles movement prediction for all ships.

**Investigation**: Check if the client does client-side position interpolation. Based on the World.ts code, the client does NOT do client-side physics - it relies entirely on server data ("NOTE: Client-side physics updates removed - all positions come from server"). This means NPCs will jump between positions on each poll.

**Solution options**:
1. **Server-side smoothing**: Send NPCs with computed `speed` and `angle` so the client can interpolate between polls (requires client-side physics for NPCs)
2. **Accept jumpiness**: NPCs update position every poll (~1 second). At 2°/sec orbit speed, they move ~26 units per second. This is noticeable but acceptable for MVP.
3. **Client-side interpolation**: Add client-side position prediction for all `player_ship` objects based on their speed and angle between server updates.

**Recommendation**: Option 2 for MVP. The position updates will be frequent enough for acceptable smoothness. The server sends correct `speed` and `angle` so if client-side interpolation is added later, NPCs benefit automatically.

### Goal 5: Unit Tests

**Description**: Add comprehensive unit tests for NPC logic.

#### Task 5.1: NPC Service Unit Tests

**Action**: Test NPC generation, position calculation, defeat tracking, and user creation.
**Files**:
- `src/__tests__/unit/npc/npcService.test.ts` - Tests for:
  - `generateNpcsForPlayer` returns 4 NPCs with correct levels
  - `calculateNpcPosition` returns correct orbital position for given time
  - NPCs are evenly spaced 90° apart
  - `getNpcLevel` returns playerLevel + npcIndex
  - `isNpcDefeated` / `markNpcDefeated` / `resetDefeatedNpcs` work correctly
  - Defeated NPCs are excluded from generation
  - NPC tech counts scale correctly with level
  - NPC tech tree has all researches at correct level
  - NPC defense values are fully repaired (100% of max)

#### Task 5.2: NPC Integration in World API Tests

**Action**: Test that NPCs appear in world API responses.
**Files**:
- `src/__tests__/integration/api/world-npc.test.ts` - Tests for:
  - World API includes player-specific NPCs in response
  - NPCs have correct type, username, level
  - Defeated NPCs are excluded
  - Different players see different NPC configurations (based on their level)

#### Task 5.3: NPC Battle Integration Tests

**Action**: Test the full NPC battle flow.
**Files**:
- `src/__tests__/integration/api/attack-npc.test.ts` - Tests for:
  - Can attack an NPC
  - NPC User is created with correct stats on attack
  - Battle resolves correctly
  - Defeated NPC is removed from future world responses
  - XP is awarded to player on NPC defeat

## Dependencies

No new npm packages required. Uses existing:
- `@markdrei/ironguard-typescript-locks` for lock management
- `iron-session` for session management
- `vitest` for testing

## Arc42 Documentation Updates

**Proposed Changes**:
- Update runtime view to document NPC injection in world API response
- Add NPC subsystem to building block view
- Document NPC lifecycle (creation, orbit, attack, defeat, respawn)

## Architecture Notes

### Key Design Decisions

1. **NPCs as `player_ship` type**: Reuse existing rendering pipeline. NPCs appear as regular ships to the client, just with special usernames and managed server-side.

2. **Player-local generation**: NPCs are not stored in WorldCache. They're computed on-the-fly in the world API response based on player level and current time. This means:
   - No database storage for NPC space objects
   - No world physics updates needed for NPCs
   - Each player sees their own set of NPCs

3. **Lazy NPC User creation**: NPC User records are only created when attacked. This avoids polluting the UserCache with NPC users that may never be interacted with. The User is created in-memory in UserCache (and optionally persisted to DB for battle system compatibility).

4. **Deterministic positioning**: NPC positions are computed from `currentTimeMs`, so all API calls return consistent positions. No state management needed for NPC movement.

5. **Lock hierarchy compliance**: World API currently uses WORLD_LOCK (level 6). To get player level, we need USER_LOCK (level 4). Lock hierarchy requires acquiring lower-numbered locks first: USER_LOCK → WORLD_LOCK. The world route will be modified to acquire USER_LOCK first.

### NPC ID Scheme

| Entity | ID Range | Example |
|--------|----------|---------|
| DB space objects | 1-7999 | Auto-increment |
| NPC space objects | 8000-8999 | 8000 + npcIndex |
| Starbase objects | 9000-9999 | 9001 |
| NPC user IDs | Negative | -(playerUserId * 10 + npcIndex) |

### NPC Stats Formula

For an NPC at level L:
- **Defense items** (hull, armor, shield): `100 * 5^(L-1)` units each
- **Weapon**: `10 * 5^(L-1)` units of one random weapon type
- **Missile jammer**: 0
- **Tech tree**: All researches at level L
- **Current defense**: 100% of max (fully repaired)

Level 1: 100 defense each, 10 weapons → Hull: 100 units (100 * 150 base = 15,000 HP before research)
Level 2: 500 defense each, 50 weapons → Hull: 500 units (500 * 150 base = 75,000 HP before research)
Level 3: 2,500 defense each, 250 weapons

**Note**: These values may need balancing. The x5 per level scaling is exponential and gets very large quickly.

## Agent Decisions

1. **Reuse `player_ship` type**: Decided to reuse the existing `player_ship` type for NPCs rather than adding a new `npc_ship` type. This avoids client-side changes to World.ts, SpaceObjectsRenderer.ts, and OtherShipRenderer.ts. The trade-off is that the client cannot visually distinguish NPCs from players (except by username).

2. **In-memory defeat tracking**: Defeat tracking is stored in-memory rather than in the database, since NPCs reset daily at midnight. This simplifies the implementation and avoids schema changes for what is ephemeral data. The trade-off is that server restarts also reset defeats.

3. **Server-computed positions**: NPC positions are computed from the current timestamp on each API call rather than being stored in WorldCache. This is a pure function with no state, making it simple and stateless. The trade-off is that positions are recalculated on every request (but the math is trivial).

4. **Lazy user creation**: NPC users are only created when attacked, not when the server starts. This keeps the UserCache clean and avoids creating users that are never used.

5. **Lock ordering**: Modified world API route to acquire USER_LOCK before WORLD_LOCK to get player level for NPC generation while maintaining lock hierarchy compliance.

## Open Questions

### Question 1: NPC Stats Interpretation

The problem states "100 of each defense item and 10 of one random weapon type ... factor x5 per level". Does "100" mean:
- **Option A**: 100 tech count units (resulting in 15,000 HP hull at level 1 with 150 base HP per unit)
- **Option B**: 100 HP total (requiring ~0.67 tech count units)

**Recommendation**: Option A (100 tech count units). This makes NPCs formidable combat targets, which fits the RPG progression model. The x5 scaling per level creates challenging higher-level NPCs.

### Question 2: NPC Image

No `npc1.png` was found in the assets. Should we:
- **Option A**: Use `ship1.png` (or another existing ship sprite) as placeholder
- **Option B**: Create a new NPC-specific image
- **Option C**: Wait for the image asset to be provided

**Recommendation**: Option A for now. Use an existing ship sprite and document that it should be replaced with a proper NPC image later.

### Question 3: NPC Battle - Iron Reward

When a player defeats an NPC, should they receive iron?
- **Option A**: No iron reward (only XP)
- **Option B**: Fixed iron reward based on NPC level
- **Option C**: Transfer from NPC's iron (which is 0 by default)

**Recommendation**: Option B or C. Since NPCs have 0 iron, Option C would give nothing. A fixed iron reward based on level would incentivize NPC combat.

### Question 4: Client-Side Smooth Movement

Should we implement client-side position interpolation for NPCs?
- **Option A**: Accept 1-second poll-based position updates (jumpiness)
- **Option B**: Add client-side physics interpolation for all ships between polls

**Recommendation**: Option A for MVP. The orbit is slow enough (2°/sec ≈ 26 units/sec) that 1-second jumps are small.
