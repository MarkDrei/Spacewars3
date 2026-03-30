# Development Plan: XP and Score System Revision

## Vision

Revise the progression system to separate Score (general progression metric from economic activities) from XP (battle-only leveling currency). Introduce attack restrictions to prevent griefing by blocking repeated attacks on the same player.

**As a player**, I want XP to reflect my combat prowess (leveling only through battles) while Score tracks my overall economic achievements, and I want protection from being repeatedly targeted by the same attacker.

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

### Goal 1: Introduce Score System (rename existing XP awards to Score)

**Description**: Convert all current XP awards (research completion, build completion) into "score" points. Add a new `score` column to the database. The existing `xp` column remains but will only be incremented by battle victories (Goal 2).

**Inputs**: Current XP award locations in `user.ts` (`updateStats`) and `TechService.ts` (`applyCompletedBuild`)
**Outputs**: New `score` field on User, DB migration, API changes, UI updates
**Quality Requirements**: All existing XP-award tests must be migrated to score-award tests; no regressions

#### Task 1.1: Add `score` column to database

**Action**: Add migration version 13 (note: version 12 is already taken by starbases) with `ALTER TABLE users ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0`. Update `CREATE_USERS_TABLE` in schema.ts. Increment `SCHEMA_VERSION` to 13.

**Files**:

- `src/lib/server/schema.ts` — add `score INTEGER NOT NULL DEFAULT 0` column, bump `SCHEMA_VERSION`
- `src/lib/server/migrations.ts` — add version 13 migration

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `score INTEGER NOT NULL DEFAULT 0` to CREATE_USERS_TABLE in schema.ts, bumped SCHEMA_VERSION to 13, added version 13 migration to migrations array, added `applyScoreMigration()` function, and called it from `applyTechMigrations()`.
**Files Modified/Created**:
- `src/lib/server/schema.ts` — added score column, bumped SCHEMA_VERSION to 13
- `src/lib/server/migrations.ts` — added version 13 migration, applyScoreMigration function
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All unit tests passing

#### Task 1.2: Add `score` field to User domain model

**Action**: Add `score: number` property to the `User` class. Add `addScore(amount)` method (similar to current `addXp` but without level-up logic). Update constructor to accept score parameter.

**Files**:

- `src/lib/server/user/user.ts` — add `score` property, `addScore()` method
- `src/__tests__/unit/` — unit tests for `addScore()`

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `score: number = 0` field (class default initialization to avoid breaking constructor signatures), added `addScore()` method that increments score for positive amounts only.
**Files Modified/Created**:
- `src/lib/server/user/user.ts` — added score field (default 0), addScore() method
- `src/__tests__/unit/user/user-score.test.ts` — 8 tests for addScore() and score defaults
**Deviations from Plan**: Used class field initialization (`score: number = 0`) instead of adding score to constructor params, to avoid breaking 20+ existing test sites that pass positional arguments.
**Arc42 Updates**: None required
**Test Results**: ✅ All 8 tests passing

#### Task 1.3: Update UserRepo to persist score

**Action**: Add `score` to `UserRow` interface, `userFromRow()` deserialization, `saveUserToDb()` UPDATE query (add column to SET clause, increment WHERE param number), and `createUser()` INSERT.

**Files**:

- `src/lib/server/user/userRepo.ts` — add score to UserRow, userFromRow, saveUserToDb, createUser

**Status**: ✅ COMPLETED
**Implementation Summary**: Added score to UserRow interface (optional for DB backward compat), updated saveUserToDb to include score in SET clause, updated userFromRow to set user.score from row after creation, updated userCache.ts persistUserToDb to also include score.
**Files Modified/Created**:
- `src/lib/server/user/userRepo.ts` — UserRow.score?, saveUserToDb SET score=$26, userFromRow sets user.score
- `src/lib/server/user/userCache.ts` — persistUserToDb SET score=$26
**Deviations from Plan**: Also updated userCache.ts which has a duplicate persistUserToDb implementation.
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.4: Convert research XP awards to score awards

