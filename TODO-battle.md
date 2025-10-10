# Implementation Plan: Space Battle System

## Overview
Implement a turn-based space combat system where players can engage in battles, firing weapons with cooldowns, dealing damage based on weapon stats, and having winner/loser outcomes.

## Core Concept
- Players can initiate attacks on other players
- Battle state locks both players (speeds set to 0)
- Turn-based combat with weapon cooldowns
- Damage calculations using weapon stats vs defense values
- Battle ends when one player's hull reaches 0
- Winner stays at location, loser teleports away

---

## Requirements Summary

### Battle States
- **Normal State**: Player can move, navigate, collect
- **In Battle State**: Player locked in combat, speed = 0,  invisible on map

### Battle Data Storage
- New `battles` table in database
- Battle-specific cache + lock in typedCacheManager
- Message log of all battle events
- Start/end stats for both players

### Combat Mechanics
- Event-based turn system (next weapon ready fires)
- Weapon cooldown timers per player, per weapon type
- Damage calculation: weapon damage vs armor/shield
- Hull destruction ends battle

### Battle Resolution
- Loser: Hull reaches 0, teleported to random location (minimum distance)
- Winner: Stays at current location, battle state cleared
- Both: Speed stays 0, battle record saved

---

## Phase 1: Database Schema (4 Tasks)

### Task 1: Create Battles Table Schema ✅ COMPLETED
**File**: `src/lib/server/schema.ts`
**Description**: Define battle table structure

**Status**: ✅ Implemented - `CREATE_BATTLES_TABLE` added to schema

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_id INTEGER NOT NULL,
  attackee_id INTEGER NOT NULL,
  
  -- Battle timing
  battle_start_time INTEGER NOT NULL,        -- Unix timestamp
  battle_end_time INTEGER DEFAULT NULL,      -- NULL if ongoing
  
  -- Battle outcome
  winner_id INTEGER DEFAULT NULL,            -- User ID of winner
  loser_id INTEGER DEFAULT NULL,             -- User ID of loser
  
  -- Weapon cooldowns (JSON: {weapon_type: last_fired_timestamp})
  attacker_weapon_cooldowns TEXT NOT NULL DEFAULT '{}',
  attackee_weapon_cooldowns TEXT NOT NULL DEFAULT '{}',
  
  -- Start stats snapshot (JSON)
  attacker_start_stats TEXT NOT NULL,        -- {hull, armor, shield, weapons: {...}}
  attackee_start_stats TEXT NOT NULL,
  
  -- End stats snapshot (JSON)
  attacker_end_stats TEXT DEFAULT NULL,
  attackee_end_stats TEXT DEFAULT NULL,
  
  -- Battle messages log (JSON array)
  battle_log TEXT NOT NULL DEFAULT '[]',
  
  FOREIGN KEY (attacker_id) REFERENCES users (id),
  FOREIGN KEY (attackee_id) REFERENCES users (id),
  FOREIGN KEY (winner_id) REFERENCES users (id),
  FOREIGN KEY (loser_id) REFERENCES users (id)
)
```

**Indexes**:
```sql
CREATE INDEX IF NOT EXISTS idx_battles_ongoing 
  ON battles(battle_end_time) WHERE battle_end_time IS NULL;
  
CREATE INDEX IF NOT EXISTS idx_battles_participants 
  ON battles(attacker_id, attackee_id);
```

**Testing**: Table creation, indexes created

---

### Task 2: Add Battle State to Users Table ✅ COMPLETED
**File**: `src/lib/server/schema.ts`
**Description**: Add battle state tracking to users

**Status**: ✅ Implemented - `MIGRATE_ADD_BATTLE_STATE` added to schema

**Migration**:
```sql
ALTER TABLE users ADD COLUMN in_battle BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN current_battle_id INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_in_battle 
  ON users(in_battle) WHERE in_battle = 1;
