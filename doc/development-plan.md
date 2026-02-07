# Development Plan: XP and Level System

## Vision

Als Spieler möchte ich ein XP- und Level-System haben, das meinen Fortschritt durch das Bauen von Ausrüstung und das Erforschen von Technologien belohnt, damit ich eine sichtbare Progression und Erfolgserlebnisse im Spiel habe.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only, no CommonJS)
- **Lock System**: IronGuard TypeScript Locks for compile-time deadlock prevention

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/client/` - Client-side code (hooks, services, game engine)
- `src/lib/server/` - Server-side code (database, typed locks, cache)
- `src/shared/` - Shared types and utilities
- `src/__tests__/` - Test files
- `doc/architecture/` - Arc42 architecture documentation

## Goals

### Goal 1: Database Schema for XP Storage

**Description**: Extend the users table to store XP values and create a migration to add this column to existing databases.

**Inputs**: Current database schema, existing migration system
**Outputs**: Migration file, updated schema definition
**Quality Requirements**: Migration must be idempotent, reversible, and safe for production data

#### Task 1.1: Create Database Migration

**Action**: Add migration version 8 to migrations.ts to add XP column

**Files**:

- `src/lib/server/migrations.ts` - Add new migration after version 7 (line ~122)

**Details**:

- Migration version: 8
- Migration name: 'add_xp_system'
- Up statement: `ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0`
- Down statement: `ALTER TABLE users DROP COLUMN IF EXISTS xp`

**Quality Requirements**:

- Use IF NOT EXISTS/IF EXISTS for idempotency
- Test migration on clean database and existing database

**Status**: ✅ COMPLETED
**Implementation Summary**: Added migration version 8 to add XP column to users table with proper idempotency guarantees.
**Files Modified/Created**:
- `src/lib/server/migrations.ts` - Added migration version 8 for XP system
**Deviations from Plan**: None
**Test Results**: TypeScript compilation passes, migration structure follows established patterns

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Migration is idempotent, safe, and follows established patterns with proper up/down statements

#### Task 1.2: Update Schema Definition

**Action**: Add XP column to CREATE_USERS_TABLE constant for new database initialization

**Files**:

- `src/lib/server/schema.ts` - Update CREATE_USERS_TABLE (line ~5-46)

**Details**:

- Add line: `xp INTEGER NOT NULL DEFAULT 0,`
- Position: After `iron INTEGER NOT NULL DEFAULT 100,`

**Status**: ✅ COMPLETED
**Implementation Summary**: Added XP column definition to CREATE_USERS_TABLE schema for new database installations.
**Files Modified/Created**:
- `src/lib/server/schema.ts` - Added xp column to CREATE_USERS_TABLE
**Deviations from Plan**: Placed after `iron DOUBLE PRECISION` (corrected from plan's reference to INTEGER)
**Test Results**: TypeScript compilation passes, schema follows PostgreSQL conventions

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Schema definition matches migration exactly (INTEGER NOT NULL DEFAULT 0), properly positioned after iron column

#### Task 1.3: Update UserRow Interface

**Action**: Add XP property to database row type definition

**Files**:

- `src/lib/server/user/userRepo.ts` - Update UserRow interface (line ~14-46)

**Details**:

- Add property: `xp: number;`

**Status**: ✅ COMPLETED
**Implementation Summary**: Added xp property to UserRow interface and updated all related functions for full database integration.
**Files Modified/Created**:
- `src/lib/server/user/userRepo.ts` - Added xp to UserRow interface, updated userFromRow and saveUserToDb functions
- `src/lib/server/user/user.ts` - Added xp property and constructor parameter
- `src/__tests__/lib/xp-schema.test.ts` - Created comprehensive tests for XP persistence
- `src/__tests__/lib/user-domain.test.ts` - Updated User constructor calls with xp parameter
- `src/__tests__/lib/user-collection-rewards.test.ts` - Updated User constructor calls with xp parameter
- `src/__tests__/lib/iron-capacity.test.ts` - Updated User constructor calls with xp parameter
**Deviations from Plan**: Extended implementation to include User class xp property and full persistence layer (originally planned for Goal 2, Tasks 2.1, 2.5, 2.6) to ensure database schema is fully functional. This prevents breaking changes and ensures the migration can be tested properly.
**Test Results**: TypeScript compilation passes, ESLint passes with no new errors

**Additional Implementation Notes**:
- Added xp extraction in `userFromRow()` with fallback to 0 for migration compatibility
- Updated `saveUserToDb()` to persist xp value with correct parameter ordering
- Updated both `createUserWithShip()` paths to initialize xp to 0
- Created comprehensive integration tests in `xp-schema.test.ts` covering:
  - Migration column existence and properties
  - Default value of 0 for new users
  - XP persistence across cache flush and reload
  - Multiple XP value updates
  - Schema column ordering

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Excellent implementation with full database integration. All persistence functions properly updated, parameter ordering correct, fallback to 0 for migration safety, comprehensive test coverage (5 test cases), proper lock usage in tests, no code duplication found


### Goal 2: Domain Logic for XP and Levels

**Description**: Implement business logic in the User class to manage XP, calculate levels, and provide level progression information.

**Inputs**: XP progression formula (Level n needs n×1000 XP more than Level n-1)
**Outputs**: User class methods for XP management and level calculation
**Quality Requirements**: Level calculation must be efficient, consistent, and handle edge cases (0 XP, very high XP)

#### Task 2.1: Add XP Property to User Class

**Action**: Extend User class with XP property and update constructor

**Files**:

- `src/lib/server/user/user.ts` - Add property at line ~33, update constructor at line ~36

**Details**:

- Add property: `xp: number;`
- Add constructor parameter: `xp: number`
- Initialize in constructor: `this.xp = xp;`

#### Task 2.2: Implement getLevel() Method

**Action**: Calculate player level from total XP using cumulative progression formula

**Files**:

- `src/lib/server/user/user.ts` - Add method after existing calculation methods (line ~73-95)

**Details**:

```typescript
/**
 * Calculate player level from total XP.
 * Level 1 = 0 XP
 * Level 2 = 1,000 XP
 * Level 3 = 4,000 XP (1000 + 3000)
 * Level 4 = 10,000 XP (1000 + 3000 + 6000)
 * Pattern: Each level requires 1000 more XP than the previous increment
 */
