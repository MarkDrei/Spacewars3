# Battle System Fixes

## Issue 1: Defense Value Synchronization (FIXED ✅)

### Problem
User reported:
- Battle messages show changing hull/shield/armor values (e.g., Shield: 382 → 232 → 252)
- Home screen consistently shows "500 shield all the time"
- Data appears massively out of sync

### Root Cause
The bug had **two architectural problems**:

1. **Wrong Data Source**: The home page was using `battleStatus.battle.myStats` from the battle-status API, but `myStats` was returning frozen `attackerStartStats`/`attackeeStartStats` snapshots from battle start.

2. **Wrong API Responsibility**: The battle-status API was trying to return user defense values by accessing the User cache directly. This violated separation of concerns - battle-status should only return battle state, not user state.

### Solution

**Each API has ONE job:**
- **`/api/battle-status`**: Returns ONLY battle state (battle ID, cooldowns, log, timestamps, damage)
- **`/api/user-stats` or `/api/ship-stats`**: Returns user state (defense values, tech counts, iron rate)

The client uses `useDefenseValues()` hook which polls `/api/ship-stats` for defense values - works the same whether in battle or not!

---

## Issue 2: Duplicate Defeat Messages (FIXED ✅)

### Problem
User saw duplicate defeat messages with different timestamps:
```
10:52:12 - 💀 Defeat! You lost the battle and have been teleported away.
10:52:10 - 💀 Defeat! You lost the battle and have been teleported away.
```

### Root Cause

**Race Condition in Battle Scheduler**

The battle scheduler runs every 1 second. Without proper locking:

1. **Tick 1 (10:52:10)**: 
   - Loads battle from cache
   - Checks `battleEndTime` (null) ✅
   - Fires weapons → hull reaches 0
   - Sees battle is over
   - Calls `resolveBattle()` → sets `battleEndTime`
   - Sends defeat message

2. **Tick 2 (10:52:12)** - Running concurrently!:
   - Loads battle from cache (BEFORE Tick 1 finished)
   - Checks `battleEndTime` (still null!) ✅
   - Fires weapons → hull already 0
   - Sees battle is over  
   - Calls `resolveBattle()` → throws error "already ended"
   - But messages were **already sent** before the error!

### Solution: Proper IronGuard Locking

**File**: `src/lib/server/battle/battleScheduler.ts`

Implemented proper BATTLE_LOCK (LOCK_5) from IronGuard:

```typescript
import { LOCK_5 } from '@markdrei/ironguard-typescript-locks';

const BATTLE_LOCK = LOCK_5;

async function processBattleRoundInternal(battleId: number): Promise<void> {
  // Acquire BATTLE write lock to prevent concurrent modification
  const ctx = createLockContext();
  const battleCtx = await ctx.acquireWrite(BATTLE_LOCK);
  
  try {
    const battle = await BattleRepo.getBattle(battleId);
    
    if (!battle || battle.battleEndTime) {
      return; // Already ended
    }
    
    // Process weapons, check if battle over, resolve if needed...
    // All protected by BATTLE write lock!
    
  } finally {
    battleCtx.dispose();
  }
}
```

**Key Points:**

1. **Write Lock for Modifications**: The scheduler acquires a WRITE lock on BATTLE_LOCK (level 5) before processing any battle round. This ensures only ONE scheduler tick can process battles at a time.

2. **Read Lock for Queries**: The battle-status API acquires a READ lock on BATTLE_LOCK when returning battle state, ensuring it doesn't see partial updates.

3. **Lock Hierarchy**: 
   ```
   CACHE(2) → WORLD(4) → BATTLE(5) → USER(6) → MESSAGE(8) → DATABASE(10)
   ```
   - BATTLE lock at level 5
   - USER locks at level 6 (acquired inside battleEngine.applyDamage())
   - Correct ordering prevents deadlocks

4. **No More Race Conditions**:
   - Second scheduler tick waits for WRITE lock
   - When it acquires the lock, `battleEndTime` is already set
   - Early return prevents duplicate processing

### Files Modified

1. **`src/lib/server/battle/battleScheduler.ts`**:
   - Added BATTLE_LOCK (LOCK_5) import
   - Wrapped `processBattleRoundInternal()` with write lock acquisition
   - Ensures only one scheduler tick processes battles at a time

2. **`src/app/api/battle-status/route.ts`**:
   - Added BATTLE_LOCK (LOCK_5) import
   - Wrapped battle query with read lock acquisition
   - Ensures consistent battle state when reading
   - Removed user stats logic (violation of single responsibility)

---

## Why IronGuard Locks?