```

**Fields**:
- `in_battle`: Boolean flag for quick check
- `current_battle_id`: Reference to active battle (NULL if not in battle)

**❓ QUESTION**: Should we also store opponent_id for quick lookup, or always join through battles table?
-> also store opponent_id for quick lookup

**Testing**: Migration runs, indexes created

---

### Task 3: Battle Messages Table
**File**: `src/lib/server/schema.ts`
**Description**: Store battle events as messages

**💡 PROPOSAL**: Reuse existing `messages` table with battle-specific format

**Alternative A - Reuse messages table**:
```typescript
// Add to message:
message: "⚔️ BATTLE: Attacker fired Pulse Laser, dealt 50 damage to shield"
// Parse prefix "⚔️ BATTLE:" to identify battle messages
```

**✅ RECOMMENDATION**: Store in `battle_log` JSON field (Task 1), also send to players via existing messages table

**Testing**: Message storage and retrieval

---

### Task 4: Battle Type Definitions ✅ COMPLETED
**File**: `src/shared/battleTypes.ts` (NEW)
**Description**: TypeScript interfaces for battle system

**Status**: ✅ Implemented - Complete type definitions with helper functions

**Interfaces**:
```typescript
export interface Battle {
  id: number;
  attackerId: number;
  attackeeId: number;
  battleStartTime: number;
  battleEndTime: number | null;
  winnerId: number | null;
  loserId: number | null;
  attackerWeaponCooldowns: WeaponCooldowns;
  attackeeWeaponCooldowns: WeaponCooldowns;
  attackerStartStats: BattleStats;
  attackeeStartStats: BattleStats;
  attackerEndStats: BattleStats | null;
  attackeeEndStats: BattleStats | null;
  battleLog: BattleEvent[];
}

export interface WeaponCooldowns {
  [weaponType: string]: number; // timestamp of last fire
}

export interface BattleStats {
  hull: { current: number; max: number };
  armor: { current: number; max: number };
  shield: { current: number; max: number };
  weapons: {
    [weaponType: string]: {
      count: number;
      damage: number;
      cooldown: number;
    };
  };
}

export interface BattleEvent {
  timestamp: number;
  type: 'shot_fired' | 'damage_dealt' | 'shield_broken' | 'armor_broken' | 'hull_destroyed' | 'battle_ended';
  actor: 'attacker' | 'attackee';
  data: {
    weaponType?: string;
    damageDealt?: number;
    targetDefense?: 'shield' | 'armor' | 'hull';
    remainingValue?: number;
    [key: string]: any;
  };
}

export type BattleState = 'not_in_battle' | 'in_battle';
```

**Testing**: Type checking via TypeScript

---

## Phase 2: Battle Logic & Domain (6 Tasks)

### Task 5: Battle Repository
**File**: `src/lib/server/battleRepo.ts` (NEW)
**Description**: Database operations for battles

**Methods**:
```typescript
class BattleRepo {
  // Create new battle
  createBattle(attackerId: number, attackeeId: number, startStats): Promise<Battle>
  
  // Get battle by ID
  getBattle(battleId: number): Promise<Battle | null>
  
  // Get ongoing battle for user
  getOngoingBattleForUser(userId: number): Promise<Battle | null>
  
  // Update weapon cooldowns
  updateWeaponCooldowns(battleId: number, userId: number, cooldowns: WeaponCooldowns): Promise<void>
  
  // Add event to battle log
  addBattleEvent(battleId: number, event: BattleEvent): Promise<void>
  
  // End battle
  endBattle(battleId: number, winnerId: number, loserId: number, endStats): Promise<void>
  
  // Update defense values during battle
  updateBattleDefenses(battleId: number, userId: number, defenses): Promise<void>
}
```

**Testing**: Unit tests for all CRUD operations

---

### Task 6: Battle Domain Logic
**File**: `src/lib/server/battle.ts` (NEW)
**Description**: Core battle mechanics and calculations

**Battle Class**:
```typescript
class Battle {
  // Calculate next shot (which weapon fires next, from which player)
  getNextShot(now: number): { userId: number; weaponType: string; timestamp: number } | null
  
  // Process a weapon shot
  processShot(userId: number, weaponType: string, now: number): BattleEvent[]
  
  // Calculate damage after defenses
  calculateDamage(weaponDamage: number, defenses: BattleStats): {
    shieldDamage: number;
    armorDamage: number;
    hullDamage: number;
    defensesBroken: ('shield' | 'armor')[];
  }
  
  // Check if battle should end
  isBattleOver(): boolean
  
  // Determine winner/loser
  getOutcome(): { winnerId: number; loserId: number } | null
  
  // Apply weapon cooldown
  applyCooldown(userId: number, weaponType: string, now: number): void
  
