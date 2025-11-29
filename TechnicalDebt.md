# Technical Debt

## User Object - Automatic Dirty State Tracking

**Priority**: Medium

### Idea

Currently, marking a user as dirty for cache persistence requires explicit calls to cache manager methods after mutating the user object. This is error-prone and can lead to missed updates if callers forget to mark the user as dirty.

**Proposed Solution:**
- Inject a callback into each User object that marks it as dirty in the cache when its state changes.
- Mutating methods and setters in the User class would invoke this callback automatically.
- This ensures that any change to a cached User is tracked for persistence, without requiring manual dirty marking by callers.

**Benefits:**
- Reduces boilerplate and risk of missed updates
- Centralizes dirty state tracking in the domain model
- Makes cache management more robust and maintainable

**Effort Estimate:**
- Medium: Requires refactoring User class and cache manager

**Related Files:**
- src/lib/server/world/user.ts
- src/lib/server/world/userWorldCache.ts

## Battle System - Cache Bypass Issue

**Priority**: High  
**Added**: 2025-10-11  
**Component**: Battle System (battleScheduler.ts, battleService.ts)

### Problem

The battle system currently bypasses the TypedCacheManager and writes directly to the database in multiple places:

1. **Battle State Updates** (`battleScheduler.ts`):
   - `updateUserBattleState()` writes directly to DB via raw SQL
   - Then tries to refresh cache as a workaround
   - Violates single-source-of-truth principle

2. **Battle Creation** (`battleService.ts`):
   - `initiateBattle()` writes `in_battle` flags directly to DB
   - Updates ship speeds directly via `setShipSpeed()`
   - Creates battles in DB without going through cache

3. **Battle Resolution** (`battleService.ts`):
   - `resolveBattle()` updates defense values directly in DB
   - Teleports ships directly
   - Updates battle state without cache coordination

### Architecture Violation

The TypedCacheManager is designed to be the **single source of truth** with these principles:
- All data access should go through the cache manager
- Cache manager handles DB synchronization via background persistence
- Direct DB writes create synchronization issues and race conditions
- Tests in `typedCacheManager.test.ts` verify proper lock ordering

### Current Workaround

We're using a "write-through" pattern with manual cache refresh:
```typescript
// 1. Write to DB directly
await db.run('UPDATE users SET in_battle = ?...');

// 2. Force cache refresh
await cacheManager.loadUserFromDbUnsafe(userId);
cacheManager.setUserUnsafe(freshUser);
```

This works but is fragile and defeats the purpose of the cache architecture.

### Proper Solution

Refactor battle system to use TypedCacheManager APIs:

1. **Update Users Through Cache**:
   ```typescript
   // Instead of direct DB writes:
   await cacheManager.withUserLock(ctx, async (userCtx) => {
     const user = cacheManager.getUserUnsafe(userId, userCtx);
     user.inBattle = true;
     user.currentBattleId = battleId;
     cacheManager.setUserUnsafe(user, userCtx);
     cacheManager.markUserDirty(userId);
   });
   ```

2. **Battle Data in Cache**:
   - Add battle cache to TypedCacheManager
   - Battle updates go through cache
   - Background persistence handles DB sync

3. **Atomic Operations**:
   - Use proper lock ordering (see `typedCacheManager.test.ts`)
   - Ensure cache-management → world → user → database ordering
   - Avoid deadlocks with compile-time safety

### Impact

**Current Issues**:
- Race conditions between cache and DB
- Cache staleness after battle state changes
- Violates architectural principles
- Makes debugging harder

**Benefits of Fix**:
- Single source of truth
- Proper transactional semantics
- Better testability
- Follows existing lock ordering patterns

### Effort Estimate

- **Medium-High**: Requires refactoring battle system
- Need to extend TypedCacheManager with battle cache support
- Update all battle operations to use cache APIs
- Add tests for battle cache operations

### Related Files

- `src/lib/server/battleScheduler.ts` - Direct DB writes in updateUserBattleState
- `src/lib/server/battleService.ts` - Direct DB writes throughout
- `src/lib/server/typedCacheManager.ts` - Needs battle cache support
- `src/__tests__/lib/typedCacheManager.test.ts` - Lock ordering tests

### Workarounds Implemented

1. **Defense Values Display**: Modified `HomePageClient.tsx` to show battle stats when in battle instead of regenerating user values
2. **Cache Refresh**: Manual cache refresh after DB updates to prevent stale data

---

## Defense Value Regeneration in Attack Route

**Priority**: Low  
**Added**: 2025-10-28  
**Component**: Attack API Route

### Problem

The attack route (`src/app/api/attack/route.ts`) was temporarily modified to call `updateDefenseValues()` and write the results back to cache before initiating battle. This violates the separation of concerns:

- Defense value regeneration should be handled by the **world loop** (periodic background process)
- API routes should not perform world state updates
- This creates duplicate logic and potential race conditions

### Architecture Violation

The world loop is designed to handle all periodic updates including:
- Ship movement
- Defense value regeneration
- Resource regeneration
- Other time-based mechanics

API routes should only:
- Validate requests
- Initiate actions (like battles)
- Return responses

Mixing these concerns makes the system harder to maintain and reason about.

### Temporary Fix Applied

The defense value update was removed from the attack route. The world loop should handle defense regeneration before battles are initiated.

### Proper Solution

Ensure the world loop runs frequently enough to keep defense values up-to-date:
1. Verify world loop interval is appropriate (currently runs every tick)
2. Consider adding "ensure up-to-date" logic in battle initiation that triggers world loop if needed
3. Document clearly that defense values are the responsibility of world loop, not API routes

### Related Files

- `src/app/api/attack/route.ts` - Attack API route
- `src/lib/server/worldLoop.ts` - World update loop (if exists)
- `src/lib/server/user.ts` - User class with `updateDefenseValues()` method

---

## World Persistence - Missing Dirty State Tracking

**Priority**: Medium  
**Added**: 2025-11-19  
**Component**: World Persistence (world.ts, userWorldCache.ts)

### Problem

The `saveCallback` passed to the `World` constructor is never triggered. The `World.save()` method exists but is not called in any methods that modify the world state (e.g., `collected()`, `updateSpaceObject()`, `updatePhysics()`). This means world modifications are not marked as dirty in the cache, preventing automatic persistence.

### Architecture Violation

The cache manager relies on dirty flags to know when to persist data:
- World changes (e.g., object positions, additions/removals) should mark `worldDirty = true`
- Background persistence checks this flag to decide whether to save
- Without it, world state drifts out of sync with the database

### Current Behavior

- World loads with `worldDirty = false`
- Modifications occur but don't set the flag
- Persistence skips the world, leading to lost updates

### Proposed Solution

Modify `World` methods to call `await this.saveCallback(this);` after state changes:
- `collected()`: After removing and spawning objects
- `updateSpaceObject()`: After updating object properties (make async if needed)
- `updatePhysics()`: If position changes require immediate persistence (consider batching for performance)

This ensures the cache is notified of changes and can persist them.

### Benefits

- Automatic persistence of world changes
- Prevents data loss from unpersisted modifications
- Aligns with the callback pattern already in place

### Effort Estimate

- **Medium**: Requires updating World methods and ensuring async handling

### Related Files

- `src/lib/server/world/world.ts` - World class with save() method
- `src/lib/server/world/userWorldCache.ts` - Cache manager with worldDirty flag

