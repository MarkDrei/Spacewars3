# IronGuard Migration Plan

## Overview
This document outlines the plan to replace the custom `typedLocks.ts` system with the IronGuard library (`@markdrei/ironguard-typescript-locks`). The migration will maintain all existing deadlock prevention guarantees while leveraging IronGuard's more robust and battle-tested implementation.

## Current Lock Hierarchy Analysis

### Existing Lock Levels (Phase Out)
```typescript
// Current custom system (0-3 with decimals)
CacheLevel = 0           // Cache management operations
WorldLevel = 1           // World state operations  
UserLevel = 2            // User-specific operations
MessageReadLevel = 2.4   // Message read operations
MessageWriteLevel = 2.5  // Message write operations (CONSOLIDATE WITH READ)
DatabaseLevel = 3        // Direct database operations
```

### New IronGuard Mapping (Even Numbers with Gaps)
```typescript
// New IronGuard system (LOCK_2, LOCK_4, etc.)
LOCK_2  = CacheLevel      // Cache management operations
LOCK_4  = WorldLevel      // World state operations
LOCK_6  = UserLevel       // User-specific operations  
LOCK_8  = MessageLevel    // Message operations (both read/write using IronGuard's natural read/write support)
LOCK_10 = DatabaseLevel   // Direct database operations (moved up from LOCK_12)
```

**Key Changes:**
- **Consolidated MessageLevel:** Single LOCK_8 for both read and write operations
- **IronGuard Native Read/Write:** Use `acquireRead(LOCK_8)` and `acquireWrite(LOCK_8)` on same lock
- **Simplified Hierarchy:** Reduced from 6 to 5 distinct lock levels
- **Even Numbers:** Still provides room for future locks (LOCK_3, LOCK_5, LOCK_7, LOCK_9, etc.)

## Current Usage Analysis

### Files Using Typed Locks
1. **Core Implementation:**
   - `src/lib/server/typedLocks.ts` - Main lock implementation (TO BE REPLACED)
   - `src/lib/server/typedCacheManager.ts` - Heavy lock usage (cache, world, user, message, db locks)

2. **API Endpoints (12 files):**
   - `src/app/api/user-stats/route.ts` - Uses cache, world, user locks
   - `src/app/api/trigger-research/route.ts` - Uses cache, world, user locks
   - `src/app/api/navigate/route.ts` - Uses cache, world, user locks  
   - `src/app/api/harvest/route.ts` - Uses cache, world, user locks
   - `src/app/api/world/route.ts` - Uses cache lock
   - `src/app/api/techtree/route.ts` - Uses cache lock
   - `src/app/api/ship-stats/route.ts` - Uses cache lock
   - `src/app/api/navigate-typed/route.ts` - Uses cache lock
   - `src/app/api/collect-typed/route.ts` - Uses cache lock
   - Plus other API routes

3. **Repository Layer:**
   - `src/lib/server/worldRepo.ts` - Uses createEmptyContext
   - `src/lib/server/userRepo.ts` - Uses createEmptyContext
   - `src/lib/server/battleScheduler.ts` - Uses createEmptyContext

4. **Test Files (8 files):**
   - Comprehensive test coverage in `src/__tests__/lib/`
   - Tests for TypedMutex, TypedReadWriteLock, type safety
   - Integration tests with cache manager

### Lock Usage Patterns

#### 1. Simple Mutex Locks
```typescript
// Current pattern
private cacheManagementLock = new TypedMutex('cache-mgmt', 0 as CacheLevel);
await this.cacheManagementLock.acquire(emptyCtx, async (ctx) => {
  // Critical section
});

// IronGuard equivalent  
const ctx = await createLockContext().acquireWrite(LOCK_2);
// Critical section
ctx.dispose();
```

#### 2. ReadWrite Locks
```typescript
// Current pattern  
private worldLock = new TypedReadWriteLock('world', 1 as WorldLevel, 1 as WorldLevel);
await this.worldLock.read(ctx, async (readCtx) => { /* read */ });
await this.worldLock.write(ctx, async (writeCtx) => { /* write */ });

// IronGuard equivalent
const readCtx = await createLockContext().acquireRead(LOCK_4);
const writeCtx = await createLockContext().acquireWrite(LOCK_4);
```

