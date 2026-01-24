# PostgreSQL Migration Merge Analysis and Plan

## Executive Summary

This document outlines the plan to merge 373 commits from the `master` branch into the current PostgreSQL migration branch (`feat/container2-6`). The branches have diverged significantly with no common merge base.

**Key Finding**: Both branches already use PostgreSQL! This is NOT a database migration task, but rather a feature integration task.

## Current State

### Current Branch: `copilot/merge-and-adapt-postgresql` (based on `feat/container2-6`)
- **Database**: PostgreSQL (using `pg` package)
- **Base Commit**: `8257af0` - "render: add environment variable check for POSTGRES_HOST in production"
- **State**: PostgreSQL fully implemented with schema, migrations, and adapter pattern

### Master Branch
- **Database**: PostgreSQL (same as current branch)
- **Commits Ahead**: 373 commits
- **Date Range**: Late October 2025 to November 29, 2025
- **State**: Contains many new features, refactorings, and improvements

### Problem
- No common merge base (branches have separate histories)
- Cannot do simple `git merge master`
- Need to manually integrate features from master

## Features to Merge from Master

Based on analysis of merge commits, here are the major feature categories:

### 1. Battle System Improvements (Priority: HIGH)
**PRs**: #65, #63, #61, #60, #55
- **Better Damage System** - Improved damage calculation and tracking
- **Battle Scheduler Refactoring** - Made testable with dependency injection
- **Stop Scheduler Functionality** - Ability to stop battle scheduler in tests
- **Damage Output Updates** - Consolidated damage systems
- **IronGuard Integration** - Updated battle subsystem to use IronGuard locking

**Key Files**:
- `src/lib/server/battle/battleScheduler.ts` (major refactor, +341 lines)
- `src/lib/server/battle/battleSchedulerUtils.ts` (new file, +70 lines)
- `src/lib/server/battle/battleService.ts` (simplified, -190 lines)
- `src/lib/server/battle/battleTypes.ts` (+29 lines for types)
- `src/__tests__/lib/battle/battleScheduler.test.ts` (new, +333 lines)

**Changes**:
- Removed `battleEngine.ts` (consolidated into battleScheduler)
- Added dependency injection for testability
- Improved damage calculation with constants
- Better separation of concerns

### 2. Research/Tech System Enhancements (Priority: HIGH)
**PRs**: #64, #57, #20, #17
- **Research Value Methods** - New methods to query tech tree values
- **Tech Tree Improvements** - Better damage modifier calculations
- **Defense Values** - Based on tech type and research level

**Key Files**:
- `src/lib/server/techs/techtree.ts` (+36 lines of new methods)
- `src/__tests__/lib/techtree.test.ts` (+47 lines)
- `src/lib/server/techs/TechFactory.ts` (updated)

### 3. Message System Updates (Priority: MEDIUM)
**PRs**: #62, #52
- **Extended Message Summarization** - Collection support, split methods
- **Race Condition Fixes** - Only process unread messages
- **Message Cache Improvements** - Better caching logic

**Key Files**:
- `src/lib/server/messages/MessageCache.ts` (major update, +534 lines)
- `src/lib/server/messages/messagesRepo.ts` (+28 lines)
- `src/__tests__/lib/MessageCache-summarization.test.ts` (+132 lines)

### 4. Cache System Refactoring (Priority: HIGH)
**PRs**: #59, #56, #39
- **Unified Cache Implementations** - All caches extend base Cache class
- **IronGuard Migration** - Migrated to IronGuard locking system
- **World/User Subsystem Updates** - Simplified with new lock patterns

**Key Files**:
- `src/lib/server/caches/Cache.ts` (base class updates)
- `src/lib/server/user/userCache.ts` (refactored, -49 lines simplified)
- `src/lib/server/world/worldCache.ts` (simplified)
- `src/lib/server/world/userWorldCache.ts` (major simplification, -332 lines)
- `src/lib/server/typedLocks.ts` (updated lock types)

