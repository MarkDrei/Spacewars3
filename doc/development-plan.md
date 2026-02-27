# Development Plan: Player Bonus System

## Vision

Introduce a global bonus system that combines **player level**, **commander effects** (bridge), and **research effects** into unified, cached multipliers. All existing game mechanics (ship speed, weapon stats, iron capacity, defense regeneration) should reference these cached values instead of querying the tech tree directly. This minimizes DB access, creates a single source of truth for bonused values, and lays the foundation for adding future bonus sources.

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

---

## Goals

### Goal 1: Refactor Accuracy & Reload Modifiers to Multiplicative

**Description**: Currently, accuracy uses an additive bonus (`baseAccuracy + bonusPercent`) and reload time uses an inverse multiplier (`cooldown × factor`, where `factor < 1` = faster). Refactor both to pure multiplicative semantics so all bonus stats are consistently applied via multiplication.

**Quality Requirements**: All existing battle tests must pass. Reload time refactor must produce identical results for current research levels. Accuracy refactor intentionally produces slightly lower final accuracy at research levels 2+ for projectile weapons (due to mathematical incompatibility of additive and multiplicative formulas when weapon base accuracy ≠ research base value); this is an accepted trade-off for consistent multiplicative semantics needed by the bonus system. See Task 1.1 status notes and TechnicalDebt.md for details.

#### Task 1.1: Convert Accuracy Modifier to Multiplicative

**Action**: Refactor `getWeaponAccuracyModifierFromTree()` in techtree.ts to return a multiplicative factor (`> 1.0` = better accuracy) instead of an additive bonus. Update `TechFactory.calculateWeaponDamage()` to use `baseAccuracy × accuracyMultiplier` instead of `baseAccuracy + positiveAccuracyModifier`. **Note**: Full formula equivalence is mathematically impossible — the additive formula (`baseAccuracy + (effect - baseValue)`) and multiplicative formula (`baseAccuracy × effect/baseValue`) only coincide when `baseAccuracy === researchBaseValue`. For auto_turret (baseAccuracy=50) with ProjectileAccuracy (researchBaseValue=70), the new formula produces lower accuracy at levels 2+. This divergence is accepted as a trade-off for consistent multiplicative semantics.

**Files**:

- `src/lib/server/techs/techtree.ts` — refactor `getWeaponAccuracyModifierFromTree()` (L712)
- `src/lib/server/techs/TechFactory.ts` — update `calculateWeaponDamage()` accuracy calculation (L440+)
- `src/lib/server/battle/battleScheduler.ts` — update call site (L312)
- `src/__tests__/` — update affected tests

**Quality Requirements**: Before/after old-vs-new comparison tests for accuracy at levels 1–10 (projectile: assert divergence at levels 2+; energy: assert equivalence at all levels). The divergence is explicitly documented and accepted, not hidden.

**Status**: ✅ COMPLETED (Review Resolved)
**Implementation Summary**: Refactored `getWeaponAccuracyModifierFromTree()` to return `effect / research.baseValue` (factor ≥ 1.0 at all levels), updated `calculateWeaponDamage()` to use `baseAccuracy × accuracyMultiplier`, and updated the `POSITIVE_ACCURACY_MODIFIER` default to `1.0`. At level 1 both formulas produce identical results (factor=1.0 ↔ bonus=0). At levels 2+, projectile accuracy is intentionally lower due to mathematical incompatibility of additive and multiplicative formulas when `autoTurret.baseAccuracy (50) ≠ ProjectileAccuracy.researchBaseValue (70)`.
**Files Modified/Created**:

- `src/lib/server/techs/techtree.ts` — refactored `getWeaponAccuracyModifierFromTree()` to multiplicative
- `src/lib/server/techs/TechFactory.ts` — renamed param to `accuracyMultiplier`, changed `+` to `×`
- `src/lib/server/battle/battleTypes.ts` — updated `POSITIVE_ACCURACY_MODIFIER` default from `0` to `1.0`
- `src/__tests__/integration/lib/TechFactory.test.ts` — updated all accuracy-related test calls
- `src/__tests__/integration/battle-research-effects.test.ts` — restored level-2 check to `toBeCloseTo(1.070, 2)`
- `src/__tests__/unit/lib/weapon-modifier-equivalence.test.ts` — old-vs-new divergence tests at levels 2–10 for projectile accuracy (asserting NOT equal); equivalence tests for energy accuracy (asserting equal); file header updated with accepted-delta documentation
**Deviations from Plan**: `battleScheduler.ts` needed no code change since it directly passes `getWeaponAccuracyModifierFromTree()` output to `calculateWeaponDamage()` — the call automatically passes the new multiplicative factor. `battleTypes.ts` needed a default update (0 → 1.0). Accuracy formula equivalence replaced by documented-divergence requirement per Medicus review.
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing, no linting errors

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: All five original revision issues resolved. Old-vs-new comparison tests (levels 2–10) present and asserting correct divergence. Projectile accuracy level-2 integration test restored to `toBeCloseTo(1.070, 2)`. Development plan, learnings.md, and TechnicalDebt.md all updated with the accepted balance delta. Minor: energy accuracy integration test still uses `toBeGreaterThan(1.0)` even though the comment states `≈ 1.070`; this is acceptable because the exact value is fully covered by the unit tests in `weapon-modifier-equivalence.test.ts` at all levels 1–10.

#### Task 1.2: Convert Reload Modifier to Multiplicative

**Action**: Refactor `getWeaponReloadTimeModifierFromTree()` to return a "reload speed" factor (`> 1.0` = faster reloading). Update `TechFactory.calculateWeaponReloadTime()` to divide cooldown by this factor: `baseCooldown / reloadSpeedFactor`. Adjust research formula coefficients so existing research levels produce identical cooldown values.

**Files**:

- `src/lib/server/techs/techtree.ts` — refactor `getWeaponReloadTimeModifierFromTree()` (L741)
- `src/lib/server/techs/TechFactory.ts` — update `calculateWeaponReloadTime()` (L397)
- `src/__tests__/` — update affected tests

**Quality Requirements**: Before/after numeric equivalence test for reload time at levels 1–10.

**Status**: ✅ COMPLETED
**Implementation Summary**: Refactored `getWeaponReloadTimeModifierFromTree()` to return `1 / max(0.1, 1 - effect/100)` (speed factor ≥ 1.0), updated `calculateWeaponReloadTime()` to use `baseCooldown / speedFactor`. This is numerically identical to the old formula at all levels: `baseCooldown / (1/(1-e/100)) = baseCooldown × (1-e/100)`.
**Files Modified/Created**:

- `src/lib/server/techs/techtree.ts` — refactored `getWeaponReloadTimeModifierFromTree()` to speed factor
- `src/lib/server/techs/TechFactory.ts` — changed `baseCooldown * multiplier` to `baseCooldown / speedFactor`
- `src/__tests__/integration/lib/techtree.test.ts` — updated reload modifier test expectations (e.g., 0.9 → 1/0.9)
- `src/__tests__/unit/lib/weapon-modifier-equivalence.test.ts` — new file with numeric equivalence tests (20 reload tests, levels 1–10, both weapon types)
**Deviations from Plan**: None.
**Arc42 Updates**: None required
**Test Results**: ✅ All 1114 tests passing, coverage via 70-test equivalence suite, no linting errors

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Reload refactoring is excellent — mathematically exact reciprocal equivalence proven at all levels 1–10 for both projectile and energy weapons. Formula, implementation, and tests are consistent and complete.

---

### Goal 2: Design and Implement UserBonusCache

