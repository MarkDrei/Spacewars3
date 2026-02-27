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

## Research Effect Consumption Points

**Discovered by**: Cartographer  
**Context**: When planning the Player Bonus System, mapped all locations where research effects are directly consumed

**Details**: The following locations call `getResearchEffectFromTree()` or weapon modifier functions directly:

| Location                      | Research Used                                         | Method                                              |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `user.ts` L86-98              | IronHarvesting, ShipSpeed, IronCapacity               | Direct `getResearchEffectFromTree()`                |
| `user.ts` L178-240            | IronHarvesting (updateStats)                          | Iron accrual with mid-tick handling                 |
| `user.ts` L252-284            | Teleport, TeleportRechargeSpeed                       | Max charges and recharge rate                       |
| `user.ts` L299-318            | HullStrength, ArmorEffectiveness, ShieldEffectiveness | Max defense via `TechService.calculateMaxDefense()` |
| `navigate/route.ts` L91       | ShipSpeed                                             | `maxSpeed = 5 × speedMultiplier` (legacy factor!)   |
| `ship-stats/route.ts` L67-68  | ShipSpeed, Afterburner                                | `baseSpeed × (1 + afterburner/100)`                 |
| `TechService.ts` L303-316     | HullStrength, ArmorEffectiveness, ShieldEffectiveness | `calculateMaxDefense()`                             |
| `TechFactory.ts` L397-413     | Reload rate                                           | `calculateWeaponReloadTime()`                       |
| `battleScheduler.ts` L312-314 | Damage, Accuracy                                      | Weapon modifiers fed to `calculateWeaponDamage()`   |
| `inventory/route.ts` L19-24   | InventorySlots                                        | Max inventory slots                                 |
| `bridge/route.ts` L24-27      | BridgeSlots                                           | Max bridge slots                                    |

**Key insight**: Navigate route uses `5 × speedMultiplier` while ship-stats uses `baseSpeed × (1 + afterburner/100)` — these are inconsistent and planned for unification via UserBonusCache.

## Commander Bonuses Are Client-Side Only

**Discovered by**: Cartographer  
**Context**: When researching commander bonus application for the Player Bonus System

**Details**: `Commander.calculateBonuses()` is currently called ONLY in the bridge GET API route for display purposes. Commander bonuses are NOT applied server-side to any game computation (ship speed, weapon damage, battle calculations). The UserBonusCache feature will be the first to actually apply commander bonuses to gameplay mechanics.

## Accuracy/Reload Modifier Semantics

**Discovered by**: Cartographer  
**Context**: Planning multiplicative bonus system required understanding current modifier semantics

**Details**: The techtree weapon modifier functions return different types of values:

- `getWeaponDamageModifierFromTree()` → multiplicative factor (e.g., 1.15 = +15% damage) — already multiplicative
- `getWeaponAccuracyModifierFromTree()` → additive percentage points (e.g., +5%) — not multiplicative
- `getWeaponReloadTimeModifierFromTree()` → inverse multiplier (e.g., 0.85 = 15% faster) — inverse semantics

These need refactoring to consistent multiplicative semantics before the bonus system can apply level/commander multipliers uniformly.

## Weapon Modifier Semantics After Multiplicative Refactor

**Discovered by**: Knight
**Context**: Tasks 1.1 and 1.2 refactored weapon modifiers to consistent multiplicative semantics

**Current weapon modifier functions after refactor:**
- `getWeaponDamageModifierFromTree()` → `effect / baseValue` (factor ≥ 1.0, 1.0 = no bonus) ← was already this
- `getWeaponAccuracyModifierFromTree()` → `effect / baseValue` (factor ≥ 1.0, 1.0 = no bonus) ← refactored
- `getWeaponReloadTimeModifierFromTree()` → `1 / max(0.1, 1 - effect/100)` (speed factor ≥ 1.0, 1.0 = no bonus) ← refactored

**Key pattern**: All three now return `1.0` when research is at the base level (level 1 for accuracy/damage, level 0 for reload).

**Reload equivalence**: `baseCooldown / speedFactor` is numerically identical to the old `baseCooldown × (1 - effect/100)` at all levels, making the reload refactor backward-compatible.

**Accuracy default changed**: `POSITIVE_ACCURACY_MODIFIER` in `DAMAGE_CALC_DEFAULTS` was changed from `0` to `1.0` to match the new multiplicative semantics. Any code passing this default to `calculateWeaponDamage()` must use `1.0` as the "no bonus" value, not `0`.

**Parameter rename**: `positiveAccuracyModifier` in `TechFactory.calculateWeaponDamage()` was renamed to `accuracyMultiplier` for clarity.