### 5. Testing Infrastructure (Priority: HIGH)
**PRs**: #40, various
- **Faster Tests** - Optimized test execution
- **Test Helper Updates** - Better test server initialization
- **Transaction-based Test Isolation** - New test patterns

**Key Files**:
- `src/__tests__/helpers/testServer.ts` (updated with stopBattleScheduler)
- `.github/instructions/TESTING.instructions.md` (new testing guidelines)
- Various test files updated

### 6. UI/Frontend Improvements (Priority: MEDIUM)
**PRs**: #47, #45, #44, #42
- **Defense Value Display** - Show hull/armor/shield
- **Past Battles Display** - Battle history UI
- **Home Page Redirect** - Better UX
- **Message Background Colors** - Visual improvements

**Key Files**:
- UI components in `src/app/` directory
- `src/app/globals.css` (styling updates)

### 7. Documentation & Cleanup (Priority: LOW)
**PRs**: #57 (removed old TODO files)
- Removed obsolete documentation
- Updated technical debt tracking
- Improved architecture documentation

**Key Files**:
- `TechnicalDebt.md` (updated)
- Removed multiple old TODO/PLAN files
- Updated architecture docs in `doc/architecture/`

## Merge Strategy

Since there's no common merge base, we'll use a **feature-by-feature cherry-pick and adapt** approach:

### Phase 1: Foundation Updates (Critical Path)
1. ✅ **Update IronGuard Dependencies** - Ensure package versions match
2. ✅ **Unified Cache Base Class** - Merge cache refactoring
3. ✅ **Lock System Updates** - Update typedLocks.ts

### Phase 2: Core Systems
4. ✅ **Battle System Refactoring**
   - Merge battleScheduler improvements
   - Add battleSchedulerUtils
   - Update battleService
   - Add/update tests
   
5. ✅ **Tech/Research System**
   - Merge techtree enhancements
   - Update TechFactory
   - Merge related tests

6. ✅ **Message System**
   - Merge MessageCache improvements
   - Update messagesRepo
   - Merge test updates

### Phase 3: User-Facing Features
7. ✅ **UI Improvements**
   - Merge defense value displays
   - Add past battles UI
   - Update styling

8. ✅ **Testing Infrastructure**
   - Merge test helpers
   - Update testing documentation
   - Ensure all tests pass

### Phase 4: Cleanup & Validation
9. ✅ **Documentation**
   - Update technical debt
   - Remove obsolete docs
   - Update architecture docs

10. ✅ **Final Validation**
    - Run full test suite
    - Run linting
    - Run compilation
    - Verify all features work

## Implementation Approach

For each feature:

1. **Identify**: List specific commits and files changed
2. **Compare**: Use `git show <commit>` to see exact changes
3. **Adapt**: Apply changes to current PostgreSQL code
4. **Test**: Run relevant tests after each feature
5. **Commit**: Create logical commits with clear messages

## File Conflict Resolution Strategy

Since branches diverged, expect conflicts in:
- `src/lib/server/battle/*` - Heavy changes on both sides
- `src/lib/server/caches/*` - Cache refactoring
- `src/lib/server/messages/*` - Message system updates
- `package.json`/`package-lock.json` - Dependency updates
- Test files - New tests vs existing tests

