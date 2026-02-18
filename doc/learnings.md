# Project Learnings

## Database Setup for Tests

### Issue Discovered (2026-02-10)

Tests require PostgreSQL databases to be running and the `POSTGRES_TEST_PORT` environment variable to be set to `5433`.

### Solution

1. Start both databases: `docker compose up db db-test -d`
2. Export the test port: `export POSTGRES_TEST_PORT=5433`
3. Run tests: `npm run test:ci`

## Time-Based Calculation Patterns in the Codebase

**Discovered by**: Cartographer  
**Context**: When planning the Time Multiplier feature, discovered the two distinct patterns for time calculations

**Two time-calculation patterns in the server:**

1. **Delta-based** (User stats, defense regen, research): `elapsed = now - lastTimestamp`, then uses `elapsed` in calculations. Timestamp updated to `now` after. Easy to apply a multiplier — just multiply the delta.

2. **Absolute-timestamp-based** (Build queue): `completionTime = startTime + duration`, then checks `now >= completionTime`. Harder to apply a multiplier because the duration is baked into an absolute time. Workaround: check `(now - startTime) * multiplier >= duration`.

**Key locations of time-based game logic (`Date.now()` calls):**

- `userCache.getUserByIdWithLock()` → calls `user.updateStats(Math.floor(Date.now() / 1000))`
- `TechService.processCompletedBuilds()` → `now = Math.floor(Date.now() / 1000)` for build completion
- `TechService.addTechItemToBuildQueue()` → `user.buildStartSec = Math.floor(Date.now() / 1000)`
- `battleScheduler.processBattleRoundInternal()` → `currentTime` for weapon cooldowns
- `worldCache.getWorldFromCache()` → `world.updatePhysics(context, Date.now())`
- Physics uses milliseconds (`Date.now()`), user stats use seconds (`Math.floor(Date.now() / 1000)`)

**TimeProvider interface** exists in `battleSchedulerUtils.ts` for test injection — not for game features. A time multiplier should be separate from this (multiplied deltas vs mocked time).

## Singleton Pattern for Test Isolation

**Discovered by**: Knight  
**Context**: When implementing Task 2.1.1 (Time Multiplier integration), discovered the correct pattern for singleton usage in testable code

**Pattern**: For singleton services that need to be reset between tests, use `getInstance()` pattern instead of exported singleton instance:

**❌ Don't do this** (breaks test isolation):

```typescript
// In service file
export const timeMultiplierService = TimeMultiplierService.getInstance();

// In consuming code
import { timeMultiplierService } from "../timeMultiplier";
const multiplier = timeMultiplierService.getMultiplier();
```

**✅ Do this** (allows test isolation):

```typescript
// In consuming code
import { TimeMultiplierService } from "../timeMultiplier";
const multiplier = TimeMultiplierService.getInstance().getMultiplier();
```

**Why**: The exported singleton instance is captured at module load time. When tests call `TimeMultiplierService.resetInstance()`, they reset the globalThis instance but not the imported reference. Using `getInstance()` at call time ensures you always get the current singleton instance.

**Implementation requirements**:

- Singleton must store instance in `globalThis` (not module-level)
- Must provide `resetInstance()` static method for tests
- Service class must be exported (not just the instance)
- Tests call `resetInstance()` in `beforeEach()` and `afterEach()`

**Related pattern**: This is consistent with other singletons in the codebase (UserCache, WorldCache, MessageCache, BattleCache) which all use globalThis-based singleton pattern.

## JSON Column Pattern for Structured User Data

**Discovered by**: Cartographer  
**Context**: When planning the Inventory feature, discovered the consistent pattern for storing structured data on users

**Details**: The users table uses TEXT columns with JSON serialization for complex structured data:
- `tech_tree TEXT` — serialized `TechTree` object
- `build_queue TEXT` — serialized `BuildQueueItem[]` array
- `inventory TEXT` — (planned) serialized 2D array for inventory grid

**Pattern**: In `userRepo.ts`, `userFromRow()` deserializes JSON with `JSON.parse()` and fallback defaults. `saveUserToDb()` serializes with `JSON.stringify()`. The data is always loaded/saved with the user, flowing through `UserCache` write-behind persistence. No separate cache needed for JSON-column data.

**When to use**: When adding structured data that is always accessed alongside the user record and doesn't need independent queries. For data that needs querying independently of users, use a separate table.

## User.collected() Return Type Evolution

**Discovered by**: Cartographer  
**Context**: Planning escape pod commander collection revealed that `User.collected()` returns `void`

**Details**: `User.collected(objectType)` currently returns `void`. The harvest API route computes `ironReward` by taking `user.iron - ironBefore` (comparing iron before/after). This pattern means the caller can't know what items were generated during collection. When extending collection to produce items (not just iron), the return type needs to change to a result object. The harvest route (`src/app/api/harvest/route.ts`) is the only caller of `collected()`.

## UserCache Write-Behind Persistence Pattern

**Discovered by**: Navigator  
**Context**: Planning inventory feature required understanding how UserCache handles persistence of new user properties

**Details**: UserCache implements a write-behind cache pattern for all user data:

1. **Reading**: API routes acquire USER_LOCK and call `userCache.getUserByIdWithLock()` which loads from cache or DB
2. **Mutation**: User domain methods modify properties in-place on the User object
3. **Marking Dirty**: API routes call `userCache.updateUserInCache(context, user)` after mutations to mark the user dirty
4. **Automatic Persistence**: UserCache's `persistUserToDb()` writes dirty users to DB:
   - Immediately in test mode (within transaction scope via `isTestMode` flag)
   - Periodically in production (30-second intervals via background timer)
5. **No Direct DB Access**: User properties added to the UPDATE query in `persistUserToDb()` are automatically persisted

**When adding new user properties**:
- Add field to User class and constructor
- Add to `UserRow` interface in userRepo.ts
- Add to CREATE TABLE in schema.ts  
- Add to `userFromRow()` deserialization (handle NULL/defaults)
- Add to `persistUserToDb()` UPDATE query in userCache.ts (with correct parameter index)
- Properties stored as JSON should use `JSON.stringify()` when persisting
- No separate cache or direct DB writes needed — the UserCache handles everything

**Migration Note**: New columns need a migration entry added to migrations.ts (e.g., `ALTER TABLE users ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value`).