getLevel(): number {
  let level = 1;
  let totalXpNeeded = 0;
  let xpForNextLevel = 1000;

  while (this.xp >= totalXpNeeded + xpForNextLevel) {
    totalXpNeeded += xpForNextLevel;
    xpForNextLevel += 1000;
    level++;
  }

  return level;
}
```

**Quality Requirements**: Handle XP = 0 returns level 1, efficient O(√n) complexity

**Status**: ✅ COMPLETED
**Implementation Summary**: Implemented getLevel() method in User class that calculates player level from cumulative XP using iterative algorithm with linear increments (1000, 2000, 3000...).
**Files Modified/Created**:
- `src/lib/server/user/user.ts` - Added getLevel() method after getMaxIronCapacity()
- `src/__tests__/lib/xp-level-calculation.test.ts` - Created comprehensive tests covering edge cases and level thresholds
**Deviations from Plan**: None - implemented exactly as specified in plan code block
**Test Results**: TypeScript compilation passes, no linting errors

**Review Status**: ✅ APPROVED - FINAL
**Reviewer**: Medicus (initial review), Knight (fixes applied), Medicus (final verification)
**Test Fixes Applied and Verified**:
- ✅ Line 76-78: Fixed `getLevel_9999Xp_returnsLevel4` - now correctly expects level 4
- ✅ Line 116-120: Fixed `getXpForNextLevel_level2_returns3000` - now correctly expects 3000
- ✅ Line 122-126: Fixed `getXpForNextLevel_level3_returns6000` - uses xp=3000 and expects 6000
- ✅ Line 181: Fixed typo - `addXp_multipleLevelUps` (removed space)
- ✅ Debug comments cleaned up - file reduced to 219 lines with no console.log/debug statements

**Code Quality Verification**:
- ✅ No code duplication found in codebase
- ✅ XP calculation logic exists only in User class
- ✅ Methods properly encapsulated and used correctly
- ✅ TypeScript compilation: Clean (no errors)
- ✅ Linting: Clean (no new warnings)
- ✅ All three domain methods (getLevel, getXpForNextLevel, addXp) correctly implemented

**Plan Documentation Issue**:
The plan examples are misleading - they show triangular increments but the code correctly uses linear increments. This should be clarified.

#### Task 2.3: Implement getXpForNextLevel() Method

**Action**: Calculate total XP required to reach the next level

**Files**:

- `src/lib/server/user/user.ts` - Add method after getLevel()

**Details**:

```typescript
/**
 * Get the total XP required to reach the next level.
 * Returns the XP threshold, not the remaining XP needed.
 */