**Description**: As a developer, I want a `UserBonusCache` service that lazily computes and caches per-user bonus values derived from player level, bridge commanders, and tech tree research. This centralizes bonus computation and minimizes repeated DB/cache lookups.

**Inputs**: User data (level, techTree) from UserCache; bridge commander data from InventoryService.
**Outputs**: `UserBonuses` object with pre-computed final values and bonus factors.
**Quality Requirements**: >80% coverage; unit tests with mocked dependencies (testing pyramid).

#### Sub-Goal 2.1: Define Types and Interfaces

##### Task 2.1.1: Create UserBonuses Interface and Types

**Action**: Define the `UserBonuses` interface and related types in a new file. The interface stores:

1. **Raw multipliers** (for mid-tick recalculation and debugging):
   - `levelMultiplier: number` — `1.15^(level - 1)`
   - `commanderMultipliers: Record<CommanderStatKey, number>` — from `Commander.calculateBonuses()`

2. **Pre-computed final values** (research × level × commander, or research × level if no commander stat):
   - `ironStorageCapacity: number` — `getResearchEffect(IronCapacity) × levelMult`
   - `ironRechargeRate: number` — `getResearchEffect(IronHarvesting) × levelMult`
   - `hullRepairSpeed: number` — `BASE_REGEN_RATE × levelMult` (base = 1.0/sec, no research)
   - `armorRepairSpeed: number` — `BASE_REGEN_RATE × levelMult`
   - `shieldRechargeRate: number` — `BASE_REGEN_RATE × levelMult`
   - `maxShipSpeed: number` — `getResearchEffect(ShipSpeed) × (1 + afterburner/100) × levelMult × commanderMult(shipSpeed)`

3. **Pre-computed weapon factors** (combined multiplier for battle system):
   - `projectileWeaponDamageFactor: number` — `researchDamageMod × levelMult × commanderMult`
   - `projectileWeaponReloadFactor: number` — `researchReloadSpeedMod × levelMult × commanderMult`
   - `projectileWeaponAccuracyFactor: number` — `researchAccuracyMod × levelMult × commanderMult`
   - `energyWeaponDamageFactor: number` — same pattern for energy weapons
   - `energyWeaponReloadFactor: number`
   - `energyWeaponAccuracyFactor: number`

**Files**:

- `src/lib/server/bonus/userBonusTypes.ts` — new file with `UserBonuses` interface, `BonusStatKey` type

#### Sub-Goal 2.2: Implement UserBonusCache Service

##### Task 2.2.1: Implement UserBonusCache Class

**Action**: Create `UserBonusCache` as a singleton (globalThis pattern, consistent with UserCache/WorldCache). Key design:

- **Storage**: `Map<number, UserBonuses>` keyed by userId
- **Dependencies** (injected via `configureDependencies()`): `UserCache`, `InventoryService`
- **Lock**: Reuses `USER_LOCK` (LOCK_4); internally acquires `USER_INVENTORY_LOCK` (LOCK_5) for bridge data. Lock ordering 4 → 5 is valid.
- **Singleton**: `getInstance()`, `resetInstance()` for test isolation
- **No DB persistence**: Purely runtime cache, lost on restart, lazily rebuilt

**Public API**:

| Method                  | Signature                                        | Description                             |
| ----------------------- | ------------------------------------------------ | --------------------------------------- |
| `configureDependencies` | `static (deps: { userCache, inventoryService })` | DI setup                                |
| `getInstance`           | `static (): UserBonusCache`                      | Singleton getter                        |
| `resetInstance`         | `static ()`                                      | Test teardown                           |
| `getBonuses`            | `async (ctx: HasLock4, userId): UserBonuses`     | Lazy: returns cached or recalculates    |
| `updateBonuses`         | `async (ctx: HasLock4, userId): UserBonuses`     | Force recalculation                     |
| `invalidateBonuses`     | `(userId: number): void`                         | Mark as stale (sync, no lock needed)    |
| `discardAllBonuses`     | `(): void`                                       | Clear entire cache (admin/extreme case) |