#### 3. Lock Ordering/Chaining
```typescript
// Current pattern
const emptyCtx = createEmptyContext();
await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
  await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
    // Nested operations
  });
});

// IronGuard equivalent
const ctx = await createLockContext()
  .acquireWrite(LOCK_6)  // User level
  .then(c => c.acquireRead(LOCK_12)); // Database level
// Operations
ctx.dispose();
```

## Migration Plan

### Phase 1: Infrastructure Setup ✅
- [x] Install `@markdrei/ironguard-typescript-locks` 
- [x] Analyze current usage patterns

### Phase 2: Direct Replacement - Core Lock System
**Replace `src/lib/server/typedLocks.ts` entirely:**
- Remove all custom TypedMutex and TypedReadWriteLock classes
- Replace with direct IronGuard imports and usage
- Update all type definitions to use IronGuard types
- Maintain lock level constants with IronGuard mapping

### Phase 3: Update Core Components
**Priority Order:**

1. **TypedCacheManager** (Highest Impact)
   - Replace all 5 lock instances with direct IronGuard calls (reduced from 6 due to MessageLevel consolidation)
   - Update message lock usage to use single LOCK_8 with acquireRead/acquireWrite
   - Update all lock usage methods to use createLockContext()
   - Replace custom lock patterns with IronGuard equivalents
   - Update type aliases to use IronGuard types

2. **API Endpoints** (Medium Impact)
   - Update imports to use IronGuard directly
   - Replace createEmptyContext() with createLockContext()
   - Update lock acquisition to IronGuard patterns
   - Test each endpoint individually

3. **Repository Layer** (Low Impact)  
   - Replace createEmptyContext() with createLockContext()
   - Update import statements
   - Minimal pattern changes required

### Phase 4: Update Tests
**Test Migration Strategy:**
- Update test imports to use IronGuard directly
- Replace custom lock instantiation with IronGuard patterns
- Maintain existing test assertions and behavior validation
- Add IronGuard-specific feature tests where applicable
- Validate compile-time type safety with IronGuard types
- Performance/behavior regression testing

### Phase 5: Cleanup and Documentation
- Verify all files updated to IronGuard
- Update documentation references
- Add migration notes to TechnicalDebt.md

## Implementation Details

### Direct IronGuard Usage
```typescript
// Replace src/lib/server/typedLocks.ts with direct IronGuard usage

// Lock level constants (no adapter layer)
import { LOCK_2, LOCK_4, LOCK_6, LOCK_8, LOCK_10 } from '@markdrei/ironguard-typescript-locks';

export const CACHE_LOCK = LOCK_2;
export const WORLD_LOCK = LOCK_4;  
export const USER_LOCK = LOCK_6;
export const MESSAGE_LOCK = LOCK_8;      // Single lock for both read/write
export const DATABASE_LOCK = LOCK_10;    // Moved from LOCK_12

// Re-export IronGuard types directly
export { createLockContext, type LockContext, type ValidLock2Context, ValidLock4Context, etc. } from '@markdrei/ironguard-typescript-locks';
```

### Direct Pattern Replacements
```typescript
// OLD: Custom TypedMutex pattern
private cacheManagementLock = new TypedMutex('cache-mgmt', 0 as CacheLevel);
await this.cacheManagementLock.acquire(emptyCtx, async (ctx) => {
  // Critical section
});

// NEW: Direct IronGuard pattern  
const ctx = await createLockContext().acquireWrite(CACHE_LOCK);
try {
  // Critical section
} finally {
  ctx.dispose();
}
```

```typescript
// OLD: Custom ReadWrite lock pattern with separate levels 
private messageLock = new TypedReadWriteLock('message', 2.4 as MessageReadLevel, 2.5 as MessageWriteLevel);
await this.messageLock.read(ctx, async (readCtx) => { /* read messages */ });
await this.messageLock.write(ctx, async (writeCtx) => { /* write messages */ });

// NEW: Direct IronGuard pattern with single lock level
const readCtx = await createLockContext().acquireRead(MESSAGE_LOCK);   // LOCK_8 read
const writeCtx = await createLockContext().acquireWrite(MESSAGE_LOCK); // LOCK_8 write
try {
  // IronGuard naturally handles read/write semantics on same lock
} finally {
  readCtx.dispose();
  writeCtx.dispose();
}
```

