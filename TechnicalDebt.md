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

---

## Complete Architecture Assessment - Cache Bypass Analysis

**Date**: 2025-10-13  
**Scope**: Comprehensive audit of all database writes

### Direct Database Writes Identified

#### 1. Battle System (High Priority)

**Files**: `battleScheduler.ts`, `battleService.ts`, `battleRepo.ts`

**Bypass Patterns**:
- `updateUserBattleState()` - Sets `in_battle` and `current_battle_id` flags
- `setShipSpeed()` - Updates ship speed in space_objects table
- `updateUserDefense()` - Writes defense values (hull, armor, shield)
- `teleportShip()` - Updates ship position and speed
- `BattleRepo.*` - All methods write directly to battles table
- `createMessage()` in battleScheduler - Direct message creation

**Impact**: All battle operations bypass cache, requiring manual refresh workarounds.

#### 2. World Operations (Medium Priority)

**Files**: `worldRepo.ts`

**Bypass Patterns**:
- `deleteSpaceObject()` - Direct DELETE then attempts cache refresh
- `insertSpaceObject()` - Direct INSERT then attempts cache refresh
- `saveWorldToDb()` - Bulk UPDATE (but called via cache persistence)

**Impact**: Object creation/deletion requires manual cache invalidation.

#### 3. User Creation (Low Priority - Acceptable)

**Files**: `userRepo.ts`

**Bypass Patterns**:
- `createUser()` / `createUserWithShip()` - Direct INSERT for new users
- Used only during registration
- Note: Includes sendMessageToUserCached for welcome message

**Impact**: Minimal - only happens once per user, subsequent access goes through cache.

#### 4. Initial Bringup (Acceptable)

**Files**: `database.ts`, `seedData.ts`, `migrations.ts`

**Bypass Patterns**:
- Schema creation (CREATE TABLE)
- Default user seeding
- Migration scripts (ALTER TABLE, UPDATE for defaults)
- Test database initialization

**Impact**: None - these are one-time operations before normal operation begins.

### Database Initialization Flow

1. **Fresh Database** (`database.ts:initializeDatabase()`):
   - Create tables via CREATE_TABLES array
   - Seed default data via `seedDatabase()`
   - No cache exists yet - direct DB write is appropriate

2. **Existing Database** (`database.ts:getDatabase()`):
   - Check for migrations via `applyTechMigrations()`
   - Apply schema changes if needed
   - Cache manager initializes after DB is ready

3. **Test Database** (`database.ts:initializeTestDatabase()`):
   - In-memory SQLite database
   - Synchronous seeding via `seedTestDatabase()`
   - Fresh database per test run

### Migration Implementation

**Process**:
1. Check if migration needed (column exists checks)
2. Run ALTER TABLE statements if needed
3. Set default values with UPDATE statements
4. No cache involvement - runs before cache init

**Examples**:
- `applyTechMigrations()` - Adds tech columns
- `applyMessagesMigrations()` - Creates messages table
- `applyDefenseCurrentValuesMigration()` - Adds defense columns

---

## Fix Implementation Plan

### Architecture Principles

**Single Source of Truth**: TypedCacheManager must be the authoritative source for all runtime data.

**Lock Ordering**: Compile-time enforced lock hierarchy:
```
Level 1: Cache Management Lock
Level 2: World Lock (Read: 2, Write: 2.4)
Level 2.5: User Lock  
Level 2.6: Message Lock (Read: 2.6, Write: 2.7)
Level 3: Database Lock (Read: 3, Write: 3.1)
```

**Dirty Tracking**: Cache tracks dirty entities and persists via background sync.

### Phase 1: Battle Cache Infrastructure

**Goal**: Add battle state to TypedCacheManager

**Changes**:
1. Add battle cache map to TypedCacheManager
2. Add battle lock at appropriate level (between User and Database)
3. Implement battle CRUD operations with proper locking
4. Add dirty tracking for battles
5. Implement battle persistence

**Lock Level**: 2.8 (between Message Write and Database Read)

**New Methods**:
- `getBattleUnsafe(battleId, context)` - Read from cache
- `setBattleUnsafe(battle, context)` - Write to cache
- `withBattleLock(context, fn)` - Acquire battle lock
- `loadBattleFromDbUnsafe(battleId, context)` - Load from DB
- `persistBattleToDb(battle)` - Save to DB

### Phase 2: Refactor Battle Operations

**Goal**: All battle state changes go through cache

**battleService.ts Changes**:
1. Replace `updateUserBattleState()` with cache operations
2. Replace `setShipSpeed()` with world cache writes
3. Replace `updateUserDefense()` with user cache writes
4. Replace `teleportShip()` with world cache writes
5. Update `initiateBattle()` to use cache for all state

**battleScheduler.ts Changes**:
1. Replace direct DB writes with cache operations
2. Update `updateUserBattleState()` to use cache
3. Use cache manager's message operations

