# IronGuard Lock System Migration Plan

## Overview

Migrate from the current `typedLocks.ts` system to the new IronGuard lock system, which provides:
- Simpler, more flexible lock acquisition patterns
- Skip intermediate locks (e.g., directly acquire lock 30 without holding 10 or 20)
- Pass lock contexts through function chains with compile-time validation
- Cleaner type system with better developer experience

## Current System Analysis

### Current Lock Levels (typedLocks.ts)
```typescript
CacheLevel = 0
WorldLevel = 1
UserLevel = 2
MessageReadLevel = 2.4
MessageWriteLevel = 2.5
DatabaseLevel = 3
```

### Current Lock Types
1. **TypedMutex**: Single writer lock with level enforcement
2. **TypedReadWriteLock**: Separate read/write locks with different levels

### Usage Patterns Found
1. **API Routes**: Create `emptyContext`, acquire locks in order
2. **TypedCacheManager**: Manages 5 locks (cache, world, user, message, database)
3. **Lock Chaining**: `withWorldWrite(emptyCtx) -> withUserLock(worldCtx) -> withDatabaseRead(userCtx)`
4. **Context Passing**: Functions accept specific lock contexts as parameters
5. **Unsafe Operations**: Methods that require specific lock contexts already held

## New IronGuard Lock Levels

Using 10-unit spacing to allow future insertions:

```typescript
CacheLevel = 10
WorldLevel = 20
UserLevel = 30
MessageReadLevel = 34  // Slightly below UserLevel for ordering
MessageWriteLevel = 35 // Between read and database
DatabaseLevel = 40
```

### Rationale for Level Values
- **10**: Cache management operations (lowest level)
- **20**: World operations (can skip cache if not needed)
- **30**: User operations (can skip world if not needed)
- **34/35**: Message operations (nested within user operations)
- **40**: Database operations (highest level)
- **Gaps**: Allow insertion of new locks between existing ones

## Migration Plan

### Phase 1: Copy and Adapt IronGuard System ✅

**Files to Create:**
1. `src/lib/server/ironGuard/core.ts` - Core LockContext class and lock definitions
2. `src/lib/server/ironGuard/types.ts` - Type helpers and level definitions
3. `src/lib/server/ironGuard/locks.ts` - Lock instances for the application
4. `src/lib/server/ironGuard/index.ts` - Public API exports

**Lock Definitions:**
```typescript
// src/lib/server/ironGuard/locks.ts
export const LOCK_CACHE = 10 as const;
export const LOCK_WORLD = 20 as const;
export const LOCK_USER = 30 as const;
export const LOCK_MESSAGE_READ = 34 as const;
export const LOCK_MESSAGE_WRITE = 35 as const;
export const LOCK_DATABASE = 40 as const;

export type CacheLevel = 10;
export type WorldLevel = 20;
export type UserLevel = 30;
export type MessageReadLevel = 34;
export type MessageWriteLevel = 35;
export type DatabaseLevel = 40;
```

### Phase 2: Create Comprehensive Test Suite ✅

**Test File:** `src/__tests__/lib/ironGuard.test.ts`

**Test Cases:**

1. **Basic Lock Acquisition**
   - Acquire locks in order (10 → 20 → 30)
   - Skip intermediate locks (10 → 30, direct 20)
   - Multiple acquisition attempts (compile-time errors)

2. **Context Passing Through Functions**
   ```typescript
   test('lockContext_passedThroughIntermediateFunctions_maintainsTypeCheck', () => {
     // Create context with lock 10
     const ctx = createLockContext().acquire(LOCK_CACHE);
     
     // Pass through intermediate function
     intermediateFunction(ctx); // Should accept and work
     
     // Try invalid context
     const invalidCtx = createLockContext().acquire(LOCK_DATABASE);
     // intermediateFunction(invalidCtx); // Should fail at compile time
   });
   ```

3. **Hold Multiple Locks**
   ```typescript
   test('lockContext_holdsMultipleLocks_canUseAny', () => {
     const ctx = createLockContext()
       .acquire(LOCK_CACHE)
       .acquire(LOCK_WORLD)
       .acquire(LOCK_USER);
     
     expect(ctx.hasLock(LOCK_CACHE)).toBe(true);
     expect(ctx.hasLock(LOCK_WORLD)).toBe(true);
     expect(ctx.hasLock(LOCK_USER)).toBe(true);
     
     // Use any held lock
     ctx.useLock(LOCK_CACHE, () => { /* operation */ });
     ctx.useLock(LOCK_WORLD, () => { /* operation */ });
     ctx.useLock(LOCK_USER, () => { /* operation */ });
   });
   ```

