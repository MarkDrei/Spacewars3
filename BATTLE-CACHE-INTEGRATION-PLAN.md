# Battle System Cache Integration Plan

**Date:** October 24, 2025  
**Context:** Integrate battle system with dedicated BattleCache manager (Option A)  
**Decision:** Separate BattleCache singleton that delegates User/World operations to TypedCacheManager

---

## Architecture Decision: BattleCache (Separate Singleton)

### Design Principles:
1. **BattleCache** stores ONLY Battle objects (`Map<battleId, Battle>`)
2. **User operations** delegated to TypedCacheManager (inBattle flags, defense values)
3. **World operations** delegated to TypedCacheManager (ship positions, speeds)
4. **No cache consistency issues** - BattleCache never caches User/World data
5. **Single lock** for all battle operations (BATTLE_LOCK level 6)

### Why This Works:
```typescript
class BattleCache {
  private battles: Map<number, Battle> = new Map();  // ✅ Only battles
  
  async initiateBattle(attackerId: number, attackeeId: number) {
    // Get TypedCacheManager instance
    const cacheManager = getTypedCacheManager();
    
    // Acquire locks from TypedCacheManager
    const ctx = createLockContext();
    const worldCtx = await cacheManager.acquireWorldWrite(ctx);
    try {
      const userCtx = await cacheManager.acquireUserLock(worldCtx);
      try {
        // Get User data from TypedCacheManager (not cached here!)
        const attacker = cacheManager.getUserUnsafe(attackerId, userCtx);
        const attackee = cacheManager.getUserUnsafe(attackeeId, userCtx);
        
        // Get World data from TypedCacheManager (not cached here!)
        const world = cacheManager.getWorldUnsafe(worldCtx);
        
        // BattleCache ONLY manages Battle objects
        const battleLockCtx = await userCtx.acquireWrite(BATTLE_LOCK);
        try {
          const battle = this.createBattle(...);
          this.battles.set(battle.id, battle);
          this.dirtyBattles.add(battle.id);
        } finally {
          battleLockCtx.dispose();
        }
        
        // Update User flags via TypedCacheManager
        attacker.inBattle = true;
        attacker.current_battle_id = battle.id;
        cacheManager.updateUserUnsafe(attacker, userCtx);
        
      } finally {
        userCtx.dispose();
      }
    } finally {
      worldCtx.dispose();
    }
  }
}
```

---

## Decisions Made (Final)

### Q1: Battle ID Generation
**Decision:** Auto-increment (keep current DB behavior)  
**Reason:** Battle creation is not performance-critical (~10ms DB write acceptable)

### Q2: Cache Size Limits
**Decision:** Cache only active battles (battleEndTime === null)  
**Reason:** Small set (typically <100), evict completed battles immediately

### Q3: Scheduler Integration
**Decision:** High-level API  
**Reason:** Proper lock management, type-safe

### Q4: Ship Operations
**Decision:** Always update World cache via TypedCacheManager  
**Reason:** Maintains cache consistency, no bypasses

### Q5: Defense Values During Battle
**Decision:** User is source of truth, Battle stores references to User values  
**Reason:** Defense values are in `users` table (hull_current, armor_current, shield_current), TypedCacheManager already manages them

### Q6: Locking Strategy
**Decision:** Single BATTLE_LOCK for all battle operations  
**Reason:** Simpler, battles are low-frequency operations, minimizes complexity

### Q7: Persistence Frequency
**Decision:** 30s background persistence (matches other caches)  
**Reason:** Consistency across codebase, battle_end persists immediately

### Q8: Error Handling
**Decision:** Reload from DB on inconsistency  
**Reason:** DB is source of truth, simple recovery

---

## Current State Analysis

### Direct Database Access Points

**battleRepo.ts (11 methods with DB access):**
- `createBattle()` - INSERT new battle
- `getBattle()` - SELECT battle by ID
- `getOngoingBattleForUser()` - SELECT active battle for user
- `updateWeaponCooldowns()` - UPDATE weapon cooldowns
- `addBattleEvent()` - UPDATE battle log
- `updateBattleDefenses()` - UPDATE defense stats
- `endBattle()` - UPDATE battle end state
- `getBattlesForUser()` - SELECT battle history
- `getActiveBattles()` - SELECT all active battles
- `setWeaponCooldown()` - UPDATE single weapon cooldown
- `updateBattleStats()` - UPDATE both players' stats