**IMPORTANT — Accuracy equivalence does NOT hold at levels 2+ for projectile weapons**: The old additive formula (`baseAccuracy + (effect - researchBaseValue)`) and the new multiplicative formula (`baseAccuracy × effect/researchBaseValue`) are only mathematically equal when `baseAccuracy === researchBaseValue`. For `auto_turret` (baseAccuracy=50) with `ProjectileAccuracy` (researchBaseValue=70), the formulas diverge at levels 2+: old additive bonus grows independently of baseAccuracy, while the new multiplicative formula scales proportionally. Accepted deltas: L2=−1.4pp, L5=−9.8pp, L10=−30.4pp. This is an intentional trade-off for consistent multiplicative semantics required by the bonus system. Energy accuracy has NO divergence because `pulse_laser.baseAccuracy (65) === EnergyAccuracy.researchBaseValue (65)`. Future agents: do not attempt to "fix" this by tweaking formula coefficients — the divergence is documented in TechnicalDebt.md and accepted.

## UserBonusCache: resetInstance() Must Clear Static Dependencies

**Discovered by**: Knight
**Context**: Task 2.2.2 (UserBonusCache unit tests) — test isolation failure

**Details**: When a singleton uses a static class field for dependency injection (`static dependencies = null`), calling `resetInstance()` that only sets `instance = null` leaves the stale dependencies in place. Tests that don't call `configureDependencies()` after `resetInstance()` will accidentally inherit dependencies from the previous test.

**Solution**: `resetInstance()` must also clear the static dependencies field:
```typescript
static resetInstance(): void {
  UserBonusCache.instance = null;
  UserBonusCache.dependencies = null; // clear deps too, for test isolation
}
```

This is distinct from `UserCache.resetInstance()` which doesn't use static dependencies in the same way. The pattern should be adopted by any future singleton that uses `static configureDependencies()`.

## Bridge Slot Count Must Come from User Research

**Discovered by**: Knight
**Context**: Task 2.2.1 (UserBonusCache recalculation) — reading commanders from bridge

**Details**: When reading the bridge grid via `InventoryService.getBridge(userId, maxBridgeSlots)`, passing `DEFAULT_BRIDGE_SLOTS` produces an incomplete view if the user has unlocked more bridge slots via `BridgeSlots` research. Always compute maxBridgeSlots from the user's tech tree:

```typescript
const maxBridgeSlots = Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.BridgeSlots));
const bridge = await inventoryService.getBridge(userId, maxBridgeSlots);
```

This pattern is consistent with how the bridge API route (`src/app/api/bridge/route.ts`) reads the bridge grid.

## vitest vi.mock() Class Constructor Pattern

**Discovered by**: Knight
**Context**: Task 4.4 (bridge route invalidation unit tests) — vi.fn().mockImplementation(() => ({...})) fails as constructor

**Problem**: When mocking a class that is instantiated with `new` at module load time (e.g., `const inventoryService = new InventoryService()` in bridge routes), using `vi.fn().mockImplementation(() => ({...}))` fails because an arrow function cannot be used as a constructor. Vitest emits a warning: "The vi.fn() mock did not use 'function' or 'class' in its implementation".

**Solution**: Use a `class` declaration in the vi.mock() factory:
```typescript
vi.mock('@/lib/server/inventory/InventoryService', () => {
  class InventoryService {
    removeFromBridge = vi.fn().mockResolvedValue({ ... });
    moveBridgeItem = vi.fn().mockResolvedValue(undefined);
    // ...
  }
  return { InventoryService, /* error classes */ };
});
```

**Why**: ES6 classes ARE constructors (they use `new`), so Vitest can use them as constructor replacements. Arrow functions cannot be constructors.

**Note**: The `vi.fn()` instances defined as class properties are created once when the class is instantiated. To clear call counts between tests, use `vi.clearAllMocks()` in `afterEach()`.

## vi.mock() is Isolated Per Test File

**Discovered by**: Knight
**Context**: Task 4.4 — deciding whether to add bridge route tests to userBonusCache.test.ts or a separate file

**Details**: In Vitest, `vi.mock()` declarations are scoped to the test file they appear in. Mocking `iron-session` in `bridge-invalidation.test.ts` does NOT affect `userBonusCache.test.ts`. This means you can safely put bridge route tests (which need module mocks) in a separate file without risking interference with pure unit tests in the same or other files.

**Architectural recommendation**: When test cases require `vi.mock()` for module-level dependencies (e.g., route handlers that instantiate dependencies at module load time), prefer a dedicated test file over adding mock declarations to an existing pure unit test file. This keeps concerns separated and avoids the risk of accidental mock bleed-through.

## Research Duration Field Access Pattern

**Discovered by**: Knight
**Context**: Task 4.4 — accessing research duration in tests

**Details**: The `Research` interface in `techtree.ts` does NOT have a `duration` field directly on the object. The actual upgrade duration is computed via:
```typescript
import { getResearchUpgradeDuration, AllResearches, ResearchType } from '@/lib/server/techs/techtree';
// Duration for ShipSpeed from level 1 → 2:
const duration = getResearchUpgradeDuration(AllResearches[ResearchType.ShipSpeed], 2); // = 30s
```
Or use `baseUpgradeDuration` directly from `AllResearches[type].baseUpgradeDuration` for the base (level 1→2) duration. Using `AllResearches[ResearchType.X].duration` will be `undefined` and silently produce `NaN` in calculations.