  // Get all weapons with their next available fire time
  getWeaponReadyTimes(userId: number, now: number): Map<string, number>
}
```

**❓ QUESTIONS**:
1. **Simultaneous shots**: If attacker and attackee weapons ready at same timestamp, attacker goes first - correct? - yes
2. **Multi-weapon volleys**: Can multiple weapons fire in same "turn" if ready? - yes
3. **Overkill**: If shield takes 50 damage but only has 20 left, do remaining 30 damage armor? - 
Details are already implemented, see TechFactory.ts. Use those functions.

- Attacker advantage: Yes, attacker fires first in ties
- One weapon per turn: Only one weapon fires per turn (earliest ready weapon), but if there are multiple weapons ready at same time, all in the same second, i.e. multiple turns at the same timestamp

**Testing**: Unit tests for damage calculations, turn order, cooldowns

---

### Task 7: Weapon Statistics Integration
**File**: `src/lib/server/TechFactory.ts`
**Description**: Extend TechFactory with weapon stats

**💡 PROPOSAL**: Add weapon combat stats to existing specs

**New Fields**:
```typescript
interface WeaponSpec {
  key: string;
  name: string;
  type: 'weapon';
  
  // Existing fields
  cost: number;
  buildTime: number;
  description: string;
  
  // NEW - Combat stats
  damage: number;           // Base damage per shot
  cooldown: number;         // Seconds between shots
  damageType: 'energy' | 'kinetic' | 'explosive';  // For future defense bonuses
}
```

**Example Values** (for balance):
```typescript
pulse_laser: { damage: 50, cooldown: 2 }      // Fast, low damage
auto_turret: { damage: 30, cooldown: 1 }      // Very fast, very low damage
plasma_lance: { damage: 150, cooldown: 5 }    // Slow, high damage
gauss_rifle: { damage: 100, cooldown: 3 }     // Balanced
photon_torpedo: { damage: 200, cooldown: 8 }  // Very slow, very high damage
rocket_launcher: { damage: 180, cooldown: 6 } // Explosive damage
```

**Method**:
```typescript
static getWeaponCombatStats(weaponKey: string): {
  damage: number;
  cooldown: number;
  damageType: string;
} | null
```

**❓ QUESTION**: Should weapon damage scale with tech count (e.g., 5 pulse lasers = 5× damage)?

Not yet, will come later.

**Testing**: Combat stats retrieval, damage scaling

---

### Task 8: Battle Initialization
**File**: `src/lib/server/battleService.ts` (NEW)
**Description**: Service for initiating battles

**InitiateBattle Flow**:
```typescript
async function initiateBattle(attackerId: number, attackeeId: number): Promise<Battle> {
  // 1. Validate both players exist and are in normal state
  // 2. Check distance (must be within attack range?)
  // 3. Load current stats for both players
  // 4. Create battle in DB
  // 5. Set both players' in_battle = true, speed = 0
  // 6. Initialize weapon cooldowns (all available immediately)
  // 7. Send "Battle Started" message to both players
  // 8. Cache battle in typedCacheManager
  // 9. Return battle object
}
```

**❓ QUESTIONS**:
1. **Attack range**: Is there a maximum distance to initiate attack?
2. **Consent**: Can target refuse battle, or is it automatic when attacked?
3. **Resource cost**: Does attacking cost iron or other resources?
4. **Cooldown**: Is there a cooldown before attacking again after battle?

**💡 ASSUMPTIONS**:
- No attack range limit (can attack anyone anywhere)
- No consent required (automatic battle)
- No resource cost to attack
- No post-battle cooldown

**Testing**: Battle creation, player state updates

---

### Task 9: Battle Update Loop
**File**: `src/lib/server/battleService.ts`
**Description**: Process battle turns

**UpdateBattle Flow**:
```typescript
async function updateBattle(battleId: number, now: number): Promise<void> {
  // 1. Load battle from cache/DB
  // 2. Check if battle already ended
  // 3. Get next shot
  // 4. If no shot ready, return (waiting for cooldown)
  // 5. Process shot:
  //    - Calculate damage
  //    - Apply damage to defenses
  //    - Log event
  //    - Send message to both players
  // 6. Check if battle ends (hull destroyed)
  // 7. If ended, resolve battle (Task 10)
  // 8. Update battle in cache and persist to DB
}
```

**Trigger Options**:
- **Option A**: Player-specific update (triggered when either player polls)
- **Option B**: Global world update (checks all ongoing battles)
- **Option C**: Event-based (scheduled task processes next shot)

**💡 RECOMMENDATION**: Option A (player update trigger) + cache in typedCacheManager
- When player in battle polls any endpoint, also update their battle
- Lightweight and ties to existing player activity pattern
- Falls back to periodic cache sync for inactive players

**Testing**: Battle progression, damage application

---

### Task 10: Battle Resolution
**File**: `src/lib/server/battleService.ts`
**Description**: End battle and handle outcomes

**ResolveBattle Flow**:
```typescript
async function resolveBattle(battleId: number, now: number): Promise<void> {
  // 1. Determine winner/loser (who has hull > 0)
  // 2. Capture end stats for both players
  // 3. Update battle record (end time, winner, loser, end stats)
  // 4. Teleport loser:
  //    - Generate random location (minimum distance from winner)
  //    - Update loser's position in space_objects
  //    - Reset loser's speed to default
  // 5. Restore winner's speed to normal
  // 6. Clear both players' in_battle state
  // 7. Send "Battle Ended" messages
  // 8. Persist final battle state
  // 9. Remove from battle cache
  // Future: Award XP to winner
}
```

**❓ QUESTIONS**:
1. **Loser teleport distance**: How far away? (e.g., 1000 units minimum?)
2. **Loser penalty**: Only teleport, or also lose iron/resources?
3. **Winner reward**: Currently none (future: XP), should there be iron reward?
4. **Defense restoration**: Do defenses start regenerating immediately after battle?

**💡 ASSUMPTIONS**:
- Teleport minimum distance: >100 units from winner
- Iron is fully transferred to the winner from the loser
- Iron from loser
- Defense regeneration resumes immediately after battle

**Testing**: Battle resolution, teleportation, state cleanup

---

## Phase 3: Cache & Lock Integration (2 Tasks)

### Task 11: Battle Cache in TypedCacheManager
**File**: `src/lib/server/typedCacheManager.ts`
**Description**: Add battle caching with proper locking

**Cache Structure**:
```typescript
// Add to TypedCacheManager
private battles: Map<number, Battle> = new Map();
private battleLocks: Map<number, Lock> = new Map();