**battleService.ts (7 helper functions with DB access):**
- `getShipPosition()` - SELECT ship coordinates from space_objects
- `setShipSpeed()` - UPDATE ship speed (bypasses world cache!)
- `updateUserBattleState()` - UPDATE user's battle flags (bypasses user cache!)
- `teleportShip()` - UPDATE ship position (bypasses world cache!)
- `updateUserDefense()` - UPDATE user defense values (bypasses user cache!)
- `getUserShipId()` - SELECT user's ship_id

**battleScheduler.ts (2 functions with DB access):**
- `createMessage()` - Uses MessagesRepo (already has cache)
- `updateUserBattleState()` - UPDATE user battle flags (duplicate of battleService, bypasses cache!)

---

## Implementation Plan (BattleCache Singleton)

### Lock Hierarchy
```
CACHE_LOCK (1)
  → WORLD_LOCK (2)
    → USER_LOCK (3)
      → BATTLE_LOCK (6)  ← NEW
        → DATABASE_LOCK (5)
```

### Phase 1: Create BattleCache Infrastructure

**Create `src/lib/server/BattleCache.ts`:**
```typescript
// Singleton pattern similar to TypedCacheManager
class BattleCache {
  private static instance: BattleCache | null = null;
  
  // Storage
  private battles: Map<number, Battle> = new Map();
  private activeBattlesByUser: Map<number, number> = new Map();
  private dirtyBattles: Set<number> = new Set();
  
  // Lock definition
  private static BATTLE_LOCK: LockDefinition = {
    name: 'BATTLE_LOCK',
    level: 6,
    allowedParents: [USER_LOCK],
    allowedChildren: [DATABASE_LOCK]
  };
  
  private db: Database | null = null;
  private persistenceTimer: NodeJS.Timeout | null = null;
  
  // Initialize method
  async initialize(db: Database): Promise<void>
  
  // Singleton access
  static getInstance(): BattleCache
  static resetInstance(): void
  
  // Background persistence
  private startPersistence(): void
  private async persistDirtyBattles(): Promise<void>
  
  // Unsafe methods (require lock context)
  getBattleUnsafe(battleId: number): Battle | null
  setBattleUnsafe(battle: Battle): void
  updateBattleUnsafe(battle: Battle): void
  deleteBattleUnsafe(battleId: number): void
}
```

### Phase 2: Add High-Level Battle API

**Add to BattleCache:**
```typescript
// Auto-acquire locks, delegate User/World to TypedCacheManager
async loadBattleIfNeeded(battleId: number): Promise<Battle | null>
async getOngoingBattleForUser(userId: number): Promise<Battle | null>
async getActiveBattles(): Promise<Battle[]>
async createBattle(attackerId: number, attackeeId: number): Promise<Battle>
async endBattle(battleId: number, winnerId: number): Promise<void>
  const db = await getDatabase();
  db.run('UPDATE space_objects SET speed = ? WHERE id = ?', ...);
```

**Convert all methods to delegate to TypedCacheManager:**
- `setShipSpeed()` → Use World cache via TypedCacheManager
- `updateUserBattleState()` → Use User cache via TypedCacheManager
- `teleportShip()` → Use World cache
- `updateUserDefense()` → Use User cache
- `getUserShipId()` → Get from cached User object
- `getShipPosition()` → Use World cache

### Phase 3: Refactor battleScheduler.ts

**Update `processActiveBattles()`:**
- Get active battles from BattleCache instead of direct DB
- Remove duplicate `updateUserBattleState()` function
- Ensure MessageCache integration (already working via MessagesRepo)

### Phase 4: Update battleRepo.ts

**Convert static class methods to exported functions:**
```typescript
// OLD
class BattleRepo {
  static async getBattle(battleId: number): Promise<Battle | null> {
    const db = getDatabase();
    return db.get('SELECT * FROM battles WHERE id = ?', battleId);
  }
}

// NEW
export async function getBattle(battleId: number): Promise<Battle | null> {
  const battleCache = BattleCache.getInstance();
  return await battleCache.loadBattleIfNeeded(battleId);
}
```

**Methods to convert:**
- `createBattle()` → Use BattleCache.createBattle()
- `getBattle()` → Use BattleCache.loadBattleIfNeeded()
- `getOngoingBattleForUser()` → Use BattleCache.getOngoingBattleForUser()
- `updateWeaponCooldowns()` → Use BattleCache.updateBattleUnsafe()
- `addBattleEvent()` → Use BattleCache.updateBattleUnsafe()
- `updateBattleDefenses()` → Use BattleCache.updateBattleUnsafe()
- `endBattle()` → Use BattleCache.endBattle()
- `getBattlesForUser()` → Direct DB query (history, not cached)
- `getActiveBattles()` → Use BattleCache.getActiveBattles()
- `setWeaponCooldown()` → Use BattleCache.updateBattleUnsafe()
- `updateBattleStats()` → Use BattleCache.updateBattleUnsafe()