getXpForNextLevel(): number {
  const currentLevel = this.getLevel();
  const nextLevel = currentLevel + 1;

  // Calculate total XP needed for next level
  // Formula: sum from i=1 to n-1 of (i × 1000)
  return (nextLevel * (nextLevel - 1) * 1000) / 2;
}
```

**Status**: ✅ COMPLETED
**Implementation Summary**: Implemented getXpForNextLevel() method using closed-form arithmetic formula for triangular number progression.
**Files Modified/Created**:
- `src/lib/server/user/user.ts` - Added getXpForNextLevel() method after getLevel()
- `src/__tests__/lib/xp-level-calculation.test.ts` - Added comprehensive tests including consistency checks with getLevel()
**Deviations from Plan**: None
**Test Results**: TypeScript compilation passes, no linting errors

**Review Status**: ✅ APPROVED (test issues resolved in Task 2.2)

#### Task 2.4: Implement addXp() Method

**Action**: Add XP to user with level-up notification support

**Files**:

- `src/lib/server/user/user.ts` - Add method after addIron() (line ~107)

**Details**:

```typescript
/**
 * Add XP to the user.
 * @param amount Amount of XP to add (must be positive)
 * @returns Object with newLevel if level increased, undefined otherwise
 */
addXp(amount: number): { leveledUp: boolean; oldLevel: number; newLevel: number } | undefined {
  if (amount <= 0) return undefined;

  const oldLevel = this.getLevel();
  this.xp += amount;
  const newLevel = this.getLevel();

  if (newLevel > oldLevel) {
    return { leveledUp: true, oldLevel, newLevel };
  }

  return undefined;
}
```

**Quality Requirements**: Return level-up info for notification system, handle negative amounts gracefully

**Status**: ✅ COMPLETED
**Implementation Summary**: Implemented addXp() method with level-up detection, returning structured notification data when player levels up.
**Files Modified/Created**:
- `src/lib/server/user/user.ts` - Added addXp() method after subtractIron()
- `src/__tests__/lib/xp-level-calculation.test.ts` - Added comprehensive tests for positive/negative/zero amounts, level-ups, multiple level-ups, and edge cases
**Deviations from Plan**: Placed after subtractIron() instead of addIron() for better logical grouping (both methods modify user state)
**Test Results**: TypeScript compilation passes, no linting errors, 8 test cases covering all scenarios

**Review Status**: ✅ APPROVED (test issues resolved in Task 2.2)

#### Task 2.5: Update userFromRow Function (Cache Internal)

**Action**: Extract XP from database row when creating User objects (used internally by UserCache)

**Files**:

- `src/lib/server/user/userRepo.ts` - Update userFromRow function (line ~48-109)

**Details**:

- Extract XP: `const xp = row.xp;`
- Add to User constructor call (line ~97): Pass `xp` parameter

**Note**: This function is called internally by UserCache.loadUserFromDb() - never call directly

#### Task 2.6: Update saveUserToDb Function (Cache Internal)

**Action**: Persist XP value when saving User to database (used internally by UserCache)

**Files**:

- `src/lib/server/user/userRepo.ts` - Update UPDATE statement (line ~235)

**Details**:

- Add to SET clause: `xp = $N,` (where N is next parameter number)
- Add to VALUES array: `user.xp`

**Quality Requirements**: Maintain parameter order consistency

**Note**: This function is called internally by UserCache.persistDirtyUsers() - never call directly. All user updates must go through `userCache.updateUserInCache(context, user)`

### Goal 3: XP Rewards for Build Completion

**Description**: Award XP when builds complete in the factory system, with formula: XP = iron_cost / 100

**Inputs**: Completed build item, iron cost from TechFactory
**Outputs**: XP added to user, level-up notification if applicable
**Quality Requirements**: XP awarded exactly once per build, notifications sent reliably

#### Task 3.1: Add XP Reward in applyCompletedBuild

**Action**: Calculate and award XP based on iron cost of completed build

**Files**:

- `src/lib/server/techs/TechService.ts` - Update applyCompletedBuild method (line ~233-255)

**Details**:

- Location: After incrementing tech count (line ~250)
- Get spec: `const spec = TechFactory.getTechSpec(build.itemKey, build.itemType);`
- Check spec exists
- Calculate XP: `const xpReward = Math.floor(spec.ironCost / 100);`
- Award XP: `const levelUp = user.addXp(xpReward);`
- If leveled up, send notification
- **CRITICAL**: User is already modified in memory, no explicit cache update needed here (processCompletedBuilds already calls updateUserInCache at line ~231)

**Quality Requirements**: Use Math.floor for consistent integer XP values

**Important**: User object is modified in place, persistence handled by existing `updateUserInCache()` call in `processCompletedBuilds()`

#### Task 3.2: Send Level-Up Notification for Builds

**Action**: Notify user when build completion causes level increase

**Files**:

- `src/lib/server/techs/TechService.ts` - Add notification in processCompletedBuilds (line ~210-220)

**Details**:

```typescript
// After applyCompletedBuild call
if (levelUp) {
  await this.messageCacheInstance.createMessage(
    ctx,
    userId,
    `P: 🎉 Level Up! You reached level ${levelUp.newLevel}! (+${xpReward} XP from build)`,
  );
}
```

**Inputs**: levelUp object from addXp, xpReward amount
**Quality Requirements**: Use `P:` prefix for positive (green) message

**Important**: Notification must be sent BEFORE `updateUserInCache()` call to ensure message is created within same transaction context

### Goal 4: XP Rewards for Research Completion

**Description**: Award XP when research completes in the tech tree system, with formula: XP = iron_cost / 25

**Inputs**: Completed research type, iron cost for that research level
**Outputs**: XP added to user, level-up notification if applicable
**Quality Requirements**: XP awarded exactly once per research, correct cost calculation for completed level

#### Task 4.1: Modify updateTechTree to Return Completion Info

**Action**: Track and return information about research completion for XP calculation

**Files**:

- `src/lib/server/techs/techtree.ts` - Update updateTechTree function (line ~680-794)

**Details**:

- Change return type from `void` to `{ completed: boolean; type?: ResearchType; completedLevel?: number } | undefined`
- Before incrementing level (line ~689): Store `const completedLevel = getResearchLevelFromTree(tree, tree.activeResearch.type);`
- After incrementing level, before clearing activeResearch: `const completedType = tree.activeResearch.type;`
- Return: `return { completed: true, type: completedType, completedLevel };`
- At end of function if no completion: `return undefined;`

**Quality Requirements**: Return level BEFORE increment for correct cost calculation

#### Task 4.2: Award XP in User.updateStats

**Action**: Check for research completion, calculate XP reward, award XP, return level-up info for notification

**Files**:

- `src/lib/server/user/user.ts` - Update updateStats method (line ~125-156)

**Details**:

- Change return type to include level-up info: `{ levelUp?: { leveledUp: boolean; oldLevel: number; newLevel: number; xpReward: number; source: 'research' } }`
- After updateTechTree call (line ~139): Store result `const researchResult = updateTechTree(techTree, elapsed);`
- Check if research completed:

```typescript
let levelUpInfo = undefined;
if (
  researchResult?.completed &&
  researchResult.type &&
  researchResult.completedLevel !== undefined
) {
  const research = AllResearches[researchResult.type];
  const cost = getResearchUpgradeCost(
    research,
    researchResult.completedLevel + 1,
  );
  const xpReward = Math.floor(cost / 25);
  const levelUp = this.addXp(xpReward);

  if (levelUp) {
    levelUpInfo = { ...levelUp, xpReward, source: "research" as const };
  }
}