**Recalculation logic** (inside `updateBonuses`):

1. Read `User` from UserCache via `getUserByIdFromCache(ctx, userId)` — synchronous, LOCK_4 held
2. Compute `levelMultiplier = 1.15^(user.getLevel() - 1)`
3. Read bridge from InventoryService via `getBridge(userId)` — acquires LOCK_5 internally
4. Compute `commanderMultipliers` via `Commander.calculateBonuses(bridgeCommanders)`
5. Read research effects from `user.techTree` using techtree functions
6. Combine: `finalValue = researchEffect × levelMultiplier × commanderMultiplier(stat)`
7. Store in Map

**Files**:

- `src/lib/server/bonus/UserBonusCache.ts` — new file

##### Task 2.2.2: Unit Tests for UserBonusCache

**Action**: Write comprehensive unit tests with mocked UserCache and InventoryService. Test:

- Lazy initialization: first `getBonuses` call triggers calculation
- Cache hit: second call returns same object without recalculation
- `invalidateBonuses` causes next `getBonuses` to recalculate
- `updateBonuses` always recalculates
- `discardAllBonuses` clears everything
- Level multiplier calculation: level 1 → 1.0, level 2 → 1.15, level 3 → 1.3225
- Commander multiplier stacking (multiplicative)
- Combined final values: research × level × commander
- Stats without commander (iron, defense regen): research × level only
- Edge cases: user not found, no bridge commanders, level 1 (no bonus)

**Files**:

- `src/__tests__/lib/userBonusCache.test.ts` — new unit test file (mocked deps, no DB)

**Quality Requirements**: >90% coverage of UserBonusCache. Pure unit tests with mocked dependencies.

---

### Goal 3: Wire UserBonusCache into Server Lifecycle

**Description**: Integrate UserBonusCache into the server initialization and ensure it's available to all consumers.

#### Task 3.1: Add to Server Initialization

**Action**: Wire `UserBonusCache` into `main.ts` initialization, after `UserCache` and before/after `BattleCache`. Configure dependencies and add to the initialization sequence.

**Files**:

- `src/lib/server/main.ts` — add UserBonusCache initialization
- `src/__tests__/helpers/testServer.ts` — add UserBonusCache reset in `shutdownIntegrationTestServer()`

#### Task 3.2: Integration Test for Initialization

**Action**: Verify that UserBonusCache is properly initialized after server startup, that bonuses can be retrieved for the default test user, and that the cache is correctly reset between tests.

**Files**:

- `src/__tests__/api/user-bonus-cache.test.ts` — new integration test

---

### Goal 4: Implement Invalidation Triggers

**Description**: Bonus cache entries must be invalidated when any of the three input sources change: player level (XP), bridge commanders, or research. The design uses **lazy invalidation** — triggers call `invalidateBonuses(userId)`, and the next `getBonuses()` call recalculates.

#### Task 4.1: Invalidate on Level-Up (XP Change)

**Action**: In `User.addXp()`, when `leveledUp` is true, call `UserBonusCache.getInstance().invalidateBonuses(this.id)`. Since `addXp()` is synchronous and `invalidateBonuses()` is synchronous (just deletes from Map), no lock changes needed.

Note: `addXp()` is called from two places:

1. `user.updateStats()` (L253) — research completion awards XP
2. `TechService.applyCompletedBuild()` (L278) — build completion awards XP

Both already hold USER_LOCK.

**Files**:

- `src/lib/server/user/user.ts` — add invalidation call in `addXp()` when leveledUp

#### Task 4.2: Invalidate on Research Completion

**Action**: In `User.updateStats()`, when `updateTechTree()` returns a completed research, call `UserBonusCache.getInstance().invalidateBonuses(this.id)`. This handles changes to research-derived bonus values.