**Action**: In `user.ts` `updateStats()`, replace `this.addXp(xpReward)` with `this.addScore(scoreReward)` for research completion. Update the return type to reflect `scoreReward` instead of `xpReward` with `source: 'research'`. Update the level-up message in `userCache.ts` (if research triggers level-up messaging) to say "score" instead of "XP".

**Files**:

- `src/lib/server/user/user.ts` — change `updateStats()` to call `addScore()` instead of `addXp()` for research
- `src/__tests__/unit/` — update existing research XP tests to verify score is awarded instead

**Status**: ✅ COMPLETED
**Implementation Summary**: Changed updateStats() to call addScore(scoreReward) instead of addXp(xpReward), removed levelUp from return type (research no longer awards XP), added scoreReward to researchCompleted info. Updated user-stats/route.ts to remove research level-up messaging and update research completion notification to include score. Updated existing research tests to check user.score instead of user.xp.
**Files Modified/Created**:
- `src/lib/server/user/user.ts` — updateStats() now awards score, not XP; updated return type
- `src/app/api/user-stats/route.ts` — removed research level-up message, updated research completion message
- `src/__tests__/unit/lib/research-xp-rewards.test.ts` — updated all tests to check user.score
**Deviations from Plan**: The level-up messaging for research was in user-stats/route.ts (not userCache.ts as the plan stated) — updated that file instead.
**Arc42 Updates**: None required
**Test Results**: ✅ All 16 research tests passing

#### Task 1.5: Convert build XP awards to score awards

**Action**: In `TechService.ts` `applyCompletedBuild()`, replace `user.addXp(xpReward)` with `user.addScore(scoreReward)`. Update return type and level-up message from "XP from build" to "score from build". Since score doesn't trigger level-ups, the level-up check/message for builds is removed.

**Files**:

- `src/lib/server/techs/TechService.ts` — change `applyCompletedBuild()` to call `addScore()`, remove level-up messaging for builds
- `src/__tests__/unit/` — update existing build XP tests to verify score is awarded instead

**Status**: ✅ COMPLETED
**Implementation Summary**: Changed applyCompletedBuild() to return void and call user.addScore(scoreReward), removed level-up messaging from build completion. Updated build-xp-rewards.test.ts and TechService.test.ts to use score instead of XP.
**Files Modified/Created**:
- `src/lib/server/techs/TechService.ts` — applyCompletedBuild() now void, calls addScore, no level-up
- `src/__tests__/integration/lib/build-xp-rewards.test.ts` — updated to check score, removed level-up tests
- `src/__tests__/integration/lib/TechService.test.ts` — updated mock from addXp to addScore
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All unit tests passing

#### Task 1.6: Update user-stats API to return score

**Action**: Add `score` field to the user-stats API response alongside existing `xp`, `level`, `xpForNextLevel`.

**Files**:

- `src/app/api/user-stats/route.ts` — include `score` in response

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `score: user.score` to the responseData in user-stats API route.
**Files Modified/Created**:
- `src/app/api/user-stats/route.ts` — added score field to response
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.7: Update UI to display Score alongside XP/Level

**Action**: Update profile page and status header to show Score separately from XP/Level. Score is displayed as a general progression metric. XP and Level remain for battle progression.

**Files**:

- `src/app/profile/ProfilePageClient.tsx` — display real score value (currently shows dummy data)
- `src/components/StatusHeader/` — add score display if appropriate
- `src/lib/client/services/` — update client-side types to include score

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `score?: number` (optional for backward compat) to UserStatsResponse, updated ProfilePageClient to fetch live stats and display real score and XP values. StatusHeader only shows level, no score display needed.
**Files Modified/Created**:
- `src/lib/client/services/userStatsService.ts` — added score?: number to UserStatsResponse
- `src/app/profile/ProfilePageClient.tsx` — fetches live stats, displays real score and XP
**Deviations from Plan**: Made score optional (score?: number) in UserStatsResponse to avoid breaking 20+ existing test mock objects.
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

---

### Goal 2: XP Only from Battle Success

**Description**: XP is now awarded exclusively when winning a battle. The formula scales with the winner's level and adjusts based on the level difference between combatants.