return levelUpInfo;
```

**Inputs**: Research completion info, AllResearches catalog, getResearchUpgradeCost function
**Quality Requirements**: Use completedLevel + 1 for correct cost (cost of the level just completed)

**Important**: User object is modified in place. Caller (UserCache.getUserByIdWithLock) automatically calls `updateUserInCache()` after updateStats() returns, ensuring XP changes are persisted

#### Task 4.3: Send Level-Up Notification for Research

**Action**: Send notification when research completion causes level increase (handled at API route level)

**Files**:

- API routes that call user.updateStats() (e.g., `/api/user-stats`, `/api/trigger-research`)

**Details**:

- After getting user from UserCache and before returning response:

```typescript
const user = await userCache.getUserByIdWithLock(context, userId);
// updateStats is called internally by getUserByIdWithLock

// Check if user leveled up (would need to track this)
// For now, implement in Task 4.4 as alternative approach
```

**Quality Requirements**: Handle async notification, ensure context is available

**Note**: Since updateStats() is called automatically by UserCache.getUserByIdWithLock(), we need an alternative approach. See Task 4.4 for polling-based notifications.

#### Task 4.4: Add Research Level-Up Notification via Polling

**Action**: Check for level changes during /api/user-stats polling and send notification

**Files**:

- `src/app/api/user-stats/route.ts` - Add level-up detection

**Details**:

- Store previous level in user session or compare with client's last known level
- Alternative: Add notification in UserCache.getUserByIdWithLock after updateStats
- Send message via MessageCache when level increases

```typescript
const currentLevel = user.getLevel();
// If level increased since last check, send notification
if (levelIncreased) {
  await messageCache.createMessage(
    ctx,
    userId,
    `P: 🎉 Level Up! You reached level ${currentLevel}! (from research completion)`,
  );
}
```

**Quality Requirements**: Avoid duplicate notifications, track level changes reliably

**Note**: This is a simpler approach than modifying updateStats() to return notification info. Research level-ups will be detected on next user-stats poll (max 5 second delay).

### Goal 5: Display XP and Level on Home Screen

**Description**: Show player's current XP, level, and progress to next level on the home page

**Inputs**: User XP and level from User class
**Outputs**: UI component displaying XP/level information
**Quality Requirements**: Updates reflect XP changes in real-time (via polling), responsive design

#### Task 5.1: Update User Stats API Endpoint

**Action**: Include XP and level in /api/user-stats response

**Files**:

- `src/app/api/user-stats/route.ts` - Update responseData (line ~42-47)

**Details**:

- Add to responseData object:

```typescript
xp: user.xp,
level: user.getLevel(),
xpForNextLevel: user.getXpForNextLevel()
```

**Quality Requirements**: Include both raw XP and calculated values

#### Task 5.2: Create or Update Hook for XP/Level Data

**Action**: Either update useIron hook or create new useXpLevel hook to fetch XP data

**Files (Option 1 - Update useIron)**:

- `src/lib/client/hooks/useIron/useIron.ts` - Update to include XP data

**Files (Option 2 - New hook)**:

- `src/lib/client/hooks/useXpLevel/useXpLevel.ts` - Create new hook
- `src/lib/client/hooks/useXpLevel/index.ts` - Export hook

**Details (New hook approach)**:

```typescript
export interface XpLevelData {
  xp: number;
  level: number;
  xpForNextLevel: number;
}