// Methods
async withBattleLock<T>(
  battleId: number, 
  operation: (battle: Battle) => Promise<T>
): Promise<T>

async loadBattleIfNeeded(battleId: number): Promise<Battle>
async persistBattle(battle: Battle): Promise<void>
async removeBattle(battleId: number): Promise<void>
```

**Lock Hierarchy**:
```
Level 1: World Lock (existing)
Level 2: User Locks (existing)
Level 3: Battle Locks (NEW)
```

**❓ QUESTION**: Should battle locks be ordered by battle ID to prevent deadlocks?

**💡 PROPOSAL**: Battle operations should acquire both player locks + battle lock
```typescript
// Lock order: user1, user2, battle (by ID ascending)
await withUserLock(attackerId, async (attacker) => {
  await withUserLock(attackeeId, async (attackee) => {
    await withBattleLock(battleId, async (battle) => {
      // Perform battle operation
    });
  });
});
```

**Testing**: Concurrent battle operations, lock ordering

---

### Task 12: Battle Persistence Strategy
**File**: `src/lib/server/typedCacheManager.ts`
**Description**: Define when battles sync to DB

**Persistence Triggers**:
1. **On battle creation**: Immediate DB insert
2. **On shot fired**: Update weapon cooldowns + battle log
3. **On battle end**: Final update with outcome
4. **On periodic sync**: Every 10 seconds (existing mechanism)
5. **On cache eviction**: Before removing from cache

**💡 PROPOSAL**: Battles are short-lived (minutes), so keep in cache entire duration

**Battle Lifecycle**:
1. Created → Insert to DB, cache in memory
2. Active → All updates in cache, periodic sync to DB
3. Ended → Final DB update, keep cached for 5 minutes (for message display)
4. Archived → Remove from cache, only in DB

**Testing**: Battle persistence, cache behavior

---

## Phase 4: API Endpoints (4 Tasks)

### Task 13: Attack Endpoint
**File**: `src/app/api/attack/route.ts` (NEW)
**Description**: Initiate battle with another player

**Request**:
```typescript
POST /api/attack
{
  targetUserId: number
}
```

**Response**:
```typescript
{
  success: boolean;
  battleId: number;
  message: string;
  battle?: Battle;
  error?: string;
}
```

**Validations**:
- Attacker is authenticated
- Target player exists
- Neither player already in battle
- Players are not the same

**Testing**: API tests for all validation cases

---

### Task 14: Battle Status Endpoint
**File**: `src/app/api/battle-status/route.ts` (NEW)
**Description**: Get current battle state for authenticated user

**Request**:
```typescript
GET /api/battle-status
```

**Response**:
```typescript
{
  inBattle: boolean;
  battle?: {
    id: number;
    opponentId: number;
    opponentName: string;
    isAttacker: boolean;
    startTime: number;
    currentStats: {
      myDefenses: BattleStats;
      opponentDefenses: BattleStats;
    };
    recentEvents: BattleEvent[]; // Last 10 events
    weaponStatus: {
      weaponType: string;
      nextAvailableTime: number;
      isReady: boolean;
    }[];
  };
}
```

**Behavior**:
- Triggers battle update if user in battle
- Returns current battle state
- Returns recent events for display

**Testing**: API test, battle state retrieval

---

### Task 15: Fire Weapon Endpoint
**File**: `src/app/api/fire-weapon/route.ts` (NEW)
**Description**: Player manually fires a weapon in battle

**Request**:
```typescript
POST /api/fire-weapon
{
  weaponType: string
}
```

**Response**:
```typescript
{
  success: boolean;
  events?: BattleEvent[];
  battleEnded?: boolean;
  winner?: number;
  error?: string;
}
```

**❓ QUESTION**: Is combat automatic (weapons fire when ready), or manual (player clicks to fire)?

**💡 PROPOSAL - Hybrid Approach**:
- **Auto-fire by default**: Weapons fire automatically when ready

**Alternative - Fully Automatic**:
- Remove this endpoint
- Battles progress automatically
- Players just watch via battle-status polling

> Start with fully automatic

**Testing**: (Skip if fully automatic)

---

### Task 16: Surrender Endpoint
**File**: `src/app/api/surrender/route.ts` (NEW)
**Description**: Player surrenders current battle

**Request**:
```typescript
POST /api/surrender
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