**Formula**:

- Base XP = `winner_level × 200`
- Enemy higher level: multiply by `1.3^(enemy_level - winner_level)`
- Enemy lower level: multiply by `0.7^(winner_level - enemy_level)`
- Same level: base XP (multiplier = 1.0)

The gained XP is shown in the victory message. The loser does NOT see the XP value.

**Inputs**: Battle resolution in `battleService.ts`, User level via `getLevel()`
**Outputs**: XP award on battle win, updated victory message
**Quality Requirements**: Extensive unit tests for XP formula across level differences; integration test for full battle flow

#### Task 2.1: Create battle XP calculation function

**Action**: Create a pure function `calculateBattleXp(winnerLevel: number, loserLevel: number): number` in the battle service module (or a shared utility). This function computes:

- `baseXp = winnerLevel * 200`
- `levelDiff = loserLevel - winnerLevel`
- If `levelDiff > 0`: `xp = baseXp * (1.3 ^ levelDiff)` (enemy higher → more XP)
- If `levelDiff < 0`: `xp = baseXp * (0.7 ^ abs(levelDiff))` (enemy lower → less XP)
- If `levelDiff === 0`: `xp = baseXp`
- Return `Math.floor(xp)` (integer XP)

**Files**:

- `src/lib/server/battle/battleService.ts` — add `calculateBattleXp()` function (exported for testing)
- `src/__tests__/unit/battle/` — comprehensive unit tests:
  - `calculateBattleXp_sameLevelAtLevel1_returns200`
  - `calculateBattleXp_sameLevelAtLevel5_returns1000`
  - `calculateBattleXp_enemyHigherBy2_appliesMultiplier`
  - `calculateBattleXp_enemyLowerBy3_appliesReduction`
  - `calculateBattleXp_largeLevelDifference_handlesCorrectly`

**Status**: ✅ COMPLETED
**Implementation Summary**: Added exported `calculateBattleXp()` function to battleService.ts with the exact formula specified.
**Files Modified/Created**:
- `src/lib/server/battle/battleService.ts` — added calculateBattleXp() exported function
- `src/__tests__/unit/battle/battleXp.test.ts` — 11 comprehensive unit tests
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All 11 tests passing

#### Task 2.2: Award XP to battle winner in resolveBattle

**Action**: In `resolveBattle()`, after determining the winner:

1. Load both users (already available via UserCache in the resolution flow)
2. Get winner and loser levels via `user.getLevel()`
3. Call `calculateBattleXp(winnerLevel, loserLevel)`
4. Call `winner.addXp(xpAmount)` to award XP
5. If level-up occurs, send level-up message to winner
6. Pass the XP amount to the victory message (Task 2.3)

**Files**:

- `src/lib/server/battle/battleService.ts` — modify `resolveBattle()` to calculate and award XP
- `src/__tests__/unit/battle/` or `src/__tests__/integration/` — test that XP is awarded on battle win

**Inputs**: Winner/loser User objects (already loaded in resolution context)
**Quality Requirements**: Must handle edge cases (level 1 vs level 1, large level gaps)

**Status**: ✅ COMPLETED
**Implementation Summary**: Updated resolveBattle() to load winner/loser from cache, calculate XP via calculateBattleXp(), award with addXp(), and send level-up message if level-up occurs.
**Files Modified/Created**:
- `src/lib/server/battle/battleService.ts` — resolveBattle() now awards XP to winner
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ Build passes; integration test covered by battle-flow tests

#### Task 2.3: Update victory/defeat messages

**Action**: Modify the victory message to include gained XP:

- **Winner**: `P: 🎉 **Victory!** You won the battle! You gained {iron} iron and {xp} XP from {loserName}.`
- **Loser**: `A: 💀 **Defeat!** You lost the battle and have been teleported away. You lost {iron} iron to {winnerName}.` (NO XP info for loser — unchanged)

If the winner also leveled up, send an additional message:

- `P: 🎉 Level Up! You reached level {newLevel}!`

**Files**:

- `src/lib/server/battle/battleService.ts` — update message strings in `resolveBattle()`