Note: Research completion also awards XP (which may cause level-up), so Task 4.1 already covers the level-change path. The research invalidation handles the case where research completes but the user doesn't level up.

**Files**:

- `src/lib/server/user/user.ts` — add invalidation in `updateStats()` after research completion

#### Task 4.3: Invalidate on Bridge Change

**Action**: In all bridge API routes that modify the bridge contents, call `UserBonusCache.getInstance().invalidateBonuses(userId)` after the InventoryService operation succeeds.

Affected routes (all in `src/app/api/bridge/`):

- `DELETE /api/bridge` — remove from bridge
- `POST /api/bridge/move` — move within bridge
- `POST /api/bridge/transfer` — inventory ↔ bridge transfer
- `POST /api/bridge/transfer/auto` — auto-transfer

Since these routes release all locks after the operation, the invalidation is a simple sync call after the response data is computed but before returning.

**Files**:

- `src/app/api/bridge/route.ts` — DELETE handler
- `src/app/api/bridge/move/route.ts`
- `src/app/api/bridge/transfer/route.ts`
- `src/app/api/bridge/transfer/auto/route.ts`

#### Task 4.4: Tests for Invalidation Triggers

**Action**: Write tests verifying that bonuses are correctly invalidated at each trigger point:

- XP gain causing level-up → bonuses invalidated
- XP gain without level-up → bonuses NOT invalidated
- Research completion → bonuses invalidated
- Bridge item added/removed/moved → bonuses invalidated

**Files**:

- `src/__tests__/lib/userBonusCache.test.ts` — extend with invalidation trigger tests

---

### Goal 5: Integrate UserBonusCache at Consumption Points

**Description**: Replace all direct tech tree access for bonus-affected values with calls to `UserBonusCache`. This is the largest goal — every place that currently calls `getResearchEffectFromTree()` or weapon modifier functions for a bonused stat should instead use the cached bonus values.

#### Sub-Goal 5.1: Iron Economy

##### Task 5.1.1: Iron Rate and Iron Capacity via Bonuses

**Action**: Update `User.updateStats()` to use bonused iron rate and iron capacity instead of direct research lookups. The bonuses are passed as a parameter to `updateStats()` to keep the method synchronous.

Pattern change:

```
// Before:
const ironPerSecond = getResearchEffectFromTree(this.techTree, IronHarvesting);
const maxCapacity = this.getMaxIronCapacity(); // → getResearchEffectFromTree(IronCapacity)

// After:
const ironPerSecond = bonuses.ironRechargeRate;
const maxCapacity = bonuses.ironStorageCapacity;
```

**Special handling for mid-tick research completion**: When IronHarvesting research completes during `updateStats()`, bonuses are stale. Use `bonuses.levelMultiplier` to locally compute the new iron rate: `getResearchEffectFromTree(updatedTree, IronHarvesting) × bonuses.levelMultiplier`. Then invalidate bonuses at the end.

**Callers of `updateStats()` must obtain bonuses first**:

- `UserCache.getUserByIdWithLock()` — call `await UserBonusCache.getBonuses(ctx, userId)` before `user.updateStats(now, bonuses)`
- `UserCache.getUserByUsernameInternal()` — same pattern
- `user-stats/route.ts` — same pattern
- `trigger-research/route.ts` — same pattern
- `login/route.ts` — same pattern (review lock situation; currently may not have LOCK_4)

**Files**:

- `src/lib/server/user/user.ts` — change `updateStats()` signature to accept `UserBonuses`, use bonused values
- `src/lib/server/user/userCache.ts` — pass bonuses from cache
- `src/app/api/user-stats/route.ts`
- `src/app/api/trigger-research/route.ts`
- `src/app/api/login/route.ts`

##### Task 5.1.2: Max Iron Capacity in API Responses

**Action**: The `user-stats` API returns `maxIron` to the client. This should use the bonused value.

**Files**:

- `src/app/api/user-stats/route.ts` — use `bonuses.ironStorageCapacity` for maxIron response field

#### Sub-Goal 5.2: Ship Speed

##### Task 5.2.1: Navigate Route Speed via Bonuses

**Action**: Replace direct `getResearchEffectFromTree(ShipSpeed)` in navigate route with `bonuses.maxShipSpeed`.

Note: Current navigate route uses `5 × speedMultiplier`, while ship-stats uses `baseSpeed × (1 + afterburnerBonus/100)`. These should be unified — the bonus system is a good opportunity to resolve this inconsistency.

Afterburner is folded into `maxShipSpeed`: `ShipSpeed × (1 + afterburner/100) × levelMult × commanderMult(shipSpeed)`. The legacy `5 × speedMultiplier` factor in navigate route is removed — both routes use `bonuses.maxShipSpeed` directly. Document the removed factor in `TechnicalDebt.md`.

**Files**:

- `src/app/api/navigate/route.ts` — use `bonuses.maxShipSpeed`, remove `5 ×` factor
- `src/app/api/ship-stats/route.ts` — use `bonuses.maxShipSpeed`
- `TechnicalDebt.md` — document removed legacy factor

#### Sub-Goal 5.3: Defense Values

##### Task 5.3.1: Max Defense via Bonuses

**Action**: Update `TechService.calculateMaxDefense()` (or its callers) to use bonused values. Currently it computes `stackedBase × (researchEffect / 100)` — the level multiplier should be applied on top.

Note: `calculateMaxDefense` uses `techCounts` (number of defense items built) as input. The bonus doesn't replace `techCounts`, only adds the level multiplier to the research factor.

**Files**:

- `src/lib/server/techs/TechService.ts` — update `calculateMaxDefense()` to accept/use level multiplier
- `src/lib/server/user/user.ts` — `updateDefenseValues()` passes bonus to `calculateMaxDefense`

##### Task 5.3.2: Defense Regen Rates via Bonuses

**Action**: Replace hardcoded `regenRate: 1` in `TechService.getDefenseStats()` with bonused values: `bonuses.hullRepairSpeed`, `bonuses.armorRepairSpeed`, `bonuses.shieldRechargeRate`.

Update `User.updateDefenseValues()` to use bonused regen rates instead of hardcoded 1/sec.

**Files**:

- `src/lib/server/techs/TechService.ts` — update `getDefenseStats()` to accept regen rates
- `src/lib/server/user/user.ts` — use bonused regen rates in `updateDefenseValues()`
- `src/shared/defenseValues.ts` — no change (interface already has `regenRate` field)

#### Sub-Goal 5.4: Battle System — Weapon Stats

##### Task 5.4.1: Weapon Damage, Accuracy, Reload via Bonuses

**Action**: In `battleScheduler.ts` `fireWeapon()`, replace direct calls to `getWeaponDamageModifierFromTree()`, `getWeaponAccuracyModifierFromTree()` with bonused factors from UserBonusCache.

Pattern change:

```
// Before:
getWeaponAccuracyModifierFromTree(attackerUser.techTree, weaponType)
getWeaponDamageModifierFromTree(attackerUser.techTree, weaponType)

// After (using pre-computed factors from bonus cache):
bonuses.projectileWeaponAccuracyFactor  // or energyWeaponAccuracyFactor
bonuses.projectileWeaponDamageFactor    // or energyWeaponDamageFactor
```

For reload time: Update `TechFactory.calculateWeaponReloadTime()` or its callers to use `bonuses.projectileWeaponReloadFactor` (or energy equivalent).

**Files**:

- `src/lib/server/battle/battleScheduler.ts` — use bonus factors for accuracy and damage
- `src/lib/server/techs/TechFactory.ts` — update `calculateWeaponReloadTime()` to accept bonus factor

#### Sub-Goal 5.5: Inventory Slot Counts (Not Bonused)

