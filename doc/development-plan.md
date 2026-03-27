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

#### Task 1.2: Add `score` field to User domain model

**Action**: Add `score: number` property to the `User` class. Add `addScore(amount)` method (similar to current `addXp` but without level-up logic). Update constructor to accept score parameter.

**Files**:
- `src/lib/server/user/user.ts` — add `score` property, `addScore()` method
- `src/__tests__/unit/` — unit tests for `addScore()`

#### Task 1.3: Update UserRepo to persist score

**Action**: Add `score` to `UserRow` interface, `userFromRow()` deserialization, `saveUserToDb()` UPDATE query (add column to SET clause, increment WHERE param number), and `createUser()` INSERT.

**Files**:
- `src/lib/server/user/userRepo.ts` — add score to UserRow, userFromRow, saveUserToDb, createUser

#### Task 1.4: Convert research XP awards to score awards

**Action**: In `user.ts` `updateStats()`, replace `this.addXp(xpReward)` with `this.addScore(scoreReward)` for research completion. Update the return type to reflect `scoreReward` instead of `xpReward` with `source: 'research'`. Update the level-up message in `userCache.ts` (if research triggers level-up messaging) to say "score" instead of "XP".

**Files**:
- `src/lib/server/user/user.ts` — change `updateStats()` to call `addScore()` instead of `addXp()` for research
- `src/__tests__/unit/` — update existing research XP tests to verify score is awarded instead

#### Task 1.5: Convert build XP awards to score awards

**Action**: In `TechService.ts` `applyCompletedBuild()`, replace `user.addXp(xpReward)` with `user.addScore(scoreReward)`. Update return type and level-up message from "XP from build" to "score from build". Since score doesn't trigger level-ups, the level-up check/message for builds is removed.

**Files**:
- `src/lib/server/techs/TechService.ts` — change `applyCompletedBuild()` to call `addScore()`, remove level-up messaging for builds
- `src/__tests__/unit/` — update existing build XP tests to verify score is awarded instead

#### Task 1.6: Update user-stats API to return score

**Action**: Add `score` field to the user-stats API response alongside existing `xp`, `level`, `xpForNextLevel`.

**Files**:
- `src/app/api/user-stats/route.ts` — include `score` in response

#### Task 1.7: Update UI to display Score alongside XP/Level

**Action**: Update profile page and status header to show Score separately from XP/Level. Score is displayed as a general progression metric. XP and Level remain for battle progression.

**Files**:
- `src/app/profile/ProfilePageClient.tsx` — display real score value (currently shows dummy data)
- `src/components/StatusHeader/` — add score display if appropriate
- `src/lib/client/services/` — update client-side types to include score

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

#### Task 2.3: Update victory/defeat messages

**Action**: Modify the victory message to include gained XP:
- **Winner**: `P: 🎉 **Victory!** You won the battle! You gained {iron} iron and {xp} XP from {loserName}.`
- **Loser**: `A: 💀 **Defeat!** You lost the battle and have been teleported away. You lost {iron} iron to {winnerName}.` (NO XP info for loser — unchanged)

If the winner also leveled up, send an additional message:
- `P: 🎉 Level Up! You reached level {newLevel}!`

**Files**:
- `src/lib/server/battle/battleService.ts` — update message strings in `resolveBattle()`

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

#### Task 3.3: Handle edge case — also count active (in-progress) battles

**Action**: The recent victims check should also consider the current active battle (if any). If the attacker has an active battle against target X, and then somehow tries to start another (which should be blocked by inBattle check), the recent-victims list should include X as well. In practice, the `inBattle` flag already prevents concurrent battles, but the recent-victims query should include both completed AND active battles where the user was the attacker, to be safe.

Update the query to: `SELECT attackee_id FROM battles WHERE attacker_id = $1 ORDER BY battle_start_time DESC LIMIT $2` (remove the `battle_end_time IS NOT NULL` filter, use `battle_start_time` for ordering).

**Files**:
- `src/lib/server/battle/battleRepo.ts` — adjust query to include active battles
- `src/__tests__/unit/battle/` — test edge case with active battle

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