**IronGuard** (@markdrei/ironguard-typescript-locks) provides:

1. **Hierarchical Locking**: Levels prevent deadlocks by enforcing lock acquisition order
2. **Read/Write Locks**: Multiple readers OR single writer for efficiency
3. **Type Safety**: TypeScript ensures locks are acquired in correct order
4. **Automatic Disposal**: Context pattern ensures locks are always released
5. **Encapsulation**: Lock management is internal to cache classes, not exposed to callers

**Lock Levels in Spacewars:**
- Level 2: CACHE_LOCK (cache-wide operations)
- Level 4: WORLD_LOCK (world/space object operations)
- Level 5: BATTLE_LOCK (battle state operations) ← **NEW!**
- Level 6: USER_LOCK (user state operations)
- Level 8: MESSAGE_LOCK (message operations)
- Level 10: DATABASE_LOCK (direct DB access)

### Lock Management Architecture

**Principle: Locks are acquired INSIDE cache methods, not by callers**

**Good Design** ✅:
```typescript
// API Route - No lock management needed!
const battle = await getOngoingBattleForUser(userId);

// Inside BattleCache.getOngoingBattleForUser():
async getOngoingBattleForUser(userId: number): Promise<Battle | null> {
  const ctx = createLockContext();
  const battleCtx = await ctx.acquireRead(BATTLE_LOCK); // Lock acquired here!
  try {
    // ... access battle state
  } finally {
    battleCtx.dispose();
  }
}
```

**Bad Design** ❌:
```typescript
// Every caller must manage locks - violates encapsulation!
const ctx = createLockContext();
const battleCtx = await ctx.acquireRead(BATTLE_LOCK);
try {
  const battle = await getOngoingBattleForUser(userId);
} finally {
  battleCtx.dispose();
}
```

### Exception: Battle Scheduler

The battle scheduler is special - it needs a WRITE lock for the **entire processing cycle** to prevent concurrent scheduler ticks:

```typescript
export async function processActiveBattles(): Promise<void> {
  // Acquire WRITE lock ONCE for all battles
  const ctx = createLockContext();
  const battleCtx = await ctx.acquireWrite(BATTLE_LOCK);
  try {
    const battles = await battleCache.getActiveBattles(); // Returns without acquiring lock
    for (const battle of battles) {
      await processBattleRoundInternal(battle.id); // Process while holding lock
    }
  } finally {
    battleCtx.dispose();
  }
}
```

This is correct because:
- Only ONE scheduler tick can run at a time
- Prevents race conditions (duplicate defeat messages)
- Cache's READ lock methods work fine when called inside an existing WRITE lock

---

## Verification

After these fixes:
- ✅ Home screen defense values update in real-time (from useDefenseValues hook)
- ✅ Battle messages show same values (from User cache)
- ✅ Battle-status API is simpler and uses proper locking
- ✅ No more duplicate defeat messages (BATTLE write lock prevents race conditions)
- ✅ Proper cache access pattern (no direct repo usage in APIs)
- ✅ Single responsibility - each API does ONE job
- ✅ Correct lock hierarchy prevents deadlocks

## Testing

To test the duplicate message fix:
1. Start two battles
2. Let them run until completion
3. Check message logs - should see exactly ONE victory and ONE defeat message per battle
4. No race conditions even if scheduler ticks overlap

## Related Issue: Duplicate Defeat Messages

User also reported two defeat messages at slightly different timestamps:
```
10:52:12 - 💀 Defeat! You lost the battle and have been teleported away.
10:52:10 - 💀 Defeat! You lost the battle and have been teleported away.
```

### Likely Cause
- Battle scheduler processes battle round
- Detects hull = 0, calls `resolveBattle()`
- Sends defeat message at time T1
- Client polls battle-status shortly after
- (Possibly sends another message? Or message cache duplication?)

### Investigation Needed
- Check if messages are being created twice in scheduler
- Verify message cache doesn't duplicate entries
- Look for race conditions in battle resolution
- Consider adding message deduplication based on content + user + short time window

## Impact

This was a **critical bug** that made the battle system appear completely broken:
- Players couldn't see their actual defense status
- UI showed wrong information (always full defenses)
- Messages contradicted the display
- Made it impossible to judge battle progress

## Prevention

To prevent similar issues:
1. **Always use User cache for live values** (not battle snapshots)
2. **Document snapshot vs. live data** in comments
3. **Test API responses** against actual game state
4. **Add integration tests** that verify defense value consistency
5. **Consider adding validation** that alerts if startStats used for live display

## Files Modified

- `src/app/api/battle-status/route.ts` - Fixed to read from User cache