**BattleRepo Changes**:
1. Keep as low-level DB operations (called by cache manager)
2. OR refactor to be cache-aware wrappers

### Phase 3: Refactor World Operations

**Goal**: World object mutations go through cache

**worldRepo.ts Changes**:
1. `deleteSpaceObject()` - Use cache world write lock
2. `insertSpaceObject()` - Use cache world write lock
3. Add methods to TypedCacheManager:
   - `deleteObjectUnsafe(objectId, worldCtx)`
   - `insertObjectUnsafe(object, worldCtx)`

### Phase 4: User Creation (Optional)

**Goal**: Consider caching new users immediately

**userRepo.ts Changes**:
- After creating user in DB, load into cache
- Ensures consistency from first access
- Low priority since current approach works

### Phase 5: Testing Strategy

**New Tests**:
1. Battle cache operations (CRUD)
2. Battle state updates via cache
3. World mutations via cache
4. Lock ordering with battle lock
5. Concurrent battle + user updates

**Existing Tests**:
- Verify all 320 tests still pass
- No behavior changes from user perspective
- Internal architecture change only

---

## Open Questions

### Q1: Battle Cache Strategy
**Question**: Should battles be fully cached or remain DB-only with invalidation?

**Options**:
- A) Full cache: Load battles into memory, dirty tracking, background persistence
- B) DB-only: Keep battles in DB, invalidate cache entries when battles update users

**Recommendation**: Full cache (A) for consistency with architecture.

### Q2: Lock Ordering for Battle + User + World
**Question**: How to safely update battle, user, and world in one transaction?

**Analysis**: Lock ordering must be: Cache → World → User → Battle → Database

**Solution**: Acquire locks in order, perform all updates, mark dirty, release.

### Q3: Message Creation in Battle
**Question**: Battle system creates messages - should this use cache or stay direct?

**Current**: Uses `sendMessageToUserCached()` - already cache-aware ✅

**Action**: No change needed.

### Q4: BattleRepo Architecture
**Question**: Should BattleRepo remain low-level or become cache-aware?

**Options**:
- A) Keep low-level: Used only by cache manager persistence
- B) Make cache-aware: Public API uses cache

**Recommendation**: Keep low-level (A) - called by cache persistence layer.

---

## Assumptions

### ✅ Confirmed Assumptions

1. **Initial bringup can bypass cache**: Database schema, seeding, migrations
2. **Lock ordering is enforced at compile-time**: TypedLocks system
3. **Background persistence handles DB sync**: Dirty tracking + async flush
4. **User registration can bypass cache initially**: Cached on first access
5. **Test database can use direct writes**: Isolated in-memory database

### 📋 Working Assumptions

1. **Battle lock level**: Place at 2.8 (between Message Write and Database)
2. **Performance acceptable**: Cache-based operations will be fast enough
3. **No breaking changes**: API behavior remains identical
4. **Tests pass after refactor**: 320 tests should continue passing

---

## Implementation Checklist

### Phase 1: Battle Cache Infrastructure
- [ ] Add battle cache map and dirty set
- [ ] Add TypedMutex for battle lock at level 2.8
- [ ] Implement getBattleUnsafe, setBattleUnsafe
- [ ] Implement withBattleLock
- [ ] Implement loadBattleFromDbUnsafe
- [ ] Implement persistBattleToDb
- [ ] Update lock ordering tests

### Phase 2: Refactor battleService.ts
- [ ] Refactor updateUserBattleState to use cache
- [ ] Refactor setShipSpeed to use world cache
- [ ] Refactor updateUserDefense to use user cache
- [ ] Refactor teleportShip to use world cache
- [ ] Refactor initiateBattle to use cache
- [ ] Refactor resolveBattle to use cache

### Phase 3: Refactor battleScheduler.ts
- [ ] Refactor updateUserBattleState to use cache
- [ ] Refactor fireWeapon to use cache
- [ ] Verify message creation uses cache

### Phase 4: Refactor World Operations
- [ ] Add deleteObjectUnsafe to TypedCacheManager
- [ ] Add insertObjectUnsafe to TypedCacheManager
- [ ] Refactor deleteSpaceObject to use cache
- [ ] Refactor insertSpaceObject to use cache

### Phase 5: Testing
- [ ] Run existing 320 tests
- [ ] Add battle cache tests
- [ ] Add world mutation tests
- [ ] Add concurrent operation tests
- [ ] Integration test full battle flow

---

## Risk Assessment

**Low Risk**:
- Initial bringup and migrations (no change)
- Message operations (already cache-aware)
- User registration (minimal impact)

**Medium Risk**:
- World mutations (deleteObject, insertObject)
- Battle scheduler (complex coordination)

**High Risk**:
- Battle service (many interconnected operations)
- Lock ordering (must maintain compile-time safety)

**Mitigation**:
- Implement incrementally with test validation at each step
- Use type system to enforce lock ordering
- Maintain existing test coverage

