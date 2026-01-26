# Cache System Unification Restoration Summary

## Overview

This document summarizes the restoration of Cache System Unification changes from the `feat/betterDamage` branch, adapted for PostgreSQL.

## Commits Restored

From feat/betterDamage branch:
- `7ed0d25`: "more global this used"
- `e19bbcf`: "Unify cache implementations to extend Cache base class properly"
- `40d1211`: "Fix: flushAllToDatabaseWithContext should flush message cache, not shutdown"
- `5012438`: "cleanup battle cache inti and lifecycle"

## Files Modified

### 1. src/lib/server/caches/Cache.ts

**Changes:**
- Added `persistenceTimer: NodeJS.Timeout | null` property
- Added `shutdown()` method that calls `stopBackgroundPersistence()` and `flushAllToDatabase()`
- Added abstract `flushAllToDatabase()` method
- Added abstract `startBackgroundPersistence()` method
- Added `stopBackgroundPersistence()` method
- Removed old `isTestMode` and `shouldEnableBackgroundPersistence()` methods

**Pattern:**
```typescript
export abstract class Cache {
  protected persistenceTimer: NodeJS.Timeout | null = null;
  
  public async shutdown(): Promise<void> {
    this.stopBackgroundPersistence();
    await this.flushAllToDatabase();
  }
  
  protected abstract flushAllToDatabase(): Promise<void>;
  protected abstract startBackgroundPersistence(): void;
  protected stopBackgroundPersistence(): void { /* ... */ }
}
```

### 2. src/lib/server/battle/BattleCache.ts

**Changes:**
- Changed singleton storage to `globalThis.battleCacheInstance`
- Removed duplicate `persistenceTimer` property (now inherited from Cache)
- Renamed `startPersistence()` → `startBackgroundPersistence()` (protected)
- Added `flushAllToDatabase()` method (protected)
- Updated `shutdown()` to call base class methods
- Simplified `resetInstance()` to just clear instance
- Removed isTestMode immediate persistence logic
- Kept DatabaseConnection (PostgreSQL)

**Key Pattern:**
```typescript
private static get instance(): BattleCache | null {
  return globalThis.battleCacheInstance || null;
}

protected startBackgroundPersistence(): void { /* ... */ }
protected async flushAllToDatabase(): Promise<void> { /* ... */ }
```

### 3. src/lib/server/messages/MessageCache.ts

**Changes:**
- Changed singleton storage to `globalThis.messageCacheInstance`
- Removed duplicate `persistenceTimer` property
- Changed `startBackgroundPersistence()` to protected
- Changed `stopBackgroundPersistence()` to protected
- Added `flushAllToDatabase()` method (protected)
- Updated `shutdown()` to call `flushAllToDatabase()`
- Simplified `resetInstance()` to just clear instance
- Removed isTestMode immediate persistence logic

**Key Pattern:**
```typescript
protected async flushAllToDatabase(): Promise<void> {
  if (this.dirtyUsers.size === 0) return;
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
    await this.flushToDatabaseWithLock(messageContext);
  });
}
```

### 4. src/lib/server/user/userCache.ts

**Changes:**
- Changed singleton storage to `globalThis.userCacheInstance` (was `userWorldCacheInstance`)
- Removed duplicate `persistenceTimer` property
- Added `flushAllToDatabase()` wrapper (protected, implements abstract method)
- Added `flushAllToDatabaseWithContext()` for when caller already holds USER_LOCK (public)
- **CRITICAL FIX**: Changed to call `messageCache.flushToDatabase()` NOT `messageCache.shutdown()`
- Updated `shutdown()` to properly orchestrate cache shutdown
- Changed `startBackgroundPersistence()` to protected
- Changed `stopBackgroundPersistence()` to protected
- Simplified `resetInstance()` to just clear instance
- Removed isTestMode immediate persistence logic

**Key Pattern:**
```typescript
// Public wrapper that acquires lock
protected async flushAllToDatabase(): Promise<void> {
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
    await this.flushAllToDatabaseWithContext(userContext);
  });
}

// For callers who already hold USER_LOCK
async flushAllToDatabaseWithContext(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
  // Flush users
  if (this.dirtyUsers.size > 0) {
    await this.persistDirtyUsers(context);
  }
  
  // Flush world cache
  const worldCache = this.getWorldCacheOrNull();
  if (worldCache) {
    await worldCache.flushToDatabase();
  }
  
  // Flush message cache (NOT shutdown!)
  const messageCache = await this.getMessageCache();
  if (messageCache) {
    await messageCache.flushToDatabase(context);
  }
}

// Shutdown orchestration
async shutdown(): Promise<void> {
  this.stopBackgroundPersistence();
  
  // Flush users
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
    if (this.dirtyUsers.size > 0) {
      await this.persistDirtyUsers(userContext);
    }
  });
  
  // Shutdown world cache
  const worldCache = this.getWorldCacheOrNull();
  if (worldCache) {
    await worldCache.flushToDatabase();
    await worldCache.shutdown();
  }
  
  // Shutdown message cache (each cache manages its own locks)
  const messageCache = await this.getMessageCache();
  if (messageCache) {
    await messageCache.shutdown();
  }
}
```

### 5. src/lib/server/world/worldCache.ts

