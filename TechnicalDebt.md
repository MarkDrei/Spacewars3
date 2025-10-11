# Technical Debt

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