4. **Function Requires Specific Lock - Can Use Existing**
   ```typescript
   test('function_requiresLock30_canUseExistingFromSet', () => {
     // Hold locks 20, 30, 50
     const ctx = createLockContext()
       .acquire(LOCK_WORLD)
       .acquire(LOCK_USER)
       .acquire(LOCK_DATABASE);
     
     // Function that needs lock 30 (USER)
     function needsUserLock<THeld extends readonly LockLevel[]>(
       context: ValidUserLockContext<THeld>
     ): void {
       const lockCtx = context as LockContext<THeld>;
       lockCtx.useLock(LOCK_USER, () => {
         // Can use lock 30 because it's already held
       });
     }
     
     needsUserLock(ctx); // Should work - has lock 30
   });
   ```

5. **Compile-Time Deadlock Prevention**
   ```typescript
   test('typeSystem_preventsInvalidLockAcquisition_atCompileTime', () => {
     // Valid: 10 → 20 → 30
     const valid = createLockContext()
       .acquire(LOCK_CACHE)
       .acquire(LOCK_WORLD)
       .acquire(LOCK_USER);
     
     // Invalid scenarios (these should be compile-time errors):
     // const invalid1 = createLockContext().acquire(LOCK_USER).acquire(LOCK_WORLD);
     // const invalid2 = createLockContext().acquire(LOCK_DATABASE).acquire(LOCK_CACHE);
     
     // Runtime verification that valid context has correct locks
     expect(valid.hasLock(LOCK_CACHE)).toBe(true);
     expect(valid.hasLock(LOCK_WORLD)).toBe(true);
     expect(valid.hasLock(LOCK_USER)).toBe(true);
   });
   ```

6. **ReadWrite Lock Patterns**
   - Since IronGuard doesn't have built-in ReadWriteLock, test pattern for emulating with two lock levels
   ```typescript
   test('readWritePattern_usesSeparateLevels_worksCorrectly', () => {
     // Read operations use level 34
     const readCtx = createLockContext().acquire(LOCK_MESSAGE_READ);
     
     // Write operations use level 35 (higher)
     const writeCtx = createLockContext().acquire(LOCK_MESSAGE_WRITE);
     
     // Write context can't downgrade to read
     // const invalid = writeCtx.acquire(LOCK_MESSAGE_READ); // Compile error
     
     expect(readCtx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
     expect(writeCtx.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
   });
   ```

### Phase 3: Create Migration Layer ✅

**File:** `src/lib/server/ironGuardAdapter.ts`

Purpose: Adapt IronGuard's synchronous LockContext to work with existing async mutex/rwlock patterns.

```typescript
/**
 * Adapter to bridge IronGuard compile-time lock ordering with runtime async mutexes
 * 
 * IronGuard provides compile-time lock ordering validation.
 * This adapter wraps runtime mutexes to work with IronGuard contexts.
 */

export class AsyncMutex<Level extends LockLevel> {
  private locked = false;
  private queue: Array<() => void> = [];
  private readonly level: Level;
  
  constructor(name: string, level: Level) {
    this.level = level;
  }
  
  async acquire<THeld extends readonly LockLevel[]>(
    context: LockContext<THeld>,
    fn: (ctx: LockContext<readonly [...THeld, Level]>) => Promise<T>
  ): Promise<T> {
    // Compile-time: CanAcquire check enforced by LockContext.acquire()
    // Runtime: Traditional mutex queuing
    
    return new Promise<T>((resolve, reject) => {
      const runLocked = async () => {
        try {
          const newCtx = context.acquire(this.level);
          if (typeof newCtx === 'string') {
            throw new Error(newCtx);
          }
          const result = await fn(newCtx);
          this.release();
          resolve(result);
        } catch (error) {
          this.release();
          reject(error);
        }
      };
      
      if (this.locked) {
        this.queue.push(runLocked);
      } else {
        this.locked = true;
        runLocked();
      }
    });
  }
  
  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}
```

### Phase 4: Migrate TypedCacheManager ✅

**File:** `src/lib/server/typedCacheManager.ts`

**Changes:**
1. Replace lock imports with IronGuard system
2. Replace lock instances with AsyncMutex/AsyncReadWriteLock
3. Update method signatures to use IronGuard contexts
4. Test thoroughly with existing test suite

**Example Migration:**
```typescript
// OLD
import { TypedMutex, createEmptyContext } from './typedLocks';
private cacheLock = new TypedMutex('cache-mgmt', 0 as CacheLevel);

async withCacheManagement<T>(
  context: EmptyContext,
  fn: (ctx: LockContext<Locked<'cache-mgmt'>, CacheLevel>) => Promise<T>
): Promise<T> {
  return await this.cacheLock.acquire(context, fn);
}

// NEW
import { createLockContext, LOCK_CACHE } from './ironGuard';
import { AsyncMutex } from './ironGuardAdapter';
private cacheLock = new AsyncMutex('cache-mgmt', LOCK_CACHE);

async withCacheManagement<T, THeld extends readonly LockLevel[]>(
  context: LockContext<THeld>,
  fn: (ctx: LockContext<readonly [...THeld, CacheLevel]>) => Promise<T>
): Promise<T> {
  return await this.cacheLock.acquire(context, fn);
}
```