## Bonus Integration Pattern: Optional Parameters for Backward Compatibility

**Discovered by**: Knight
**Context**: Tasks 5.1–5.4 — integrating UserBonusCache at consumption points

**Details**: When adding bonus parameters to core domain methods (like `updateStats()`, `updateDefenseValues()`), make them **optional** with fallback to legacy behavior. This pattern:
1. Preserves all existing tests without modification
2. Allows gradual migration of callers
3. Prevents breaking production paths before bonuses are ready

Pattern:
```typescript
// Good — optional with fallback
updateStats(now: number, bonuses?: UserBonuses): { ... } {
  const ironRate = bonuses?.ironRechargeRate ?? getResearchEffectFromTree(tree, IronHarvesting);
  // ...
}

// Avoid — required parameter breaks all callers
updateStats(now: number, bonuses: UserBonuses): { ... } { ... }
```

**When to use**: When a method has many callers (unit tests, integration tests, production code) and you want to introduce bonus-system parameters without updating all callers simultaneously.

## TechFactory.calculateWeaponReloadTime() totalReloadFactor Semantics

**Discovered by**: Knight
**Context**: Task 5.4.1 — weapon reload via bonuses in battleScheduler

**Details**: The `totalReloadFactor` parameter in `calculateWeaponReloadTime()` REPLACES the internal tech tree lookup entirely. It should receive the full combined bonus:
```
totalReloadFactor = researchSpeedFactor × levelMultiplier × commanderMultiplier
                  = bonuses.projectileWeaponReloadFactor
```
When passing `totalReloadFactor`, the function uses `baseCooldown / totalReloadFactor` directly. Passing `1.0` gives the raw base cooldown (720s for auto_turret = 12min × 60s). The `ProjectileReloadRate` research at level 1 already gives a 10% speed bonus (effect=10%), so the no-factor call returns ~648s (not 720s).

**In battleScheduler**: When using bonuses at fire time, always compute from `TechFactory.getBaseBattleCooldown(weaponSpec)` and divide by the full `bonuses.projectile/energyWeaponReloadFactor` to avoid double-counting the research effect.

## Legacy 5× Factor in Navigate Route Removed

**Discovered by**: Knight
**Context**: Task 5.2.1 — navigate route used `5 × speedMultiplier` while ship-stats used `baseSpeed`

**Details**: The navigate route had an undocumented `5 × speedMultiplier` factor making max speed 5× higher than what ship-stats reported. This was a legacy inconsistency. Both routes now use `bonuses.maxShipSpeed`. Max speed at base level changed from 125 to 25. Documented in `TechnicalDebt.md`.

## UserBonusCache: Runtime-Only Derived Cache Pattern

**Discovered by**: Knight
**Context**: Tasks 6.1–6.3 — ADR and architecture documentation for UserBonusCache

**Details**: `UserBonusCache` introduces a **derived cache** pattern that differs from all other caches in the system. Key design decisions to remember:

1. **No DB persistence** — bonuses are always computable from existing source data (UserCache + InventoryService). Restart cost = one slightly slower request per user while bonuses are rebuilt lazily.

2. **No lock of its own** — `invalidateBonuses(userId)` is `Map.delete()`, which is atomic in single-threaded Node.js. No IronGuard lock needed for the cache itself. Recalculation internally acquires `USER_LOCK` (LOCK_4) then `USER_INVENTORY_LOCK` (LOCK_5) — a valid order in the IronGuard hierarchy.

3. **Multiplicative combination** — all bonus sources multiply: `finalValue = researchEffect × levelMultiplier × commanderMultiplier`. Stats without a `CommanderStatKey` receive `commanderMultiplier = 1.0` (level + research only).

4. **Lazy per-user** — first `getBonuses(userId)` call after a server start or invalidation triggers recalculation. No eager warmup needed.

5. **Invalidation trigger points** — level-up, research completion, bridge item changes. Each calls the synchronous `invalidateBonuses(userId)`. The next read rebuilds.

6. **Afterburner folded into maxShipSpeed** — `maxShipSpeed = ShipSpeed research × (1 + afterburner/100) × levelMultiplier × commanderMultiplier`. This resolves the previous inconsistency between the navigate route and ship-stats route.

7. **updateStats() receives UserBonuses as optional parameter** — keeps the method synchronous while allowing bonus-aware callers to pass pre-computed values. Tests that don't supply bonuses fall back to legacy per-stat research lookups (backward-compatible).

**Architectural implication**: When adding a new derived/computed value that is needed on every request but can always be reconstructed from existing cached data, prefer this "derived cache" pattern over either (a) recomputing on every request or (b) persisting to the database.
