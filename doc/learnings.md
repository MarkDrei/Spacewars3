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

## Adding New User Fields Pattern

**Discovered by**: Cartographer  
**Context**: Planning the Teleport feature required adding new columns to the users table

**Details**: When adding new persistent fields to the User model, the following files must all be updated in lockstep:
1. `src/lib/server/schema.ts` — add column(s) to `CREATE_USERS_TABLE`, increment `SCHEMA_VERSION`
2. `src/lib/server/migrations.ts` — add new migration version with `ALTER TABLE ADD COLUMN IF NOT EXISTS`
3. `src/lib/server/user/user.ts` — add fields + constructor parameters (currently 18 params)
4. `src/lib/server/user/userRepo.ts` — update `UserRow` interface, `userFromRow()` deserialization (with fallback defaults), `saveUserToDb()` UPDATE query (currently $1-$24), and `createUser()` INSERT
5. No separate cache wiring needed — all data flows through `UserCache` write-behind persistence automatically

The `saveUserToDb` UPDATE uses positional `$N` params; the WHERE clause param number must be incremented when adding new columns. Currently WHERE uses `$24`; after adding 2 columns it would be `$26`.

## Research System Extension Pattern

**Discovered by**: Cartographer  
**Context**: Planning the Teleport feature, adding new researches

**Details**: To add a new research type to the game:
1. `src/shared/src/types/gameTypes.ts` — add value to `ResearchType` enum
2. `src/lib/server/techs/techtree.ts` — add to `AllResearches` map, `IMPLEMENTED_RESEARCHES` set, `TechTree` interface, `createInitialTechTree()`, `getResearchLevelFromTree()` switch, `updateTechTree()` switch
3. `src/lib/client/services/researchService.ts` — add field to client-side `TechTree` interface
4. `src/app/research/ResearchPageClient.tsx` — add to `researchHierarchy`, `researchTypeToKey`, and image mapping
5. `public/assets/images/research/` — add research icon image

The TechTree is stored as serialized JSON in the `tech_tree TEXT` column — NO schema migration is needed for new research fields. `createInitialTechTree()` provides defaults, and `userFromRow()` merges with initial tree on load (handles pre-existing users gracefully).

## CI / Local Test Run Failures Investigation (2026-02-26)

**Discovered by**: Copilot investigative agent  
**Context**: `npm run ci` and `npm run ci:local` were investigated in a cloud sandbox environment

### Three Root Causes Found

#### 1. `docker-compose` (v1) Not Available — Affects `npm run ci:local`

`npm run ci:local` calls `npm run test:local` which used `docker-compose` (Docker Compose v1 CLI). Modern systems and cloud sandboxes only ship Docker Compose v2, exposed as `docker compose` (without hyphen). This caused an immediate failure:

```
sh: 1: docker-compose: not found
```

**Fix**: Changed all `docker-compose` occurrences to `docker compose` in:
- `package.json` (`test:local` script)
- `.github/workflows/docker-build.yml`
- `README.md`
- Removed obsolete `version:` attribute from `docker-compose.yml` and `.devcontainer/docker-compose.yml` (causes a warning with Compose v2)

#### 2. Healthcheck Passes Before Database Is Initialized — Race Condition in `test:local`

Even after fixing the v1/v2 issue, tests failed with `database "spacewars_test" does not exist`. The cause is a race condition:

- `docker compose up -d` returns as soon as the container *starts* — not when the database inside it is ready.
- The healthcheck `pg_isready -U spacewars` checks via Unix socket. The PostgreSQL Docker entrypoint starts a *temporary* server (with `listen_addresses=''`, TCP disabled) while running init scripts. `pg_isready` via Unix socket can return OK *during* this init phase, before `POSTGRES_DB=spacewars_test` has been created.
- Tests connect immediately, before the database exists.

**Fix (two-part)**:
1. Changed `docker compose up -d` to `docker compose up --wait` (Compose v2 flag). This waits until all services with healthchecks report healthy.
2. Fixed the healthcheck itself to use `-h localhost` (TCP check):
   ```yaml
   test: ["CMD-SHELL", "pg_isready -h localhost -U $${POSTGRES_USER:-spacewars}"]
   ```
   TCP-based `pg_isready` only succeeds after PostgreSQL starts accepting TCP connections, which happens *after* the init scripts complete (including database creation).

#### 3. `CI=true` Environment Variable Overrides Local Port Detection

When `CI=true` is set (as it is in GitHub Actions *and* cloud sandboxes), `vitest.config.ts` auto-detects CI and uses `localhost:5432`. But `test:local` starts the test database on port `5433` (the `db-test` docker-compose service).

With both `CI=true` and `test:local` running, vitest connected to `localhost:5432/spacewars_test`, but the `db` container on port 5432 only has the `spacewars` database. Result: `database "spacewars_test" does not exist`.

**Fix**: Explicitly set `POSTGRES_TEST_HOST` and `POSTGRES_TEST_PORT` in the `test:local` script so they take priority over CI environment detection:

```json
"test:local": "docker compose up --wait db db-test && POSTGRES_TEST_HOST=localhost POSTGRES_TEST_PORT=5433 vitest run"
```

### Summary of All Changed Files

| File | Change |
|------|--------|
| `package.json` | `docker-compose` → `docker compose`, added `--wait`, added explicit test DB env vars |
| `.github/workflows/docker-build.yml` | `docker-compose` → `docker compose` |
| `README.md` | `docker-compose` → `docker compose` throughout |
| `docker-compose.yml` | Removed obsolete `version:`, fixed healthcheck to use `-h localhost` |
| `.devcontainer/docker-compose.yml` | Removed obsolete `version:` |

### Verification

After all fixes:
- `npm run ci` (with `CI=true` + PostgreSQL on `localhost:5432`): **✅ 999/1000 tests pass, build succeeds**
- `npm run ci:local` (with `CI=true` + fresh docker volumes): **✅ 999/1000 tests pass, build succeeds**