**Behavior**:
- Immediately ends battle
- Surrendering player is marked as loser
- Same outcome as hull destruction (teleport away)
- **💡 PROPOSAL**: Add surrender penalty (e.g., lose more iron?)

**❓ QUESTION**: Should there be a surrender option?

**Testing**: Surrender flow, state cleanup

---

## Phase 5: Frontend Integration (5 Tasks)

### Task 17: Battle UI State Hook
**File**: `src/lib/client/hooks/useBattle.ts` (NEW)
**Description**: React hook for battle state

**Hook**:
```typescript
function useBattle() {
  return {
    inBattle: boolean;
    battle: Battle | null;
    isLoading: boolean;
    error: string | null;
    
    // Actions
    attack: (targetUserId: number) => Promise<void>;
    surrender: () => Promise<void>;
    refetch: () => void;
  };
}
```

**Features**:
- Auto-refresh every 2 seconds during battle
- Listen to global events for battle end
- Display recent events

**Testing**: Hook unit tests

---

### Task 18: Battle Overlay Component
Don't do, no UI.

---

### Task 19: Attack Button in Game View
**File**: `src/components/Game/` or `src/app/game/GamePageClient.tsx`
**Description**: Add "Attack" option for nearby players

**Feature**:
- Click on enemy ship in game view
- Show "Attack" button
- Confirm dialog: "Attack player X?"
- Initiates battle via API

**❓ QUESTION**: Should there be visual indicators showing which ships are players vs NPCs?

> This is obvious from the used sprites already.

**Testing**: Attack initiation from game view

---

### Task 20: Battle Notifications
**File**: `src/lib/client/hooks/useBattle.ts`
**Description**: Toast notifications for battle events

**Events to Notify**:
- "You are under attack by [player]!"
- "Your [weapon] destroyed opponent's shield!"
- "Your hull is critical! (<20%)"
- "Battle ended - You won!"
- "Battle ended - You lost"

**Testing**: Notifications display correctly