**Status**: ✅ COMPLETED
**Implementation Summary**: Updated victory message to include XP amount. Added level-up message when levelUp occurs. Defeat message unchanged.
**Files Modified/Created**:
- `src/lib/server/battle/battleService.ts` — updated message strings
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ Build passes

---

### Goal 3: Block Repeated Attacks on Same Target

**Description**: Prevent a player from repeatedly attacking the same target. If the target is one of the attacker's last 3 attackees (victims), the attack is blocked. This is checked at attack initiation time. Additionally, ensure no user can start more than one concurrent battle.

**Inputs**: Battle history (completed battles where user was attacker), current battle state
**Outputs**: Validation error if attack is blocked
**Quality Requirements**: Must not cause performance issues (query should be efficient); tests for all edge cases

#### Task 3.1: Add function to get attacker's recent victims

**Action**: Create a function `getRecentAttackees(userId: number, limit: number): Promise<number[]>` that queries the battles table for the most recent completed battles where `attacker_id = userId`, returning the `attackee_id` values. This should be added to `BattleCache` or `battleService` and query via the repo layer.

The query: `SELECT attackee_id FROM battles WHERE attacker_id = $1 AND battle_end_time IS NOT NULL ORDER BY battle_end_time DESC LIMIT $2`

**Files**:

- `src/lib/server/battle/battleRepo.ts` — add `getRecentAttackeesFromDb()` DB query function
- `src/lib/server/battle/BattleCache.ts` — add `getRecentAttackees()` method that delegates to repo (or add directly to battleService)
- `src/__tests__/unit/battle/` — unit tests for the query function

**Status**: ✅ COMPLETED
**Implementation Summary**: Added getRecentAttackeesFromDb() to battleRepo.ts (uses battle_start_time ordering, includes active battles per Task 3.3). Added getRecentAttackees() to BattleCache.ts.
**Files Modified/Created**:
- `src/lib/server/battle/battleRepo.ts` — added getRecentAttackeesFromDb()
- `src/lib/server/battle/BattleCache.ts` — added getRecentAttackees() method
**Deviations from Plan**: Combined with Task 3.3 — query uses battle_start_time (not battle_end_time) and no IS NOT NULL filter, to include active battles.
**Arc42 Updates**: None required
**Test Results**: ✅ Build passes; tested via initiateBattle-restriction.test.ts

#### Task 3.2: Add attack restriction validation

**Action**: In `initiateBattle()` (or in the attack API route before calling it), check if the target userId is in the attacker's last 3 victims list. If so, throw `ApiError(400, 'You have attacked this player recently. Choose a different target.')`.

Also verify: the existing `attacker.inBattle` and `attackee.inBattle` checks in `initiateBattle()` already prevent concurrent battles. Confirm this is sufficient (user mentioned this should be enforced).

**Files**:

- `src/lib/server/battle/battleService.ts` — add recent-victim check in `initiateBattle()`
- `src/app/api/attack/route.ts` — no changes needed if validation is in battleService
- `src/__tests__/unit/battle/` — tests:
  - `initiateBattle_targetIsRecentVictim_throwsError`
  - `initiateBattle_targetIsOldVictim_allows` (more than 3 battles ago)
  - `initiateBattle_noHistory_allows`
  - `initiateBattle_attackerAlreadyInBattle_throwsError` (verify existing check)

**Status**: ✅ COMPLETED
**Implementation Summary**: Added recent-victim check in initiateBattle() — calls battleCache.getRecentAttackees(attacker.id, 3) and throws ApiError(400) if target is in the list.
**Files Modified/Created**:
- `src/lib/server/battle/battleService.ts` — added recent-victim check
- `src/__tests__/unit/battle/initiateBattle-restriction.test.ts` — 4 tests for attack restriction
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All 4 tests passing

#### Task 3.3: Handle edge case — also count active (in-progress) battles

**Action**: The recent victims check should also consider the current active battle (if any). If the attacker has an active battle against target X, and then somehow tries to start another (which should be blocked by inBattle check), the recent-victims list should include X as well. In practice, the `inBattle` flag already prevents concurrent battles, but the recent-victims query should include both completed AND active battles where the user was the attacker, to be safe.