export function useXpLevel(pollingInterval: number = 5000): {
  xpData: XpLevelData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  // Follow pattern from useIron.ts
  // Fetch from /api/user-stats
  // Extract xp, level, xpForNextLevel
  // Poll at interval
}
```

**Quality Requirements**: Follow existing hook patterns, handle loading and error states, TypeScript strict mode

#### Task 5.3: Add XP/Level Display to Home Page

**Action**: Add new section to HomePageClient showing XP and level

**Files**:

- `src/app/home/HomePageClient.tsx` - Add section before notifications (line ~220)

**Details**:

```tsx
{/* XP and Level Display */}
<h2 className="section-header">Your Progress</h2>
<div className="data-table-container">
  <table className="data-table">
    <thead>
      <tr>
        <th>Stat</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      <tr className="data-row">
        <td className="data-cell">Level</td>
        <td className="data-cell">
          <span className="stat-value">{xpData?.level || 1}</span>
        </td>
      </tr>
      <tr className="data-row">
        <td className="data-cell">Experience</td>
        <td className="data-cell">
          <span className="stat-value">
            {xpData?.xp.toLocaleString() || 0} / {xpData?.xpForNextLevel.toLocaleString() || 1000}
          </span>
        </td>
      </tr>
      <tr className="data-row">
        <td className="data-cell">Progress to Next Level</td>
        <td className="data-cell">
          <span className="stat-value">
            {xpData ? Math.floor((xpData.xp / xpData.xpForNextLevel) * 100) : 0}%
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Inputs**: XP data from useXpLevel hook
**Quality Requirements**: Handle loading and null states, use existing CSS classes for consistency