---

### Task 21: Hide Space Objects During Battle
**File**: `src/lib/client/game/World.ts` or rendering logic
**Description**: Filter out asteroids/collectibles when in battle

**Implementation**:
```typescript
// In world rendering
const objectsToRender = worldData.objects.filter(obj => {
  if (userInBattle) {
    // Only show player ships during battle
    return obj.type === 'player_ship';
  }
  return true; // Show all objects normally
});
```

**Testing**: Objects hidden during battle, reappear after

---

## Phase 6: Integration & Testing (4 Tasks)

### Task 22: Battle Update Integration
**Description**: Integrate battle updates with existing systems

**Integration Points**:
1. **User stats endpoint**: Check for battle, update if needed
2. **Ship stats endpoint**: Check for battle, update if needed  
3. **World endpoint**: Filter objects if user in battle
4. **Navigate endpoint**: Block navigation if in battle

**💡 PROPOSAL**: Create middleware/helper function `checkAndUpdateBattle(userId)`
- Called at start of any user-related endpoint
- Updates battle if user is in one
- Returns battle state

**Testing**: All endpoints handle battle state correctly

---

### Task 23: End-to-End Battle Testing
**Description**: Test complete battle flow

**Test Scenario**:
1. Two players at different locations
2. Player A attacks Player B
3. Both players' speeds set to 0, battle state active
4. Weapons fire automatically based on cooldowns
5. Damage applied to defenses (shield → armor → hull)
6. Player B's hull reaches 0
7. Player B teleported away
8. Player A stays at location
9. Both players exit battle state
10. Both can navigate again

**Expected Results**: All steps work correctly

**Testing**: Integration test suite

---

### Task 24: Battle Balance Testing
**Description**: Test combat balance and adjust values

**Test Cases**:
- Equal tech levels (5v5) - should be close fight
- Unequal tech levels (10v5) - higher tech should win
- Different weapon compositions - variety in battles
- Defense regeneration disabled during battle - verify

**Adjustments**:
- Weapon damage values
- Weapon cooldown times
- Defense values balance

**Testing**: Manual testing, balance spreadsheet

---

### Task 25: Documentation
**Files**: 
- `.github/copilot-instructions.md`
- `doc/battleSystem.md` (NEW)

**Document**:
- Battle flow diagrams
- State machine (normal → in_battle → normal)
- API endpoint reference
- Combat calculations
- Database schema
- Frontend components

**Testing**: Documentation review

---

## Open Questions & Design Decisions

### Critical Questions Needing Answers

1. **❓ Attack Range**: 
   - Any distance, or must be close?
   -  to initiate battle, same mechanic as collecting. Then there is no distance chaging due to 0 speed. No need to check distance.

2. **❓ Battle Consent**: 
   - Automatic

3. **❓ Combat Mode**:
   - Fully automatic weapon firing

4. **❓ Weapon Damage Scaling**:
   see existing TechFactory.ts implementation

5. **❓ Damage Overflow**:
   -see existing TechFactory.ts implementation

9. **❓ Surrender Option**:
   - **PROPOSAL**: Yes, but lose iron?

10. **❓ Defense Regeneration**:
    - Disabled during battle?
     Yes, no regen during combat

11. **❓ Multi-Battle**:
    - Can multiple battles happen simultaneously?
    - **ASSUMPTION**: Not between the same ships/players

12. **❓ Battle Persistence**:
    - How long to keep ended battles?
    - forever

### Design Proposals

**💡 PROPOSAL 1: Battle Visibility**
- Add `GET /api/active-battles` endpoint
- Shows list of ongoing battles (for spectating?)
- Returns: `{ battles: Array<{ id, attacker, attackee, startTime }> }`

**💡 PROPOSAL 2: Battle History**
- Add `GET /api/battle-history?userId=X` endpoint  
- Shows past battles for a player
- Stats: wins, losses, total battles
- Could feed into leaderboard

**💡 PROPOSAL 3: Battle Animations**
- Store weapon fire events with positions
- Frontend can show lasers/projectiles
- Makes battles more visually interesting

**💡 PROPOSAL 4: Escape Mechanic**
- If one player outclasses another (3:1 tech advantage)
- Weaker player can flee with small penalty
- Prevents griefing of new players