### Phase 5: Testing & Validation

**Verify:**
- No direct `getDatabase()` calls in battle*.ts files
- All tests passing (especially battle tests)
- Lock ordering correct (no deadlocks)
- Cache consistency maintained
- Background persistence working

**Add new tests:**
- BattleCache initialization
- Battle CRUD operations
- Lock acquisition patterns
- Dirty battle persistence
- Active battle filtering

### Phase 6: Cleanup

**Remove:**
- Direct DB access imports from battle files
- Duplicate helper functions (updateUserBattleState)
- TODO comments about cache bypasses

**Update documentation:**
- building-blocks-cache-systems.md
- Technical debt file

---

## Lock Pattern Examples

### Creating Battle (initiateBattle):
```typescript
async createBattle(attackerId: number, attackeeId: number): Promise<Battle> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  
  // Acquire world write (need ship positions)
  const worldCtx = await cacheManager.acquireWorldWrite(ctx);
  try {
    // Acquire user lock (need both users)
    const userCtx = await cacheManager.acquireUserLock(worldCtx);
    try {
      // Get users from TypedCacheManager
      const attacker = cacheManager.getUserUnsafe(attackerId, userCtx);
      const attackee = cacheManager.getUserUnsafe(attackeeId, userCtx);
      
      // Get world from TypedCacheManager
      const world = cacheManager.getWorldUnsafe(worldCtx);
      
      // Acquire battle lock for battle creation
      const battleCtx = await userCtx.acquireWrite(BATTLE_LOCK);
      try {
        const battle = this.createBattleObject(...);
        this.setBattleUnsafe(battle);
        this.dirtyBattles.add(battle.id);
      } finally {
        battleCtx.dispose();
      }
      
      // Update users via TypedCacheManager
      attacker.inBattle = true;
      attacker.current_battle_id = battle.id;
      cacheManager.updateUserUnsafe(attacker, userCtx);
      
    } finally {
      userCtx.dispose();
    }
  } finally {
    worldCtx.dispose();
  }
}
```

### Updating Battle (processBattleRound):
```typescript
async updateBattle(battleId: number, updates: Partial<Battle>): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const userCtx = await cacheManager.acquireUserLock(ctx);
  try {
    const battleCtx = await userCtx.acquireWrite(BATTLE_LOCK);
    try {
      const battle = this.getBattleUnsafe(battleId);
      if (battle) {
        Object.assign(battle, updates);
        this.updateBattleUnsafe(battle);
      }
    } finally {
      battleCtx.dispose();
    }
  } finally {
    userCtx.dispose();
  }
}
```

### Ending Battle (resolveBattle):
```typescript
async endBattle(battleId: number, winnerId: number): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  
  const worldCtx = await cacheManager.acquireWorldWrite(ctx);
  try {
    const userCtx = await cacheManager.acquireUserLock(worldCtx);
    try {
      const battleCtx = await userCtx.acquireWrite(BATTLE_LOCK);
      try {
        // Get battle
        const battle = this.getBattleUnsafe(battleId);
        battle.battleEndTime = Date.now();
        battle.winnerId = winnerId;
        this.updateBattleUnsafe(battle);
        
        // Persist immediately
        await this.persistBattle(battle);
        
        // Remove from active cache
        this.battles.delete(battleId);
        this.activeBattlesByUser.delete(battle.attacker_id);
        this.activeBattlesByUser.delete(battle.attackee_id);
        
      } finally {
        battleCtx.dispose();
      }
      
      // Update users via TypedCacheManager
      const winner = cacheManager.getUserUnsafe(winnerId, userCtx);
      winner.inBattle = false;
      winner.current_battle_id = null;
      cacheManager.updateUserUnsafe(winner, userCtx);
      
    } finally {
      userCtx.dispose();
    }
  } finally {
    worldCtx.dispose();
  }
}
```

---

## Effort Estimate

**Total:** 8-12 hours

**Breakdown:**
- Phase 1 (BattleCache infrastructure): 3-4 hours
- Phase 2 (battleService refactor): 2-3 hours  
- Phase 3 (battleScheduler): 1 hour
- Phase 4 (battleRepo refactor): 2-3 hours
- Phase 5 (testing): 1-2 hours
- Phase 6 (cleanup): 1 hour

---

## Success Criteria