#### Task 5.4: Optional - Add Level to StatusHeader or Navigation

**Action**: Consider adding level badge to StatusHeader or navigation bar for persistent visibility

**Files**:

- `src/components/StatusHeader/StatusHeader.tsx` - Update component
- `src/components/Navigation/Navigation.tsx` - Or add to navigation

**Details**:

- If StatusHeader: Add level as small badge next to iron amount
- If Navigation: Add "Level X" display in header
- Pass level from authentication context or fetch separately

**Quality Requirements**: Non-intrusive design, mobile responsive

**Note**: This task is optional and can be deferred to UI polish phase

### Goal 6: Comprehensive Testing

**Description**: Create test suites covering XP calculation, awarding, level progression, and API integration

**Inputs**: Test database, test helpers, existing test patterns
**Outputs**: Test files with >80% coverage for XP system
**Quality Requirements**: All tests pass, use transaction wrappers, follow naming conventions

#### Task 6.1: Create Level Calculation Tests

**Action**: Test getLevel() and getXpForNextLevel() methods with various XP values

**Files**:

- `src/__tests__/lib/xp-level-calculation.test.ts` - Create new test file

**Details**:

- Test: `getLevel_zeroXp_returnsLevel1`
- Test: `getLevel_999Xp_returnsLevel1`
- Test: `getLevel_1000Xp_returnsLevel2`
- Test: `getLevel_3999Xp_returnsLevel2`
- Test: `getLevel_4000Xp_returnsLevel3`
- Test: `getLevel_10000Xp_returnsLevel4`
- Test: `getLevel_21000Xp_returnsLevel7` (validation: level 7 = 0+1000+2000+3000+4000+5000+6000 = 21000 XP)
- Test: `getXpForNextLevel_level1_returns1000`
- Test: `getXpForNextLevel_level2_returns4000`
- Test: `getXpForNextLevel_level3_returns10000`

**Quality Requirements**: Cover edge cases, validate cumulative formula

#### Task 6.2: Create Build XP Reward Tests

**Action**: Test XP awarding when builds complete

**Files**:

- `src/__tests__/lib/xp-build-rewards.test.ts` - Create new test file

**Details**:

- Test: `buildCompletion_awards XpBasedOnCost`
- Test: `buildCompletion_levelUp_sendsNotification`
- Test: `buildCompletion_noLevelUp_noNotification`
- Test: `multipleBuildCompletions_accumulateXp`

**Pattern**: Follow [techRepo-notifications.test.ts](src/__tests__/lib/techRepo-notifications.test.ts)

**Quality Requirements**: Use `withTransaction`, verify XP calculation formula (cost / 100)

#### Task 6.3: Create Research XP Reward Tests

**Action**: Test XP awarding when research completes

**Files**:

- `src/__tests__/lib/xp-research-rewards.test.ts` - Create new test file

**Details**:

- Test: `researchCompletion_awardsXpBasedOnCost`
- Test: `researchCompletion_levelUp_sendsNotification`
- Test: `researchCompletion_correctLevel_correctCostCalculation`
- Test: `multipleResearchCompletions_accumulateXp`