**💡 PROPOSAL 5: Battle Cooldown**
- After battle, 60 second cooldown before attacking again
- Prevents immediate re-attack of same player
- Gives loser time to escape

### Future Enhancements (Not in Initial Implementation)

- **XP System**: Winner gains experience points
- **Damage Types**: Energy vs kinetic damage, defense bonuses
- **Critical Hits**: Random chance for bonus damage
- **Weapon Targeting**: Choose which defense layer to attack
- **Battle Spectating**: Watch others' battles
- **Team Battles**: 2v2, 3v3 battles
- **Battle Arenas**: Special zones for PvP
- **Wreckage Looting**: Winner gets iron from destroyed ship
- **Battle Replays**: Save and replay past battles
- **Achievement System**: Battle-related achievements

---

## Implementation Strategy

### Recommended Implementation Order

**Week 1: Foundation**
1. Database schema (Tasks 1-4)
2. Type definitions (Task 4)
3. Battle repository (Task 5)

**Week 2: Core Logic**
4. Battle domain logic (Task 6)
5. Weapon stats (Task 7)
6. Battle service (Tasks 8-10)

**Week 3: Integration**
7. Cache and locks (Tasks 11-12)
8. API endpoints (Tasks 13-16)

**Week 4: Frontend**
9. Battle hook (Task 17)
10. Battle UI (Tasks 18-21)

**Week 5: Testing & Polish**
11. Integration (Tasks 22-23)
12. Balance testing (Task 24)
13. Documentation (Task 25)

### Testing Strategy

- **Unit Tests**: Domain logic, damage calculations, turn order
- **Integration Tests**: Full battle flow, state transitions
- **API Tests**: All endpoints, error cases
- **Manual Tests**: UI, balance, edge cases

### Rollback Plan

- Feature flag: `ENABLE_BATTLES = false`
- All battle code behind flag
- Can disable without removing code
- DB migrations are additive (safe to keep)

---

## Success Criteria

**Phase 1 (Database)**: ✅
- [ ] Battles table created with proper schema
- [ ] User battle state columns added
- [ ] Indexes created for performance
- [ ] Type definitions complete

**Phase 2 (Logic)**: ✅
- [ ] Battle creation works
- [ ] Damage calculations correct
- [ ] Turn order follows rules
- [ ] Battle resolution works
- [ ] Winner/loser outcomes correct

**Phase 3 (Cache)**: ✅
- [ ] Battles cached properly
- [ ] Lock hierarchy prevents deadlocks
- [ ] Battle persistence works

**Phase 4 (API)**: ✅
- [ ] Attack endpoint works
- [ ] Battle status endpoint works
- [ ] All validations in place

**Phase 5 (Frontend)**: ✅
- [ ] Battle UI displays correctly
- [ ] Real-time updates work
- [ ] Attack flow smooth
- [ ] Objects hidden during battle

**Phase 6 (Integration)**: ✅
- [ ] End-to-end battle works
- [ ] All edge cases handled
- [ ] Performance acceptable
- [ ] Documentation complete

---

## Estimated Effort

- **Phase 1 (Database)**: ~4-6 hours
- **Phase 2 (Logic)**: ~12-16 hours
- **Phase 3 (Cache)**: ~6-8 hours
- **Phase 4 (API)**: ~8-10 hours
- **Phase 5 (Frontend)**: ~12-16 hours
- **Phase 6 (Testing)**: ~8-12 hours

**Total**: ~50-68 hours (~1.5-2 weeks of full-time work)

---

## Risk Assessment

### High Risk
- **Lock ordering complexity**: Battle + 2 users = 3 locks, deadlock risk HIGH
- **Race conditions**: Simultaneous attacks could create issues
- **Performance**: Many battles could slow down cache manager

### Medium Risk
- **Balance**: Weapon stats might need significant tuning
- **Edge cases**: Many corner cases in battle logic
- **Frontend complexity**: Real-time battle UI is non-trivial

### Low Risk
- **Database**: Schema is straightforward
- **Rollback**: Feature can be disabled easily

### Mitigation Strategies
1. **Lock ordering**: Strict ordering by ID (user1 < user2 < battle)
2. **Race conditions**: Atomic DB operations, check battle state in transactions
3. **Performance**: Battle cache with TTL, archive old battles
4. **Testing**: Extensive unit and integration tests

---

