# Project Learnings

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
