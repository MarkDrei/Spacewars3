# TODO: Migration to Reference IronGuard System

## Goal
Replace the current level-based lock system with the reference array-based IronGuard system to enable proper tracking of which specific locks are held (not just the maximum level).

## Lock Level Mapping

```typescript
// OLD System (level-based)     →  NEW System (array-based)
CacheLevel = 0                  →  LOCK_CACHE = 10
WorldLevel = 1                  →  LOCK_WORLD = 20
UserLevel = 2                   →  LOCK_USER = 30
MessageReadLevel = 2.4          →  LOCK_MESSAGE_READ = 40
MessageWriteLevel = 2.5         →  LOCK_MESSAGE_WRITE = 41
BattleLevel = 2.8               →  LOCK_BATTLE = 50
DatabaseLevel = 3               →  LOCK_DATABASE = 60
```

**Why these numbers?**
- 10-step intervals for most locks (plenty of room for future insertions)
- MessageWrite at 41 (not 50) to maintain close relationship with MessageRead (40)
- Ordering preserved: 10 < 20 < 30 < 40 < 41 < 50 < 60 ✅

---

## Migration Phases

### Phase 0: Preparation ✅
**Goal**: Document and understand the migration scope

- [x] Document current system limitations
- [x] Analyze reference IronGuard system
- [x] Decide on migration approach
- [x] Define lock level mapping
- [ ] Review codebase for all lock usage locations

**Quality Check**: Documentation review
**Estimated Time**: Completed

---

### Phase 1: Setup Reference System (Parallel) ✅ COMPLETE
**Goal**: Install reference IronGuard alongside current system without breaking anything

#### Tasks:
1. [x] Copy `ironGuard/ironGuardSystem.ts` → `src/lib/server/ironGuardV2.ts`
   - Update lock level type: `type LockLevel = 10 | 20 | 30 | 40 | 41 | 50 | 60;`
   - Add Spacewars lock constants
   - Keep all reference type machinery (`Contains`, `CanAcquire`, etc.)
   - Added `release()` method for try/finally pattern

2. [x] Copy `ironGuard/ironGuardTypes.ts` → `src/lib/server/ironGuardTypesV2.ts`
   - Adapt `ValidLock3Context` pattern for Spacewars locks
   - Create: `ValidCacheLockContext<THeld>` (added, not in original plan)
   - Create: `ValidWorldLockContext<THeld>`
   - Create: `ValidUserLockContext<THeld>`
   - Create: `ValidMessageReadLockContext<THeld>`
   - Create: `ValidMessageWriteLockContext<THeld>`
   - Create: `ValidBattleLockContext<THeld>`
   - Create: `ValidDatabaseLockContext<THeld>`
   - Note: Simplified validation - TypeScript doesn't support numeric comparison in types

3. [x] Create `src/lib/server/typedCacheManagerV2.ts` (skeleton created, then fully implemented in Phase 3)

4. [ ] Rename old system files for clarity (DEFERRED to Phase 7):
   - `ironGuardSystem.ts` → `ironGuardSystem.old.ts`
   - `ironGuardTypes.ts` → `ironGuardTypes.old.ts`
   - Keep old imports working via re-exports

**Quality Check**: ✅ PASSED
```bash
npx tsc --noEmit  # ✅ Compiles with no errors
npm run lint      # ✅ Passes (warnings only)
npm test          # ✅ Tests pass
```

**Actual Time**: ~3 hours

---

### Phase 2: Implement Lock Acquisition Helpers ✅ COMPLETE
**Goal**: Create helper functions that wrap reference system's `acquire()`/`release()` pattern to maintain async patterns

#### Tasks:
1. [x] Create `src/lib/server/lockHelpers.ts`:
   - Async wrappers using try/finally pattern
   - Helpers for all lock types: World, User, MessageRead, MessageWrite, Battle, Database
   - Each helper enforces correct lock ordering through types

2. [x] Add tests for lock helpers:
   - `src/__tests__/lib/lockHelpers.test.ts`
   - 23 tests covering lock ordering, error handling, context threading
   - All tests passing ✅

**Quality Check**: ✅ PASSED
```bash
npm test -- lockHelpers.test.ts  # ✅ 23 tests passed
npx tsc --noEmit                  # ✅ Compiles
npm run lint                      # ✅ Passes
```