**Note**: Inventory slots (`InventorySlots`) and bridge slots (`BridgeSlots`) are research-derived but are NOT in the bonus list. These should NOT be routed through UserBonusCache — they remain direct techtree lookups. Document this decision.

#### Sub-Goal 5.6: Update Affected Tests

##### Task 5.6.1: Update Existing Integration Tests

**Action**: All integration tests that test bonused values (iron rate, ship speed, defense, battle damage) need updating to account for the bonus system. Since tests use level-1 users (bonus = 1.0), most values should remain identical. Tests that modify XP/level will need adjustments.

**Files**:

- `src/__tests__/api/user-stats-api.test.ts`
- `src/__tests__/api/collection-api.test.ts`
- `src/__tests__/api/trigger-research-api.test.ts`
- `src/__tests__/api/user-battles-api.test.ts`
- `src/__tests__/api/ships-api.test.ts`
- `src/__tests__/api/world-api.test.ts`
- `src/__tests__/api/complete-build-api.test.ts`
- Other tests as needed

---

### Goal 6: Architecture Documentation

**Description**: Document the bonus cache as an ADR and update Arc42.

#### Task 6.1: Add ADR for Caching Derived Bonus Values

**Action**: Add ADR-006 to the Architecture Decisions section of arc42-architecture.md:

**Context**: Game bonuses (derived from player level, commanders, and research) are needed frequently across multiple API endpoints. Recalculating them on every request requires reading from UserCache and InventoryService, introducing unnecessary lock contention and latency.

**Decision**: Cache derived bonus values in a runtime-only `UserBonusCache` (no DB persistence). Lazily initialize per user, invalidate on source data changes (level-up, research completion, bridge changes).

**Consequences**: Fast reads (sub-microsecond from Map), stale for at most one request after invalidation, lost on server restart (rebuilt lazily).

**Files**:

- `doc/architecture/arc42-architecture.md` — add ADR-006

#### Task 6.2: Update Arc42 Building Block View

**Action**: Add `UserBonusCache` to the building blocks documentation as a new cache component. Update the dependency graph to show UserBonusCache depending on UserCache and InventoryService.

**Files**:

- `doc/architecture/arc42-architecture.md` — update §5 Building Block View
- `doc/architecture/building-blocks-cache-systems.md` — add UserBonusCache section

#### Task 6.3: Update Learnings

**Action**: Document the bonus cache pattern and key design decisions in learnings.md.

**Files**:

- `doc/learnings.md` — add entry about UserBonusCache pattern

---

## Dependencies

No new npm packages required. All dependencies are internal.

## Arc42 Documentation Updates

**Proposed Changes**:

- **§5 Building Block View**: Add UserBonusCache as a new cache component with dependency graph
- **§9 Architecture Decisions**: Add ADR-006 for caching derived bonus values
- **building-blocks-cache-systems.md**: Add UserBonusCache section

## Architecture Notes

### Design Pattern: Runtime-Only Derived Cache

Unlike other caches (UserCache, WorldCache, etc.) that persist to PostgreSQL, UserBonusCache is purely runtime. It stores derived/computed values that can always be recomputed from source data. This is a new pattern in the codebase — a "derived cache" as opposed to a "persistent cache".

### Lock Strategy

- UserBonusCache reuses `USER_LOCK` (LOCK_4) — no new lock level needed
- Recalculation acquires `USER_INVENTORY_LOCK` (LOCK_5) internally for bridge data
- Lock ordering 4 → 5 is valid in the IronGuard hierarchy
- `invalidateBonuses()` is synchronous (Map.delete) — no lock needed in single-threaded JS
- `discardAllBonuses()` is synchronous (Map.clear) — no lock needed

### Bonus Combination Formula

All bonus sources combine **multiplicatively**:

```
finalValue = researchEffect × levelMultiplier × commanderMultiplier
```

Where:

- `researchEffect` = value from `getResearchEffectFromTree(techTree, researchType)`
- `levelMultiplier` = `1.15^(level - 1)` (level 1 = no bonus = 1.0)
- `commanderMultiplier` = from `Commander.calculateBonuses()` for stats with matching `CommanderStatKey`; for stats without a commander key (iron, defense regen), commanderMultiplier = 1.0

### Stats without Commander Bonuses

The following stats only get level bonus (no `CommanderStatKey` exists):

- Iron storage capacity (IronCapacity research × level)
- Iron recharge rate (IronHarvesting research × level)
- Hull repair speed (base 1.0/sec × level)
- Armor repair speed (base 1.0/sec × level)
- Shield recharge rate (base 1.0/sec × level)

### updateStats() Design

`User.updateStats()` remains synchronous but receives `UserBonuses` as a parameter. This avoids making it async while still using bonus values. Callers (UserCache, API routes) obtain bonuses before calling `updateStats()`. Mid-tick research completion is handled by locally recomputing affected values using `bonuses.levelMultiplier`.

## Agent Decisions

1. **Multiplicative combination** (confirmed with user): All bonus sources multiply. `finalValue = research × level × commander`.

2. **Level-only for iron/defense stats** (confirmed with user): Stats without `CommanderStatKey` (iron capacity, iron rate, defense regen) only get the level multiplier. No `CommanderStatKey` extension planned.

3. **Accuracy/reload refactoring as prerequisite** (confirmed with user): All bonuses operate multiplicatively. The existing additive accuracy and inverse reload modifiers are refactored to multiplicative FIRST (Goal 1) before the bonus system is implemented.

4. **Lazy invalidation** (confirmed with user): Trigger events call `invalidateBonuses(userId)` (sync, no lock). Next `getBonuses()` call recalculates. This avoids lock contention at trigger points and keeps the implementation simple.

5. **UserBonuses passed as parameter to updateStats()**: To keep `updateStats()` synchronous, bonuses are passed in rather than looked up internally. This also improves testability (pass mock bonuses in unit tests).

6. **No DB persistence for bonuses**: UserBonusCache is runtime-only. On server restart, bonuses are lazily rebuilt on first access per user. This avoids schema changes and keeps the implementation simple.

7. **New file directory**: `src/lib/server/bonus/` — follows the pattern of `src/lib/server/user/`, `src/lib/server/battle/`, etc.

8. **Afterburner handling** (confirmed with user): Afterburner research is folded into `maxShipSpeed` in the UserBonusCache: `ShipSpeed × (1 + afterburner/100) × levelMult × commanderMult`. This resolves the existing inconsistency between navigate and ship-stats routes.

9. **Navigate route factor 5** (confirmed with user): The legacy `5 × speedMultiplier` in the navigate route is removed. Both navigate and ship-stats will use `bonuses.maxShipSpeed` directly. The removed factor is documented in `TechnicalDebt.md` for traceability.

10. **Goal ordering** (confirmed with user): Goal 1 (accuracy/reload refactoring to multiplicative) is implemented first, before the UserBonusCache (Goal 2+). This ensures the bonus cache operates on consistent multiplicative modifiers.

## Resolved Questions

All open questions have been resolved during planning:

1. **Afterburner**: ✅ Folded into `maxShipSpeed` in the bonus cache (Option A confirmed)
2. **Navigate factor 5**: ✅ Removed, documented in TechnicalDebt.md (confirmed)
3. **Goal ordering**: ✅ Goal 1 (accuracy/reload refactoring) first (confirmed)
4. **Combination formula**: ✅ All multiplicative (confirmed)
5. **Iron/defense without commander**: ✅ Level-only bonus (confirmed)
6. **Accuracy/reload refactoring**: ✅ Separate step, prerequisite for bonus system (confirmed)
7. **Lazy invalidation**: ✅ Triggers invalidate, next read recalculates (confirmed)