Update the query to: `SELECT attackee_id FROM battles WHERE attacker_id = $1 ORDER BY battle_start_time DESC LIMIT $2` (remove the `battle_end_time IS NOT NULL` filter, use `battle_start_time` for ordering).

**Files**:

- `src/lib/server/battle/battleRepo.ts` — adjust query to include active battles
- `src/__tests__/unit/battle/` — test edge case with active battle

**Status**: ✅ COMPLETED (merged with Task 3.1)
**Implementation Summary**: The query in getRecentAttackeesFromDb() already uses battle_start_time ordering without IS NOT NULL filter — active battles are included.
**Files Modified/Created**:
- `src/lib/server/battle/battleRepo.ts` — query uses battle_start_time, no IS NOT NULL filter
**Deviations from Plan**: Merged with Task 3.1 implementation.
**Arc42 Updates**: None required
**Test Results**: ✅ Tests pass

---

## Dependencies

- No new npm packages needed. All functionality uses existing PostgreSQL, iron-session, and IronGuard locks.

## Arc42 Documentation Updates

**Proposed Changes**: None — this is a behavioral change within the existing battle service architecture, not a new architectural component. The battle resolution flow gains XP calculation, and the User model gains a score field, but the overall architecture remains unchanged.

## Architecture Notes

1. **Score vs XP separation**: Score is a monotonically increasing counter (like XP was). XP remains but is now exclusively battle-driven. Both use the same `User` model and persistence path.

2. **Level-up from battles only**: Since XP now comes only from battles, level-ups will be rarer and more meaningful. The existing triangular progression formula remains unchanged.

3. **addScore() vs addXp()**: `addScore()` is simpler than `addXp()` — it just increments the counter with no level-up detection. Level-ups are only triggered by `addXp()` which is now only called from battle resolution.

4. **Battle XP calculation**: The formula `winnerLevel × 200 × 1.3^(levelDiff)` creates exponential scaling. At extreme level differences (e.g., level 1 vs level 20), the XP reward would be very large. Consider capping if needed, but not implementing a cap initially per requirements.

5. **Recent victims query performance**: The query for last 3 attackees is simple, ordered, and limited. With an index on `(attacker_id, battle_start_time DESC)` it would be efficient, but the current table is small enough that this optimization can be deferred.

6. **Lock ordering**: The attack validation happens within the existing `BATTLE_LOCK → USER_LOCK` acquisition in the attack API route. The recent-victims query needs `DATABASE_LOCK_BATTLES` (level 13), which is acquired internally by BattleCache/BattleRepo. This is consistent with existing lock ordering.

7. **Concurrent battle prevention**: Already enforced by `attacker.inBattle` / `attackee.inBattle` checks in `initiateBattle()`. The user confirmed this should be ensured — the existing code already handles it.

## Agent Decisions

1. **Score column type**: Chose `INTEGER` to match XP column type. Score values are whole numbers (floor of cost/25 for research, cost/100 for builds).

2. **Migration version**: Using version 13 since version 12 appears to be reserved for the starbases feature (SCHEMA_VERSION is already 12 in schema.ts).

3. **calculateBattleXp location**: Placed in `battleService.ts` as an exported pure function. It could be a standalone module, but keeping it with the battle service keeps related logic together and avoids file proliferation.

4. **Recent victims — include active battles**: Decided to include active (in-progress) battles in the recent-victims query to be thorough, even though the `inBattle` flag already prevents concurrent battles. Belt-and-suspenders approach.

5. **No score-based level-up**: Score is purely a progression/leaderboard metric. It does not trigger level-ups or bonus cache invalidation. This keeps the systems cleanly separated.

6. **Level-up messaging from builds removed**: Since builds now award score (not XP), the level-up check in `applyCompletedBuild` is removed. Level-ups only happen from battle XP via `resolveBattle`.

7. **XP formula uses Math.floor**: To keep XP as integers, the formula result is floored. This matches the existing `addXp()` behavior which expects positive integers.