**Actual Time**: ~2 hours

---

### Phase 3: Migrate TypedCacheManager Core ✅ COMPLETE
**Goal**: Implement the new cache manager with reference IronGuard system

#### Tasks:
1. [x] Implement `typedCacheManagerV2.ts`:
   - ✅ Full implementation with IronGuard V2 lock system
   - ✅ Resolved all lock order violations (4 major deadlock scenarios fixed)
   - ✅ World operations (get, update, ship manipulation)
   - ✅ User operations (get, set, load from DB)
   - ✅ Battle operations (get, set, load from DB)
   - ✅ Flush operations with correct lock ordering
   - ✅ Background persistence and battle scheduler stubs

2. [x] Lock Order Violations Fixed:
   - `initializeWorld`: CACHE→DATABASE→WORLD ❌ → CACHE→WORLD→DATABASE ✅
   - `loadUserIfNeeded`: USER→DATABASE→USER ❌ → USER→DATABASE ✅
   - `loadBattleIfNeeded`: BATTLE→DATABASE→BATTLE ❌ → BATTLE→DATABASE ✅
   - `flushAllToDatabase`: CACHE→DATABASE→USER ❌ → Separate flushes with correct ordering ✅

3. [ ] Create integration tests (DEFERRED - existing tests sufficient for now):
   - Can reuse patterns from lockHelpers.test.ts
   - Full integration tests in Phase 7

**Quality Check**: ✅ PASSED
```bash
npx tsc --noEmit                         # ✅ Compiles with no errors!
npm run lint                             # ✅ Passes (warnings only)
npm test -- lockHelpers                  # ✅ 23/23 tests pass
```

**Actual Time**: ~6 hours (including deadlock resolution)

**Key Achievements**:
- ✅ All lock order violations successfully resolved through control flow redesign
- ✅ TypeScript's type system successfully detected all deadlock scenarios at compile time
- ✅ Demonstrated that the new system can enforce correct lock ordering
- ✅ Established patterns for remaining migrations

---

### Phase 4: Migrate Repository Layer (One at a Time)
**Goal**: Update repository functions to use new lock system

#### Tasks (per repository):
1. [ ] Migrate `worldRepo.ts`:
   - Update function signatures: `<THeld extends readonly LockLevel[]>`
   - Change context parameters: `ValidWorldLockContext<THeld>`
   - Update lock acquisitions to use helpers
   - Update tests: `world-api.test.ts`

2. [ ] Migrate `userRepo.ts`:
   - Update function signatures
   - Change context parameters: `ValidUserLockContext<THeld>`
   - Update tests: `user-*.test.ts`

3. [ ] Migrate `messagesRepo.ts`:
   - Update function signatures
   - Change context parameters: `ValidMessageReadLockContext<THeld>` / `ValidMessageWriteLockContext<THeld>`
   - Update tests: `messages-api.test.ts`

4. [ ] Migrate `battleRepo.ts`:
   - Update function signatures
   - Change context parameters: `ValidBattleLockContext<THeld>`
   - Update tests: `battle-*.test.ts`

**Quality Check After Each Repository**:
```bash
npm test -- <repo-specific-tests>  # Should pass
npx tsc --noEmit                   # Should compile
npm run lint                       # Should pass
```

**Estimated Time**: 2-3 hours per repository = 8-12 hours total

---

### Phase 5: Migrate Service Layer
**Goal**: Update service functions to use new lock system

#### Tasks:
1. [ ] Migrate `battleService.ts`:
   - Update all function signatures
   - Change context parameters to use ValidXLockContext<THeld>
   - Update lock acquisitions

2. [ ] Migrate `battleScheduler.ts`:
   - Update function signatures
   - Update lock acquisitions

3. [ ] Migrate `world.ts` (domain logic):
   - Update function signatures
   - Update lock acquisitions

4. [ ] Migrate `user.ts` (domain logic):
   - Update function signatures
   - Update lock acquisitions

**Quality Check After Each Service**:
```bash
npm test -- <service-tests>  # Should pass
npx tsc --noEmit            # Should compile
npm run lint                # Should pass
```

**Estimated Time**: 3-4 hours per service = 12-16 hours total

---

### Phase 6: Migrate API Routes
**Goal**: Update API route handlers to use new lock system