```typescript
// OLD: createEmptyContext() pattern with separate message locks
const emptyCtx = createEmptyContext();
await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
  await cacheManager.withMessageRead(userCtx, async (msgReadCtx) => {
    // Read operations
  });
  await cacheManager.withMessageWrite(userCtx, async (msgWriteCtx) => {
    // Write operations  
  });
});

// NEW: Direct IronGuard chaining with single message lock
const ctx = await createLockContext()
  .acquireWrite(USER_LOCK)          // LOCK_6
  .then(c => c.acquireRead(MESSAGE_LOCK));   // LOCK_8 for read
try {
  // Read operations
} finally {
  ctx.dispose();
}

const ctx2 = await createLockContext()
  .acquireWrite(USER_LOCK)          // LOCK_6  
  .then(c => c.acquireWrite(MESSAGE_LOCK));  // LOCK_8 for write
try {
  // Write operations
} finally {
  ctx2.dispose();
}
```

## Risk Assessment

### High Risk Areas
1. **TypedCacheManager** - Complex nested locking patterns need careful translation
2. **Message System** - ReadWrite lock consolidation to single LOCK_8 with IronGuard's native read/write semantics
3. **API Endpoints** - Many integration points require simultaneous updates

### Mitigation Strategies
1. **Complete Component Migration** - Update entire components at once, not piecemeal
2. **Comprehensive Testing** - Unit and integration tests after each component
3. **Direct Pattern Mapping** - One-to-one replacement of patterns, no abstractions
4. **Performance Monitoring** - Ensure no regressions from direct IronGuard usage

## Benefits After Migration

### Immediate Benefits
- **Battle-tested Implementation** - IronGuard has comprehensive test suite
- **Enhanced Type Safety** - More sophisticated TypeScript constraints
- **Better Documentation** - Well-documented API and patterns
- **Standard Library** - Industry-standard lock ordering implementation

### Long-term Benefits  
- **Maintenance Reduction** - No custom lock implementation to maintain
- **Feature Access** - Access to IronGuard's advanced features (rollback, etc.)
- **Community Support** - Benefit from IronGuard improvements and bug fixes
- **Consistency** - Standard patterns across projects
- **Cleaner Code** - Direct usage without adapter abstractions

## Testing Strategy

### Validation Requirements
1. **Functional Equivalence** - All existing functionality works
2. **Type Safety** - Compile-time deadlock prevention still enforced  
3. **Performance** - No significant performance regressions
4. **Deadlock Prevention** - Lock ordering violations still caught

### Test Categories
1. **Unit Tests** - Individual lock behavior
2. **Integration Tests** - Multi-lock scenarios  
3. **Compile-time Tests** - Type safety validation
4. **Performance Tests** - Lock acquisition/release timing
5. **Stress Tests** - High-concurrency scenarios

## Timeline Estimate

- **Phase 1:** ✅ Complete (Setup)
- **Phase 2:** 2-3 days (Direct replacement of core lock system)
- **Phase 3:** 3-4 days (Core components migration)
- **Phase 4:** 2-3 days (Tests)  
- **Phase 5:** 1 day (Cleanup)

**Total Estimated Time:** 8-11 days

## Success Criteria

1. ✅ All existing tests pass
2. ✅ No compile-time type safety regressions
3. ✅ API endpoints function identically  
4. ✅ Performance within 5% of current implementation
5. ✅ Custom `typedLocks.ts` successfully removed and replaced
6. ✅ Documentation updated

## Next Steps

1. **Start Phase 2** - Directly replace `src/lib/server/typedLocks.ts` with IronGuard
2. **Create Feature Branch** - `feat/ironguard-migration` 
3. **Begin TypedCacheManager Migration** - Highest impact component
4. **Iterate Through Components** - One at a time with comprehensive testing
5. **Performance Validation** - Before finalizing migration

---

*This migration replaces the custom lock system entirely with direct IronGuard usage, maintaining deadlock prevention while eliminating custom implementation complexity.*