### Phase 5: Migrate API Routes ✅

**Files to Update:**
- `src/app/api/collect-typed/route.ts`
- `src/app/api/techtree/route.ts`
- `src/app/api/ship-stats/route.ts`
- `src/app/api/user-stats/route.ts`
- `src/app/api/harvest/route.ts`
- `src/app/api/trigger-research/route.ts`
- `src/app/api/world/route.ts`
- `src/app/api/navigate-typed/route.ts`
- `src/app/api/navigate/route.ts`

**Migration Pattern:**
```typescript
// OLD
import { createEmptyContext } from '@/lib/server/typedLocks';
const emptyCtx = createEmptyContext();

// NEW
import { createLockContext } from '@/lib/server/ironGuard';
const emptyCtx = createLockContext();
```

### Phase 6: Update Tests ✅

**Test Files to Update:**
- `src/__tests__/lib/typedLocks.test.ts` → Migrate to ironGuard tests
- `src/__tests__/lib/enhanced-type-system.test.ts` → Update imports
- `src/__tests__/api/*.test.ts` → Update context creation
- `src/__tests__/cache/user-persistence.test.ts` → Update cache manager usage

### Phase 7: Remove Old System ✅

**Files to Delete:**
1. `src/lib/server/typedLocks.ts`
2. Any old test files that were replaced

**Verification:**
- Run full test suite: `npm test`
- Run type checking: `npm run build`
- Verify no imports of old system remain: grep for 'typedLocks'

## Implementation Checklist

- [ ] **Phase 1**: Copy IronGuard core system to `src/lib/server/ironGuard/`
  - [ ] Create `core.ts` with LockContext and lock management
  - [ ] Create `types.ts` with type helpers
  - [ ] Create `locks.ts` with lock level definitions (10, 20, 30, 34, 35, 40)
  - [ ] Create `index.ts` with public exports

- [ ] **Phase 2**: Create comprehensive test suite
  - [ ] Basic lock acquisition tests
  - [ ] Context passing through intermediate functions
  - [ ] Hold multiple locks and use any
  - [ ] Function requires specific lock from set
  - [ ] Compile-time deadlock prevention
  - [ ] ReadWrite lock pattern tests
  - [ ] Run tests: `npm test src/__tests__/lib/ironGuard.test.ts`

- [ ] **Phase 3**: Create migration adapter
  - [ ] Create `ironGuardAdapter.ts`
  - [ ] Implement AsyncMutex wrapper
  - [ ] Implement AsyncReadWriteLock wrapper
  - [ ] Test adapter with simple use cases

- [ ] **Phase 4**: Migrate TypedCacheManager
  - [ ] Update imports to use IronGuard
  - [ ] Replace lock instances with adapters
  - [ ] Update all method signatures
  - [ ] Update internal lock context passing
  - [ ] Run cache tests: `npm test typedCacheManager`

- [ ] **Phase 5**: Migrate all API routes
  - [ ] Update context creation in all routes
  - [ ] Update type imports
  - [ ] Run API tests: `npm test api`

- [ ] **Phase 6**: Update all related tests
  - [ ] Migrate typedLocks.test.ts
  - [ ] Update enhanced-type-system.test.ts
  - [ ] Update all API test helpers
  - [ ] Run full test suite: `npm test`

- [ ] **Phase 7**: Final cleanup
  - [ ] Delete `src/lib/server/typedLocks.ts`
  - [ ] Verify no remaining imports: `grep -r "typedLocks" src/`
  - [ ] Run full test suite: `npm test`
  - [ ] Run build: `npm run build`
  - [ ] Run linter: `npm run lint`

## Open Questions

### 1. ReadWriteLock Equivalent ❓
**Question**: IronGuard doesn't have a built-in ReadWriteLock. How should we handle world and database locks that currently use TypedReadWriteLock?

**Decision**: Option B - Create AsyncReadWriteLock that:
- Uses single lock level for compile-time ordering
- Internally manages multiple readers vs single writer at runtime
- Maintains IronGuard's type safety while supporting ReadWrite pattern


### 2. Empty Context vs Default Context ❓
**Question**: Should we rename `createLockContext()` to `createEmptyContext()` for API compatibility?

**Decision**:
Rename to createEmptyLockContext

### 3. Lock Context Type Aliases ❓
**Question**: Current system has complex type aliases like `WorldReadContext`. Do we need equivalents?

**Current**:
```typescript
type WorldReadContext = LockContext<Locked<'world:read'>, CacheLevel | WorldLevel>;
```

**Decision**: IronGuard is simpler - just use:

**Status**: ⏳ Need to verify this simplification works for all use cases

### 4. Message Lock Levels ❓
**Question**: Current system has MessageReadLevel=2.4 and MessageWriteLevel=2.5. Should these be separate in IronGuard?

**Decision**: Read-write lock with different levels prevents acquiring write after read.


### 5. Performance Considerations ❓
**Question**: Does the new system have any performance implications?
✅ Should be equivalent or better (fewer type gymnastics)

### 6. Migration Strategy ❓
**Question**: Big bang migration vs incremental?

**Decision**: Incremental but fast:
1. Create new system alongside old (Phase 1-3)
2. Migrate TypedCacheManager (Phase 4) - core piece
3. Migrate API routes (Phase 5) - should be quick find/replace
4. Clean up tests (Phase 6)
5. Remove old system (Phase 7)

### 7. Documentation Updates ❓
**Question**: Need to update any documentation?

**Files to Update**:
- `README.md` - Update lock system description
- `.github/copilot-instructions.md` - Update lock level references
- This document serves as migration guide

**Status**: ⏳ Update after migration complete

## Type System Comparison

### Current (typedLocks.ts)
```typescript
// Lock states tracked via phantom types
type Locked<Name> = { readonly [Brand]: `locked:${Name}` };
type LockContext<State, MaxLevel> = { _state: State; _maxLevel: MaxLevel };

// Complex type helpers for validation
type CanAcquire<NewLevel, CurrentLevel> = /* 50 lines of conditional types */;

// Functions must specify exact lock context type
function needsWorldLock(ctx: LockContext<Locked<'world'>, WorldLevel>): void;
```

### New (IronGuard)
```typescript
// Lock states tracked via array of held locks
type LockContext<THeld extends readonly LockLevel[]>;

// Simple type helpers
type Contains<Array, Item> = /* Check if item in array */;
type CanAcquire<Held, New> = /* Check if new > max(held) */;

// Functions can be flexible about lock context
function needsWorldLock<THeld>(ctx: ValidWorldContext<THeld>): void;
// Or require specific lock
function needsWorldLock<THeld>(ctx: Contains<THeld, 20> extends true ? LockContext<THeld> : never): void;
```

### Key Improvements
1. **Simpler mental model**: Array of locks vs phantom type gymnastics
2. **More flexible**: Functions can accept "lock 20 or can acquire it"
3. **Better errors**: "Cannot acquire lock 30" vs complex type error
4. **Skip locks**: Can go 10→30 without 20
5. **Set semantics**: Can hold {10, 20, 40} and use any

## Risk Assessment

### Low Risk ✅
- Core IronGuard system is well-tested (from reference project)
- Type system is simpler than current approach
- Migration can be done incrementally
- Tests will catch any regressions

### Medium Risk ⚠️
- AsyncReadWriteLock adapter needs careful implementation
- Many API routes to migrate (but pattern is repetitive)
- Need to ensure all edge cases are covered

### High Risk ❌
- None identified - old system stays until new system is proven

## Success Criteria

### Functional Requirements ✅
- [ ] All tests pass with new system
- [ ] All API routes work correctly
- [ ] No deadlocks in production
- [ ] Type safety maintained (no `any` casts)

### Non-Functional Requirements ✅
- [ ] Code is cleaner and more maintainable
- [ ] Type errors are more understandable
- [ ] Performance is equivalent or better
- [ ] Documentation is up to date

### Verification Steps ✅
1. Run full test suite: `npm test`
2. Run type checker: `npm run build`
3. Run linter: `npm run lint`
4. Manual testing of key flows (login, navigate, collect, research)
5. Check for any `typedLocks` imports: `grep -r "typedLocks" src/`

## Timeline Estimate

- **Phase 1** (Copy IronGuard): 1-2 hours
- **Phase 2** (Tests): 2-3 hours
- **Phase 3** (Adapter): 2-3 hours
- **Phase 4** (CacheManager): 3-4 hours
- **Phase 5** (API Routes): 1-2 hours
- **Phase 6** (Test Updates): 1-2 hours
- **Phase 7** (Cleanup): 1 hour

**Total**: 11-17 hours

**Recommended**: Split into 2-3 sessions with test verification between phases.

## Rollback Plan

If issues are discovered:
1. All changes are in separate files initially
2. Can revert by switching imports back to `typedLocks.ts`
3. Git branches make rollback safe
4. Old system stays until new system is proven

## Next Steps

1. **Review this plan** - Get feedback on approach and open questions
2. **Start Phase 1** - Copy and adapt IronGuard core system
3. **Implement Phase 2** - Build comprehensive test suite
4. **Decision point** - Verify approach works before major migration
5. **Continue phases** - Systematic migration with testing between phases

---

**Document Status**: Draft - Ready for Review
**Last Updated**: 2025-10-15
**Owner**: Development Team