**Resolution Approach**:
- Keep PostgreSQL database layer intact
- Merge business logic changes
- Update imports/references as needed
- Preserve both sets of tests (merge, don't replace)

## Success Criteria

The merge is complete when:

- ✅ All features from master are present
- ✅ All features work with PostgreSQL
- ✅ All tests pass (`npm test`)
- ✅ Linting passes (`npm run lint`)
- ✅ TypeScript compilation passes (`npm run build`)
- ✅ No regression in existing PostgreSQL functionality
- ✅ Documentation is updated

## Estimated Effort

Based on the scope:
- **Phase 1**: ~20 commits (2-3 hours)
- **Phase 2**: ~40 commits (4-6 hours)
- **Phase 3**: ~20 commits (2-3 hours)
- **Phase 4**: ~10 commits (1-2 hours)

**Total**: ~90 significant commits to review and merge (9-14 hours of work)

Note: Not all 373 commits need individual review - many are intermediate commits within features.

## Risk Assessment

**Low Risk**:
- Documentation updates
- Test-only changes
- UI styling

**Medium Risk**:
- Message system changes (race conditions)
- Test infrastructure changes

**High Risk**:
- Battle system refactoring (complex logic)
- Cache system refactoring (locking mechanisms)
- Lock type updates (type safety critical)

**Mitigation**:
- Test after each major change
- Keep changes atomic and reversible
- Validate locks still prevent deadlocks
- Run full test suite frequently

## Notes

- Both branches use PostgreSQL - no database migration needed
- Focus is on merging features, not converting databases
- IronGuard locking library is used by both - ensure version compatibility
- Battle system had major refactoring - handle with care
- Many intermediate commits can be squashed in final history

## Current Status - 2026-01-24

### Completed Work

#### Phase 1: Foundation Updates ✅
- ✅ Updated package.json scripts to remove .devcontainer/init-db.sh (matches master)
- ✅ Added `resetBattleScheduler()` function to battleScheduler.ts
- ✅ Updated test helpers (testServer.ts) to call resetBattleScheduler() in shutdown
- ✅ Enhanced Cache base class with shutdown(), abstract methods, and persistence timer
- ✅ Added flushAllToDatabaseWithContext() wrapper pattern to UserCache
- ✅ Verified linting passes (only minor unused variable warnings)

### Architectural Differences Discovered

#### Cache System Patterns
**Current Branch**:
```typescript
// Methods take lock context as parameter
async flushAllToDatabase(context: LockContext<LocksAtMostAndHas4>): Promise<void>
private startBackgroundPersistence(context: LockContext<...>): void
```

**Master Branch**:
```typescript
// Methods create their own lock contexts
protected async flushAllToDatabase(): Promise<void> {
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
    await this.flushAllToDatabaseWithContext(userContext);
  });
}
```

**Implication**: Master's pattern provides better encapsulation and matches the Cache base class interface better. However, adapting all caches requires significant refactoring.

#### Battle System Architecture
**Current Branch**:
- battleScheduler.ts (10.9 KB)
- battleEngine.ts (16.5 KB) - Separate combat mechanics
- battleService.ts (17.5 KB) - Battle lifecycle orchestration

**Master Branch**:
- battleScheduler.ts (larger, consolidated)
- battleSchedulerUtils.ts (new, ~70 lines) - Extracted utilities
- battleService.ts (simplified, -190 lines)
- battleEngine.ts (REMOVED - consolidated into battleScheduler)

**Implication**: Master has consolidated battle mechanics into fewer, more focused files. This requires careful merging to preserve PostgreSQL operations.

### Blocking Issues

1. **Test Environment**: Tests require PostgreSQL database running (docker-compose db-test service)
2. **Architectural Decision Needed**: Choose between current lock context pattern or master's pattern
3. **Complex Refactoring**: Battle system consolidation affects many interconnected files

### Recommendations

#### Short-term (Low Risk, High Value)
1. ✅ Merge package.json/test infrastructure updates
2. ✅ Add resetBattleScheduler function
3. ⏭️ Merge UI/frontend changes (low risk)
4. ⏭️ Update documentation

#### Medium-term (Moderate Risk)
1. Create battleSchedulerUtils.ts with extracted utilities
2. Merge message system improvements (preserving current lock patterns)
3. Add battle scheduler tests

#### Long-term (High Risk, High Value)  
1. Evaluate adopting master's cache pattern (better encapsulation)
2. Consolidate battle system (remove battleEngine.ts)
3. Full refactoring of all cache implementations

### Test Status
- ✅ **Linting**: Passes (only minor warnings)
- ⚠️ **TypeScript Compilation**: Has errors related to Cache class signatures
- ❌ **Tests**: Cannot run without PostgreSQL database
- ❌ **Build**: Blocked by network (fonts.googleapis.com unreachable)