**Changes:**
- Singleton storage already used `globalThis.worldCacheInstance`
- Removed duplicate `persistenceTimer` property
- Changed `startBackgroundPersistence()` to protected
- Changed `stopBackgroundPersistence()` to protected
- Added `flushAllToDatabase()` method (protected)
- Updated `shutdown()` to call base class methods
- Simplified `resetInstance()` to just clear instance and stop persistence
- Kept DatabaseConnection (PostgreSQL)

**Key Pattern:**
```typescript
protected async flushAllToDatabase(): Promise<void> {
  await this.flushToDatabase();
}
```

### 6. Test and API Updates

**Files:**
- src/__tests__/cache/user-persistence.test.ts
- src/__tests__/integration/defense-value-persistence.test.ts
- src/app/api/admin/database/route.ts

**Changes:**
- Updated calls from `flushAllToDatabase(context)` → `flushAllToDatabaseWithContext(context)`
- This is necessary because `flushAllToDatabase()` is now protected (implements abstract method)
- The public method `flushAllToDatabaseWithContext()` is for callers who already hold USER_LOCK

## PostgreSQL Adaptations

All SQLite-specific code was properly adapted to PostgreSQL:

1. **Type Changes:**
   - `sqlite3.Database` → `DatabaseConnection` (custom type from src/lib/server/database.ts)

2. **Query Syntax:**
   - All queries use PostgreSQL parameterized syntax ($1, $2, etc.)
   - All database operations use async/await with pg Pool

3. **Test Isolation:**
   - Transaction-based test isolation (withTransaction helper)
   - Replaces old isTestMode immediate persistence pattern
   - All database writes happen within transaction scope in tests

## Key Design Patterns

### 1. Singleton Storage

All caches use `globalThis` with consistent naming:
```typescript
declare global {
  var cacheNameInstance: CacheType | null;
}

private static get instance(): CacheType | null {
  return globalThis.cacheNameInstance || null;
}

private static set instance(value: CacheType | null) {
  globalThis.cacheNameInstance = value;
}
```

### 2. Abstract Methods

Base class defines contract:
```typescript
protected abstract flushAllToDatabase(): Promise<void>;
protected abstract startBackgroundPersistence(): void;
```

Each cache implements according to its needs:
- Acquires necessary locks internally
- Handles its own persistence logic
- Can coordinate with other caches if needed

### 3. Lifecycle Management

Standard pattern:
1. `static async initialize(...)` - Sets up cache
2. `async shutdown()` - Flushes and stops timers
3. `static resetInstance()` - Clears singleton (for testing)

**Important:** `resetInstance()` does NOT call `shutdown()` - callers must handle shutdown separately if needed.

### 4. Lock Management

Each cache manages its own locking:
- `flushAllToDatabase()` - Acquires locks internally
- `flushAllToDatabaseWithContext()` - For callers who already hold locks
- `shutdown()` - Acquires locks as needed

### 5. Cache Coordination

UserCache coordinates with other caches:
- During flush: Calls `flushToDatabase()` on WorldCache and MessageCache
- During shutdown: Calls `shutdown()` on WorldCache and MessageCache
- Each cache handles its own locking internally

## Testing Considerations

### Transaction Isolation

Tests use `withTransaction()` helper which:
- Wraps test body in a transaction
- Automatically rolls back after test
- Ensures perfect test isolation
- Replaces old isTestMode immediate persistence

### Background Persistence

In test mode:
- Background persistence timers still run (no special test mode)
- Transaction isolation ensures clean state
- Tests can manually call flush methods when needed

### Cache Lifecycle

Tests should:
1. Call `initializeIntegrationTestServer()` to set up
2. Call `shutdownIntegrationTestServer()` to tear down
3. Use `resetInstance()` if needed between tests

## Verification

### Compilation
✅ TypeScript compilation successful with no errors

### Linting
✅ ESLint passes with only minor unrelated warnings:
- Unused variables in tests (pre-existing)
- Unused parameter in MessageCache (code review comment variable)

### Testing
⏳ Tests require database connectivity (will run in CI pipeline)

## Migration Notes

If you need to update cache-related code:

1. **Don't call protected methods externally:**
   - Use public wrappers like `flushAllToDatabaseWithContext()` instead of `flushAllToDatabase()`

2. **Each cache manages its own locks:**
   - Don't pass locks to `shutdown()` - it handles locking internally
   - Use context-aware methods when you already hold locks

3. **Cache coordination:**
   - UserCache coordinates with WorldCache and MessageCache
   - Use `flushToDatabase()` for flush operations, not `shutdown()`
   - Only call `shutdown()` when actually shutting down

4. **Test isolation:**
   - Use `withTransaction()` wrapper for all integration tests
   - Don't rely on isTestMode - transaction isolation handles everything

## Code Review Comments

### Addressed
✅ Fixed comment indentation in Cache.ts

### False Positive
❌ "MessageCache.shutdown() outside lock context" - This is correct by design. Each cache acquires its own locks internally during shutdown. MessageCache.shutdown() internally acquires MESSAGE_LOCK, so calling it from outside a lock context is the proper pattern.

## Related Documentation

- `.github/instructions/TESTING.instructions.md` - Test isolation strategy
- `src/__tests__/helpers/testServer.ts` - Integration test helpers
- `src/__tests__/helpers/transactionHelper.ts` - Transaction wrapper

## Future Work

This is Phase 1 of the cache restoration. Future phases may include:
- Additional cache unification patterns from feat/betterDamage
- Further lifecycle improvements
- Enhanced error handling
- Performance optimizations