#### Tasks:
1. [ ] Update each API route in `src/app/api/`:
   - `/api/world` → Use `createLockContext()` as entry point
   - `/api/collect-typed` → Thread context through
   - `/api/navigate-typed` → Thread context through
   - `/api/harvest` → Thread context through
   - `/api/attack` → Thread context through
   - `/api/battle-status` → Thread context through
   - `/api/user-stats` → Thread context through
   - `/api/ship-stats` → Thread context through
   - `/api/messages` → Thread context through
   - `/api/build-item` → Thread context through
   - `/api/complete-build` → Thread context through
   - `/api/techtree` → Thread context through
   - `/api/trigger-research` → Thread context through

2. [ ] Update API tests:
   - One test file at a time
   - Verify context threading works correctly

**Quality Check After Each API Route**:
```bash
npm test -- <api-test-file>  # Should pass
npx tsc --noEmit             # Should compile
npm run lint                 # Should pass
```

**Estimated Time**: 1 hour per API route = 13-15 hours total

---

### Phase 7: Cleanup and Validation
**Goal**: Remove old system and validate complete migration

#### Tasks:
1. [ ] Remove old system files:
   - Delete `ironGuardSystem.old.ts`
   - Delete `ironGuardTypes.old.ts`
   - Delete `typedCacheManager.ts` (if fully replaced)

2. [ ] Rename V2 files to primary:
   - `ironGuardV2.ts` → `ironGuardSystem.ts`
   - `ironGuardTypesV2.ts` → `ironGuardTypes.ts`
   - `typedCacheManagerV2.ts` → `typedCacheManager.ts`

3. [ ] Update all imports:
   - Remove `/V2` from import paths
   - Verify no references to `.old` files

4. [ ] Run full validation:
   ```bash
   npm run ci  # Full CI pipeline
   ```

5. [ ] Update documentation:
   - Update `doc/hookArchitecture.md`
   - Update inline code comments
   - Add migration notes to CHANGELOG

**Quality Check**:
```bash
npm run ci           # Must pass completely
npm test -- --coverage  # Verify test coverage maintained
npm run lint         # Must pass
npx tsc --noEmit     # Must compile
```

**Estimated Time**: 3-4 hours

---

## Open Questions

### 1. Lock Acquisition Pattern
**Question**: Should we maintain async callback pattern or switch to try/finally?

**Decision**: Option B

---

### 2. MessageWrite Lock Ordering
**Question**: MessageWrite is at level 41 (between MessageRead 40 and Battle 50). Is this the right level?

**Decision**:
Yes, 41 is right. We don't want anything between Read and Write on the same resource.

---

### 3. Backwards Compatibility
**Question**: Do we need to maintain old API during migration?

**Decision**: Direct replacement. All old code must be gone, we want to fully embrace the new concepts.

---

### 4. Test Coverage
**Question**: Should we add new tests for the array-based lock tracking features?

**Decision**: Yes, add tests in Phase 2 (lock helpers test)

---

### 5. Performance Impact
**Question**: Does array-based tracking have performance implications?

**Decision**: No performance concerns, proceed with migration

---

## Summary

**Total Estimated Time**: 35-50 hours (roughly 1 week of focused work)

**Critical Path**:
1. Phase 1-2: Setup (4-6 hours) 
2. Phase 3: Core cache manager (4-6 hours)
3. Phase 4-5: Repositories & services (20-28 hours) ← Longest part
4. Phase 6: API routes (13-15 hours)
5. Phase 7: Cleanup (3-4 hours)

**Risk Mitigation**:
- Small, incremental steps with quality checks
- Parallel systems during migration
- Can rollback at any point before Phase 7
- Comprehensive tests at each phase

**Success Criteria**:
- ✅ All tests pass
- ✅ Full TypeScript compilation
- ✅ Linting passes
- ✅ Can express "holding locks [10, 50] but not 30"
- ✅ Compile-time deadlock prevention maintained
- ✅ No runtime performance degradation

---

## Next Steps

1. **Review this plan** - Confirm approach and address open questions
2. **Start Phase 1** - Set up parallel systems
3. **Proceed incrementally** - Complete each phase with quality checks
4. **Track progress** - Check off tasks as completed

**Ready to begin Phase 1?**