✅ Zero direct `getDatabase()` calls in battle*.ts files  
✅ All 331+ tests passing  
✅ No compilation errors  
✅ BattleCache properly delegates User/World to TypedCacheManager  
✅ Background persistence working (30s interval)  
✅ Lock ordering correct (no deadlocks)  
✅ Cache consistency maintained  
✅ Documentation updated
- Prevents race conditions
- User values updated only at battle end
- Matches current implementation

### Q6: Locking Strategy for Background Scheduler
**Issue:** Scheduler processes battles every 1 second  
**Options:**
- A) Acquire locks per battle (many small lock operations)
- B) Acquire single user lock, process all battles for that user
- C) Acquire world lock, process all battles

**Recommendation:** Option A (per-battle locks)  
**Reason:**
- Minimizes lock contention
- Other operations (movement, collection) can proceed
- Battles are independent

### Q7: Battle Persistence Frequency
**Issue:** Battles update frequently (every weapon shot)  
**Options:**
- A) Background persistence every 30s (matches current pattern)
- B) More frequent persistence for battles (every 5s)
- C) Immediate persistence on battle end only

**Recommendation:** Option A (30s background)  
**Reason:**
- Consistent with other caches
- Battle state can be reconstructed from log if needed
- Only battle end is critical (persist immediately)

### Q8: Error Handling - Battle Corruption
**Issue:** What if battle cache becomes inconsistent with DB?  
**Options:**
---

## Database Schema

**Current `battles` table:**
```sql
CREATE TABLE battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_id INTEGER NOT NULL,
  attackee_id INTEGER NOT NULL,
  battle_start_time INTEGER NOT NULL,
  battle_end_time INTEGER,
  winner_id INTEGER,
  loser_id INTEGER,
  attacker_weapon_cooldowns TEXT NOT NULL,  -- JSON
  attackee_weapon_cooldowns TEXT NOT NULL,  -- JSON
  attacker_start_stats TEXT NOT NULL,       -- JSON (BattleStats)
  attackee_start_stats TEXT NOT NULL,       -- JSON (BattleStats)
  attacker_end_stats TEXT,                  -- JSON (BattleStats)
  attackee_end_stats TEXT,                  -- JSON (BattleStats)
  battle_log TEXT NOT NULL                  -- JSON (BattleEvent[])
)
```

**No schema changes needed!** ✅

---

## Migration Strategy

### Step 1: Create BattleCache Infrastructure
- Create `src/lib/server/BattleCache.ts`
- Singleton pattern with getInstance/resetInstance
- BATTLE_LOCK definition (level 6)
- Storage: battles Map, activeBattlesByUser Map, dirtyBattles Set
- Initialize method with DB connection
- Background persistence timer (30s interval)

### Step 2: Add High-Level API
- `loadBattleIfNeeded()`
- `getOngoingBattleForUser()`
- `getActiveBattles()`
- `createBattle()`
- `endBattle()`

### Step 3: Refactor battleRepo.ts
- Convert static class to exported functions
- Replace DB access with BattleCache calls
- One method at a time with tests

### Step 4: Refactor battleService.ts
- Remove DB bypass functions
- Delegate to TypedCacheManager for User/World
- Keep battle logic functions

### Step 5: Refactor battleScheduler.ts
- Use BattleCache.getActiveBattles()
- Remove duplicate updateUserBattleState()

### Step 6: Verify & Cleanup
- Run all tests
- Remove getDatabase() imports
- Update documentation

---

## Effort Estimate

**Total:** 8-12 hours

**Breakdown:**
- Phase 1 (BattleCache infrastructure): 3-4 hours
- Phase 2 (battleService refactor): 2-3 hours
- Phase 3 (battleScheduler): 1 hour
- Phase 4 (battleRepo refactor): 2-3 hours
- Phase 5 (testing): 1-2 hours
- Phase 6 (cleanup): 1 hour

---

## Success Criteria

✅ Zero direct `getDatabase()` calls in battle*.ts files  
✅ All 331+ tests passing  
✅ No compilation errors  
✅ BattleCache properly delegates User/World to TypedCacheManager  
✅ Background persistence working (30s interval)  
✅ Lock ordering correct (no deadlocks)  
✅ Cache consistency maintained  
✅ Documentation updated

---

## References

- **Existing Caches:** TypedCacheManager (User, World), MessageCache
- **Lock System:** IronGuard Pure implementation (completed Oct 2025)
- **Architecture Docs:** `doc/architecture/building-blocks-cache-systems.md`
- **Technical Debt:** Tracked in `TechnicalDebt.md`