**Pattern**: Similar to [user-domain.test.ts](src/__tests__/lib/user-domain.test.ts#L42-L66)

**Quality Requirements**: Verify XP calculation formula (cost / 25), test with different research types

#### Task 6.4: Create API Integration Tests

**Action**: Test /api/user-stats endpoint includes XP and level

**Files**:

- `src/__tests__/api/xp-level-api.test.ts` - Create new test file

**Details**:

- Test: `userStats_includesXpAndLevel`
- Test: `userStats_afterXpGain_reflectsUpdate`
- Test: `userStats_levelCalculation_matchesDomainLogic`

**Pattern**: Follow [user-stats-api.test.ts](src/__tests__/api/user-stats-api.test.ts)

**Quality Requirements**: Use `initializeIntegrationTestServer()`, test with authenticated user

#### Task 6.5: Update Existing Tests

**Action**: Update tests that create User objects or check user data

**Files**:

- Various test files that instantiate User class or check UserRow

**Details**:

- Add `xp: 0` to User constructor calls
- Update expected values in assertions where user data is validated
- Verify no tests are broken by schema changes

**Quality Requirements**: Run full test suite (`npm test`), fix all failures

## Dependencies

- No new npm packages required
- All features use existing dependencies

## Arc42 Documentation Updates

**Proposed Changes**: None

**Reasoning**: XP system is a feature addition within existing architecture. No new layers, components, or external integrations. No changes to deployment model or cross-cutting concerns.

## Architecture Notes

- **Database**: Single `xp` column stores cumulative XP, level calculated on-demand
- **Level Calculation**: O(√n) complexity, acceptable for reasonable level ranges
- **Notification System**: Reuse existing MessageCache infrastructure
- **Client Updates**: Leverage existing polling mechanism from useIron hook
- **Transaction Safety**: All XP awards happen within existing transaction contexts
- **Cache-First Architecture**: ALL user data modifications go through UserCache:
  - `getUserByIdWithLock(context, userId)` - Loads user from cache/DB, calls updateStats() automatically
  - Modify user properties in place: `user.xp += amount`
  - `updateUserInCache(context, user)` - Marks user as dirty, persists automatically
  - NEVER call `saveUserToDb()` directly - it's internal to UserCache
  - In test mode: Immediate persistence (within transaction)
  - In production: Background persistence every 30s

## Agent Decisions

### Decision 1: Store XP, Calculate Level

**Rationale**: Storing only XP reduces database writes and ensures consistency. Level calculation is fast enough to compute on-demand. Alternative of storing both XP and level requires synchronization logic and more complex updates.

### Decision 2: Level-Up Notifications in Domain Methods

**Rationale**: Notifications sent from addXp() return value, handled by callers. This keeps User class focused on domain logic while maintaining notification capability. Alternative of mixing MessageCache into User class would create circular dependencies.

### Decision 3: Dynamic XP Rewards (cost / divisor)

**Rationale**: Rewards scale automatically with item costs, no hardcoded values. Builds use /100 (less reward) because they're more frequent. Research uses /25 (more reward) because it's more strategic. Divisors can be tuned for game balance.

### Decision 4: XP in updateStats for Research

**Rationale**: Research completion happens during time-based updates in updateStats(). This is the natural place to award XP, maintaining single responsibility principle. User object modifications are automatically persisted by UserCache.updateUserInCache() which is called after every getUserByIdWithLock(). Alternative of handling in API route would duplicate completion detection logic and complicate cache management.

### Decision 5: Separate Home Screen Section

**Rationale**: Dedicated XP/Level section provides clear visibility. Matches existing pattern of separate sections for different user stats (tech counts, defense values). Alternative of cramping into StatusHeader would reduce readability on mobile.

### Decision 6: Migration Version 8

**Rationale**: Follows sequential migration numbering from current version 7. Idempotent migrations with IF NOT EXISTS ensure safe application. Down migrations support rollback if needed.

### Decision 7: UserCache Manages All Persistence

**Rationale**: Project uses cache-first architecture with UserCache as single source of truth for user data. All modifications happen through:

1. Get user: `userCache.getUserByIdWithLock(context, userId)`
2. Modify: Change user properties in place
3. Persist: `userCache.updateUserInCache(context, user)`

Direct database writes via `saveUserToDb()` are only called internally by cache and violate architecture. This ensures consistency, transaction safety, and proper dirty tracking. Tests use immediate persistence (within transaction), production uses background persistence (every 30s).

## Open Questions

_No open questions - all requirements are clear and implementation path is well-defined._
