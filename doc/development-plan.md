# Development Plan: Teleport Feature

## Vision

As a player, I want to teleport my ship to any location in the game world using accumulated teleport charges, so that I can quickly traverse the 5000×5000 world. Charges accumulate over time at a rate governed by a separate research, and I can teleport either via coordinate input (zeroing velocity) or via canvas click (preserving velocity).

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: PostgreSQL
- **Testing**: Vitest with jsdom
- **Session**: iron-session with HTTP-only cookies
- **Module System**: ES Modules exclusively (`import`/`export` only, no CommonJS)

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/client/` - Client-side code (hooks, services, game engine)
- `src/lib/server/` - Server-side code (database, typed locks, cache)
- `src/shared/` - Shared types and utilities
- `src/__tests__/` - Test files
- `doc/architecture/` - Arc42 architecture documentation

---

## Goals

### Goal 1: Research System — Repurpose Teleport & Add TeleportRechargeSpeed

**Description**: Modify the existing `ResearchType.Teleport` research to represent teleport charge capacity (not range), and introduce a new `TeleportRechargeSpeed` research that governs how fast charges refill. Both researches appear under the Ship category on the research page.

**Research Specifications**:

| Property | Teleport (charges) | TeleportRechargeSpeed |
|---|---|---|
| Start level | 0 (locked) | 1 (unlocked by default) |
| Base value | 1 (charges) | 86400 (seconds = 24h) |
| Value increase | constant +1/level | factor 0.9 (10% less per level) |
| Base cost | 10,000 iron | 10,000 iron |
| Cost increase | 3.0× per level | 1.3× per level |
| Base duration | 1800 seconds (30 min) | 1800 seconds (30 min) |
| Unit | charges | seconds |
| treeKey | `teleport` | `teleportRechargeSpeed` |
| Description | Unlocks teleport and adds one charge per level. | Decreases teleport charge recharge time by 10% per level. |

**Effect calculations**:
- Teleport charges max at level N: `N` (level 0 → 0, level 1 → 1, level 2 → 2, ...)
  - Uses `constant` baseValueIncrease with value 1, baseValue 0: `getResearchEffect` → `0 + 1 * (level - 0) = level`
  - **Important**: verify `getResearchEffect` for constant type: formula is `baseValue + value * (level - startLevel)`. With baseValue=0, value=1, startLevel=0 → returns `level`. But at level 0 it should return 0. Check that `getResearchEffect` returns 0 for level ≤ startLevel.
- Teleport recharge time at level N: `86400 * 0.9^(level - 1)` seconds
  - Level 1: 86400s (24h), Level 2: 77760s (~21.6h), Level 3: 69984s (~19.4h), Level 4: 62986s (~17.5h), ...

**Quality Requirements**: All research effect calculations must be unit-tested.

#### Task 1.1: Add TeleportRechargeSpeed to ResearchType enum

**Action**: Add `TeleportRechargeSpeed = 'teleportRechargeSpeed'` to the `ResearchType` enum.
**Files**:
- `src/shared/src/types/gameTypes.ts` — add enum value

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `TeleportRechargeSpeed = 'teleportRechargeSpeed'` to ResearchType enum in gameTypes.ts.
**Files Modified/Created**:
- `src/shared/src/types/gameTypes.ts` — added TeleportRechargeSpeed enum value
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.2: Repurpose AllResearches[Teleport] entry

**Action**: Change the existing Teleport entry from range-based to charge-based:
- `baseValue: 0` (0 charges at level 0)
- `baseValueIncrease: { type: 'constant', value: 1 }` (+1 charge per level)
- `description: 'Unlocks teleport and adds one charge per level.'`
- `unit: 'charges'`
- `baseUpgradeDuration: 1800`
- Keep `baseUpgradeCost: 10000` and `upgradeCostIncrease: 3.0`

**Files**:
- `src/lib/server/techs/techtree.ts` — modify `AllResearches[ResearchType.Teleport]`

**Status**: ✅ COMPLETED
**Implementation Summary**: Updated AllResearches[Teleport] to charge-based with baseValue=1 (not 0 as plan stated — see deviation note).
**Files Modified/Created**:
- `src/lib/server/techs/techtree.ts` — updated Teleport entry
**Deviations from Plan**: Used `baseValue: 1` instead of `baseValue: 0`. The plan's formula `baseValue + value * (level - startLevel)` was incorrect — the actual code uses `baseValue + value * (level - 1)`. With baseValue=1, value=1: level 1→1, level 2→2, level N→N as required. With baseValue=0, level 1 would give 0 charges (wrong).
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.3: Add AllResearches[TeleportRechargeSpeed] entry

**Action**: Add a new research entry for TeleportRechargeSpeed with the specifications from the table above.

**Files**:
- `src/lib/server/techs/techtree.ts` — add new entry in `AllResearches`

**Status**: ✅ COMPLETED
**Implementation Summary**: Added AllResearches[TeleportRechargeSpeed] with factor=0.9, baseValue=86400, baseUpgradeCost=10000, upgradeCostIncrease=1.3, baseUpgradeDuration=1800.
**Files Modified/Created**:
- `src/lib/server/techs/techtree.ts` — added TeleportRechargeSpeed entry
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.4: Update TechTree interface and related functions

**Action**: 
- Add `teleportRechargeSpeed: number` to `TechTree` interface
- Add `teleportRechargeSpeed: AllResearches[ResearchType.TeleportRechargeSpeed].level` in `createInitialTechTree()`
- Add `case ResearchType.TeleportRechargeSpeed` in `getResearchLevelFromTree()` → `return tree.teleportRechargeSpeed`
- Add `case ResearchType.TeleportRechargeSpeed` in `updateTechTree()` → `tree.teleportRechargeSpeed += 1`
- Add both `ResearchType.Teleport` and `ResearchType.TeleportRechargeSpeed` to `IMPLEMENTED_RESEARCHES`

**Files**:
- `src/lib/server/techs/techtree.ts` — TechTree interface, createInitialTechTree, getResearchLevelFromTree, updateTechTree, IMPLEMENTED_RESEARCHES

**Status**: ✅ COMPLETED
**Implementation Summary**: Added teleportRechargeSpeed to TechTree interface, createInitialTechTree, getResearchLevelFromTree switch, updateTechTree switch. Added both Teleport and TeleportRechargeSpeed to IMPLEMENTED_RESEARCHES.
**Files Modified/Created**:
- `src/lib/server/techs/techtree.ts` — all specified changes applied
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.5: Update client-side TechTree types

**Action**: Add `teleportRechargeSpeed: number` to the client-side TechTree interface used in `researchService.ts` and ensure the client can parse the field.

**Files**:
- `src/lib/client/services/researchService.ts` — TechTree interface

**Status**: ✅ COMPLETED
**Implementation Summary**: Added `teleportRechargeSpeed: number` field to client-side TechTree interface.
**Files Modified/Created**:
- `src/lib/client/services/researchService.ts` — added teleportRechargeSpeed field
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.6: Update research page hierarchy

**Action**: Modify the `researchHierarchy` in ResearchPageClient to show TeleportRechargeSpeed as a child of teleport:
```
Ship → shipSpeed → teleport → [teleportRechargeSpeed]
```
Add `teleportRechargeSpeed` to the `researchTypeToKey` mapping and the image mapping.

**Files**:
- `src/app/research/ResearchPageClient.tsx` — researchHierarchy, researchTypeToKey, image mapping

**Status**: ✅ COMPLETED
**Implementation Summary**: Added teleportRechargeSpeed as child of teleport in hierarchy, added to researchTypeToKey mapping and image mapping.
**Files Modified/Created**:
- `src/app/research/ResearchPageClient.tsx` — updated hierarchy, mappings, image map
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.7: Add research image asset

**Action**: Add a placeholder image for TeleportRechargeSpeed at `public/assets/images/research/TeleportRechargeSpeed.png`. Can be a copy of the existing Teleport image initially.

**Files**:
- `public/assets/images/research/TeleportRechargeSpeed.png`

**Status**: ✅ COMPLETED
**Implementation Summary**: Added both Teleport.png and TeleportRechargeSpeed.png as copies of ShipSpeed.png (since Teleport.png was also missing).
**Files Modified/Created**:
- `public/assets/images/research/Teleport.png` — added placeholder (copy of ShipSpeed.png)
- `public/assets/images/research/TeleportRechargeSpeed.png` — added placeholder (copy of ShipSpeed.png)
**Deviations from Plan**: Also added Teleport.png since it was missing in the assets folder (the plan assumed it existed).
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 1.8: Write unit tests for research effects

**Action**: Test that:
- Teleport charges effect = 0 at level 0, 1 at level 1, 2 at level 2, N at level N
- TeleportRechargeSpeed effect = 86400 at level 1, ~77760 at level 2, ~69984 at level 3
- Cost scaling is correct for both researches
- Duration scaling is correct

**Files**:
- `src/__tests__/lib/techtree.test.ts` — add new test cases

**Status**: ✅ COMPLETED
**Implementation Summary**: Added 17 new tests covering Teleport and TeleportRechargeSpeed effects, cost scaling, duration scaling, and tree integration.
**Files Modified/Created**:
- `src/__tests__/lib/techtree.test.ts` — added Teleport and TeleportRechargeSpeed test suites
- `src/__tests__/components/researchPageClient.test.tsx` — added missing teleportRechargeSpeed field to mock TechTree
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All 57 techtree tests passing

---

### Goal 2: Backend Data Model — Teleport Charges on User

**Description**: Add two new columns to the users table (`teleport_charges` and `teleport_last_regen`) and corresponding fields on the User class. Charges are stored as fractional (DOUBLE PRECISION) but only whole numbers are usable. All data flows through the cache with the existing write-behind persistence mechanism.

#### Task 2.1: Update database schema

**Action**: Add columns to `CREATE_USERS_TABLE` in schema.ts:
```sql
teleport_charges DOUBLE PRECISION NOT NULL DEFAULT 0.0,
teleport_last_regen INTEGER NOT NULL DEFAULT 0
```

**Files**:
- `src/lib/server/schema.ts` — add columns to CREATE_USERS_TABLE, increment SCHEMA_VERSION to 12

**Status**: ✅ COMPLETED
**Implementation Summary**: Added teleport_charges DOUBLE PRECISION and teleport_last_regen INTEGER columns to CREATE_USERS_TABLE. Incremented SCHEMA_VERSION to 12.
**Files Modified/Created**:
- `src/lib/server/schema.ts` — added columns, SCHEMA_VERSION=12
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 2.2: Add database migration

**Action**: Add migration version 11 (`add_teleport_charges`) to migrations.ts that adds the two new columns. Follow the existing pattern: add a `Migration` entry with `up` SQL statements using `ALTER TABLE users ADD COLUMN IF NOT EXISTS`, and a corresponding `apply*Migration()` function.

**Files**:
- `src/lib/server/migrations.ts` — add migration version 11 + apply function

**Status**: ✅ COMPLETED
**Implementation Summary**: Added migration version 11 'add_teleport_charges' with ALTER TABLE statements, and applyTeleportChargesMigration() function called from applyTechMigrations().
**Files Modified/Created**:
- `src/lib/server/migrations.ts` — migration v11 + applyTeleportChargesMigration()
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 2.3: Update User class

**Action**: 
- Add `teleportCharges: number` and `teleportLastRegen: number` fields to User class
- Add these to the constructor parameters
- The fields are stored as fractional values internally; consumers should use `Math.floor(teleportCharges)` for usable charges

**Files**:
- `src/lib/server/user/user.ts` — add fields + constructor params

**Status**: ✅ COMPLETED
**Implementation Summary**: Added teleportCharges and teleportLastRegen fields to User class with constructor parameters (inserted before ship_id?).
**Files Modified/Created**:
- `src/lib/server/user/user.ts` — added fields, constructor params
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

#### Task 2.4: Update UserRow and persistence

**Action**: 
- Add `teleport_charges: number` and `teleport_last_regen: number` to `UserRow` interface
- Update `userFromRow()` to read the new columns (with defaults: `teleport_charges ?? 0`, `teleport_last_regen ?? 0`)
- Update `saveUserToDb()` UPDATE query to include the two new columns (new $25 and $26 params, update WHERE to $27)
- Update `createUser()` INSERT if it includes explicit columns

**Files**:
- `src/lib/server/user/userRepo.ts` — UserRow, userFromRow, saveUserToDb, createUser

**Status**: ✅ COMPLETED
**Implementation Summary**: Updated UserRow interface, userFromRow() with fallback defaults, saveUserToDb() UPDATE query ($24,$25 params, WHERE $26), and both createUser INSERT variants.
**Files Modified/Created**:
- `src/lib/server/user/userRepo.ts` — all specified changes applied
- Updated all existing test files that call `new User()` to include new teleportCharges=0, teleportLastRegen=0 params
**Deviations from Plan**: Plan said WHERE to $27 (add 2 columns after $23), but we now have $24 teleport_charges, $25 teleport_last_regen, WHERE $26 (the previous $24 WHERE moved to $26 since we added 2 params).
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

---

### Goal 3: Backend Logic — Charge Filling & Teleport Action

**Description**: Implement the server-side logic for teleport charge accumulation (delta-based, time-multiplier-aware) and the teleport action API endpoint.

#### Sub-Goal 3.1: Teleport Charge Filling

**Description**: Add an `updateTeleportCharges(now)` method to the User class that follows the exact same delta-based pattern as `updateDefenseValues()`. Call it from `updateStats()` alongside defense regen.

##### Task 3.1.1: Implement updateTeleportCharges() on User

**Action**: Add method to User class:
```
updateTeleportCharges(now: number): void
```
Logic:
1. Get max charges: `getResearchEffectFromTree(this.techTree, ResearchType.Teleport)` → if 0, return (no teleport research)
2. Get recharge time: `getResearchEffectFromTree(this.techTree, ResearchType.TeleportRechargeSpeed)` → seconds for one charge
3. If recharge time ≤ 0, return (safety)
4. Calculate elapsed: `now - this.teleportLastRegen`
5. If elapsed ≤ 0, return
6. Apply time multiplier: `gameElapsed = elapsed * TimeMultiplierService.getInstance().getMultiplier()`
7. Calculate charge gain: `gameElapsed / rechargeTime`
8. Add to charges: `this.teleportCharges = Math.min(this.teleportCharges + chargeGain, maxCharges)`
9. Update timestamp: `this.teleportLastRegen = now`

**Files**:
- `src/lib/server/user/user.ts` — add `updateTeleportCharges()` method

**Status**: ✅ COMPLETED (Tasks 3.1.1, 3.1.2, 3.1.3 combined)
**Implementation Summary**: Implemented updateTeleportCharges(now) method on User class following the same delta-based pattern as updateDefenseValues(). Handles first-call initialization (teleportLastRegen===0), applies time multiplier, and caps at maxCharges. Called from updateStats().
**Files Modified/Created**:
- `src/lib/server/user/user.ts` — updateTeleportCharges() method + call from updateStats()
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

##### Task 3.1.2: Call updateTeleportCharges from updateStats

**Action**: In `User.updateStats()`, after the `updateDefenseValues(now)` call, add `this.updateTeleportCharges(now)`.

**Files**:
- `src/lib/server/user/user.ts` — modify `updateStats()`

**Status**: ✅ COMPLETED (part of Task 3.1.1)
**Implementation Summary**: Added `this.updateTeleportCharges(now)` call after updateDefenseValues in updateStats().
**Deviations from Plan**: None

##### Task 3.1.3: Initialize teleportLastRegen on first use

**Action**: When `teleportLastRegen` is 0 (default for new/migrated users) and the user has teleport research, set it to `now` to start the timer. This prevents retroactive charge accumulation. Handle this in `updateTeleportCharges()` — if `teleportLastRegen === 0`, set it to `now` and return without adding charges.

**Files**:
- `src/lib/server/user/user.ts` — handle in `updateTeleportCharges()`

**Status**: ✅ COMPLETED (part of Task 3.1.1)
**Implementation Summary**: Handled in updateTeleportCharges() - if teleportLastRegen===0, set to now and return.
**Deviations from Plan**: None

##### Task 3.1.4: Write unit tests for charge filling

**Action**: Test:
- `updateTeleportCharges_noTeleportResearch_doesNothing`
- `updateTeleportCharges_fullCharges_doesNotExceedMax`
- `updateTeleportCharges_partialRecharge_addsFractionalCharge`
- `updateTeleportCharges_elapsedTime_correctGain` (e.g., 12h with 24h recharge → 0.5 charges)
- `updateTeleportCharges_timeMultiplier_appliesCorrectly`
- `updateTeleportCharges_firstCall_initializesTimestamp`

**Files**:
- `src/__tests__/api/teleport-charges.test.ts` — new test file

**Status**: ✅ COMPLETED
**Implementation Summary**: Created 10 unit tests covering all specified scenarios plus additional edge cases.
**Files Modified/Created**:
- `src/__tests__/api/teleport-charges.test.ts` — new file with 10 unit tests
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All 10 tests passing

#### Sub-Goal 3.2: Teleport API Endpoint

**Description**: Create a new POST `/api/teleport` route that consumes a charge and moves the ship.

##### Task 3.2.1: Create teleport API route

**Action**: Create `src/app/api/teleport/route.ts` following the navigate route pattern:
1. Session/auth check
2. Acquire `USER_LOCK` then `WORLD_LOCK` (same lock order as navigate)
3. Get user via `UserCache.getInstance2().getUserByIdWithLock()`
4. Validate: `user.inBattle` → 400 error "Cannot teleport while in battle"
5. Validate: `Math.floor(user.teleportCharges) < 1` → 400 error "No teleport charges available"
6. Read `{ x, y, preserveVelocity }` from request body
7. Validate coordinates: `0 ≤ x ≤ worldWidth, 0 ≤ y ≤ worldHeight`
8. Get world, update physics
9. Find player ship by `user.ship_id`
10. Set ship position to `(x, y)` and `last_position_update_ms = Date.now()`
11. If `!preserveVelocity`: set `ship.speed = 0` (angle unchanged per requirement)
12. Deduct 1 from `user.teleportCharges`: `user.teleportCharges = user.teleportCharges - 1` (stays fractional, just minus 1)
13. Update world cache
14. Return JSON: `{ success: true, ship: { x, y, speed, angle }, remainingCharges: Math.floor(user.teleportCharges) }`

**Files**:
- `src/app/api/teleport/route.ts` — new file

**Status**: ✅ COMPLETED
**Implementation Summary**: Created POST /api/teleport following the navigate route pattern with USER_LOCK→WORLD_LOCK ordering, all specified validations, and proper charge deduction.
**Files Modified/Created**:
- `src/app/api/teleport/route.ts` — new API route
**Deviations from Plan**: Coordinate validation happens before body parsing (after session/auth check) for cleaner flow.
**Arc42 Updates**: None required
**Test Results**: ✅ All tests passing

##### Task 3.2.2: Write integration tests for teleport API

**Action**: Test:
- `teleport_validCharges_movesShipAndDecrementsCharge`
- `teleport_noCharges_returns400`
- `teleport_inBattle_returns400`
- `teleport_preserveVelocity_keepsSpeed`
- `teleport_zeroVelocity_setsSpeedToZero`
- `teleport_invalidCoordinates_returns400`
- `teleport_notAuthenticated_returns401`
- `teleport_fractionalCharges_onlyUsesWholeCharge` (e.g., 1.5 charges → can teleport, left with 0.5)

**Files**:
- `src/__tests__/api/teleport-api.test.ts` — new test file

**Status**: ✅ COMPLETED
**Implementation Summary**: Created 9 integration tests covering all specified scenarios including authentication, charge validation, coordinate validation, battle state, velocity preservation, and fractional charges.
**Files Modified/Created**:
- `src/__tests__/api/teleport-api.test.ts` — new file with 9 integration tests
**Deviations from Plan**: None
**Arc42 Updates**: None required
**Test Results**: ✅ All 9 tests passing

---

### Goal 4: Frontend — Research Page Integration

**Description**: Ensure both teleport researches appear correctly on the research page under Ship → shipSpeed → teleport → teleportRechargeSpeed.

**Note**: Most of this is covered by Task 1.5 and Task 1.6. This goal is for verification and any additional frontend-specific work.

#### Task 4.1: Verify research page rendering

**Action**: After implementing Goal 1 tasks, verify that:
- Teleport research appears under Ship → shipSpeed with description "Unlocks teleport and adds one charge per level."
- TeleportRechargeSpeed appears as child of Teleport, only visible/researchable after Teleport ≥ 1
- Both show correct costs, durations, and effects
- Images load correctly

**Files**:
- `src/app/research/ResearchPageClient.tsx` — verify (no changes expected beyond Task 1.6)

---

### Goal 5: Frontend — Game Page Teleport Controls

**Description**: Add teleport UI controls to the game page below the existing navigation controls. Controls are only visible when the player has researched Teleport (level ≥ 1).

#### Task 5.1: Create teleport client service

**Action**: Create a new service function to call the teleport API.

```typescript
export async function teleportShip(params: { x: number; y: number; preserveVelocity: boolean }): Promise<TeleportResponse>
```

**Files**:
- `src/lib/client/services/teleportService.ts` — new file

**Status**: ✅ COMPLETED (part of Goal 5)
**Implementation Summary**: Created teleportService.ts with teleportShip() function that POSTs to /api/teleport.
**Files Modified/Created**:
- `src/lib/client/services/teleportService.ts` — new service

#### Task 5.2: Extend useWorldData or create useTeleportData hook

**Action**: The game page needs to know the user's teleport charges, max charges, and next charge time. Options:
- **Preferred**: Extend the existing `/api/ship-stats` or `/api/user-stats` response to include `teleportCharges`, `teleportMaxCharges`, `teleportRechargeTimeSec` (time until next full charge), and `teleportRechargeSpeed` (total seconds per charge).
- The data should be computed server-side in the relevant API route.
- Update the existing hook or create a small `useTeleportInfo` hook that polls this data.

**Files**:
- `src/app/api/user-stats/route.ts` — extend response with teleport data
- `src/lib/client/hooks/` — update or create hook for teleport data

**Status**: ✅ COMPLETED (part of Goal 5)
**Implementation Summary**: Extended /api/user-stats to include teleport data computed via getResearchEffectFromTree. Created useTeleportData hook that polls user-stats every 5s. Updated UserStatsResponse interface.

#### Task 5.3: Add teleport controls to GamePageClient

**Action**: Below the existing `.navigation-controls` div, add a new section `.teleport-controls` (conditionally rendered when `teleportMaxCharges > 0`):

1. **Charges display**: "Teleport Charges: {current}/{max}"
2. **Recharge timer**: If charges < max, show "Next charge in: {formatted time}" — compute from `teleportRechargeTimeSec`
3. **Coordinate teleport**: Two number inputs (X, Y) + "Teleport" button
   - On click: calls `teleportShip({ x, y, preserveVelocity: false })`, then refetch world data
   - Disabled if charges < 1
4. **Canvas teleport toggle**: A "Teleport to Click" toggle button
   - When active, visually highlighted (e.g., different background color or border)
   - Sets a state like `isTeleportClickMode: true`
   - Label shows "Click on map to teleport..." when active
   - Disabled if charges < 1

**Files**:
- `src/app/game/GamePageClient.tsx` — add teleport UI section

**Status**: ✅ COMPLETED (part of Goal 5)
**Implementation Summary**: Added teleport controls section with charges display, recharge timer, coordinate teleport inputs/button, and teleport-to-click toggle.

#### Task 5.4: Implement canvas click teleport in Game.ts

**Action**: Modify the click handler in `Game.ts` to support a teleport-click mode:
1. Add a `teleportClickMode: boolean` property to Game class (default false)
2. Add `setTeleportClickMode(enabled: boolean)` method
3. Add a callback `onTeleportClick: ((worldX: number, worldY: number) => void) | null`
4. In `initializeClickHandler()`, at the TOP of the handler (before any other logic): if `teleportClickMode` is true and `onTeleportClick` is set:
   - Convert canvas click to world coordinates (using existing logic: `worldMouseX = mouseX - canvasWidth/2 + ship.getX()`, `worldMouseY = mouseY - canvasHeight/2 + ship.getY()`)
   - Wrap coordinates to world bounds (toroidal)
   - Call `onTeleportClick(worldX, worldY)`
   - Set `teleportClickMode = false`
   - Return early (don't process normal click actions)

5. In `GamePageClient.tsx`:
   - When "Teleport to Click" toggle is activated, call `gameInstance.setTeleportClickMode(true)`
   - Set `gameInstance.onTeleportClick = async (x, y) => { await teleportShip({ x, y, preserveVelocity: true }); setIsTeleportClickMode(false); refetch(); }`
   - When toggle is deactivated, call `gameInstance.setTeleportClickMode(false)`

**Files**:
- `src/lib/client/game/Game.ts` — add teleport click mode
- `src/app/game/GamePageClient.tsx` — wire up teleport click callback

**Status**: ✅ COMPLETED (part of Goal 5)
**Implementation Summary**: Added teleportClickMode property, setTeleportClickMode(), onTeleportClick callback, and click handler intercept to Game.ts. Wired up in GamePageClient with toggle button.

#### Task 5.5: Add CSS styling for teleport controls

**Action**: Add styles for the teleport controls section — consistent with existing navigation controls. Teleport toggle button should have an active state visual indicator.

**Files**:
- `src/app/globals.css` or inline styles in GamePageClient — depends on existing pattern

**Status**: ✅ COMPLETED (part of Goal 5)
**Implementation Summary**: Added teleport control styles to GamePage.css (.teleport-controls, .teleport-charges-display, .teleport-recharge-timer, .teleport-click-button.active).

#### Task 5.6: Write UI component tests

**Action**: Test:
- `teleportControls_noTeleportResearch_controlsNotRendered`
- `teleportControls_withTeleportResearch_controlsRendered`
- `teleportControls_noCharges_buttonsDisabled`
- `teleportControls_withCharges_buttonsEnabled`
- `teleportControls_rechargeTimer_showsCorrectTime`

**Files**:
- `src/__tests__/components/teleport-controls.test.tsx` — new test file

**Status**: ✅ COMPLETED
**Implementation Summary**: Created teleportService.ts, extended user-stats API with teleport data, created useTeleportData hook, added teleport controls UI to GamePageClient, added teleport-click mode to Game.ts, added CSS styles, and wrote 15 UI tests.
**Files Modified/Created**:
- `src/lib/client/services/teleportService.ts` — new service for calling /api/teleport
- `src/app/api/user-stats/route.ts` — extended response with teleportCharges, teleportMaxCharges, teleportRechargeTimeSec, teleportRechargeSpeed
- `src/lib/client/services/userStatsService.ts` — extended UserStatsResponse interface with teleport fields
- `src/lib/client/hooks/useTeleportData.ts` — new polling hook for teleport data
- `src/app/game/GamePageClient.tsx` — added teleport controls UI section with charges display, recharge timer, coordinate inputs, teleport button, and teleport-to-click toggle
- `src/lib/client/game/Game.ts` — added teleportClickMode property, setTeleportClickMode() method, onTeleportClick callback, and click handler intercept logic
- `src/app/game/GamePage.css` — added .teleport-controls, .teleport-charges-display, .teleport-recharge-timer, .teleport-click-button.active styles
- `src/__tests__/components/teleport-controls.test.tsx` — 15 tests covering rendering, button states, timer display, coordinate teleport, and click-mode toggle
- Updated existing test mocks: researchPageClient.test.tsx, useIron.test.ts, useIron-timeMultiplier.test.ts, useIron-xp-display.test.ts, collectionService.test.ts (added teleport fields to UserStatsResponse mocks)
**Deviations from Plan**: Teleport controls are placed between navigation-controls and debug-toggle (not strictly "below navigation-controls" as a last item, but logically between navigation and debug).
**Arc42 Updates**: None required
**Test Results**: ✅ 15 new tests passing, 1047 total tests passing (1 pre-existing flaky parallel-execution test in user-collection-rewards.test.ts — passes in isolation), no linting errors

---

## Dependencies

- No new npm packages required. Feature uses existing Next.js API routes, iron-session, and PostgreSQL.

## Arc42 Documentation Updates

**Proposed Changes**: None — this feature extends existing patterns (research system, user stats, API routes) without introducing new architectural components or external dependencies.

## Architecture Notes

### Patterns followed:
- **Delta-based time calculation**: Teleport charge filling follows the exact same pattern as `updateDefenseValues()` — elapsed time × multiplier, fractional accumulation, clamped to max.
- **Lock ordering**: Teleport API uses USER_LOCK → WORLD_LOCK (same as navigate), maintaining the IronGuard lock hierarchy.
- **Cache-first persistence**: New user fields flow through UserCache with write-behind persistence; no direct DB access from API routes.
- **Research effect calculation**: Uses existing `getResearchEffectFromTree()` — no custom calculation logic needed.
- **API route pattern**: Teleport API follows navigate route structure (session → auth → locks → validate → update → respond).

### Key design decisions:
- **Fractional charges**: Charges accumulate as fractional values (DOUBLE PRECISION) for smooth delta-based math. Only whole numbers are usable (`Math.floor`). This avoids complex timestamp tracking for partial periods.
- **Two teleport modes**: Coordinate input (zeros velocity) vs canvas click (preserves velocity) — distinguished by `preserveVelocity` boolean in the API.
- **Unlimited range**: No range validation beyond world boundaries (0 to worldWidth/Height).

## Agent Decisions

1. **Repurpose existing Teleport research** (confirmed with user): Rather than creating a new `TeleportCharges` ResearchType, we modify the existing `ResearchType.Teleport` to represent charge capacity. This keeps the tech tree simpler and reuses the existing `teleport` treeKey.

2. **Research effect for charges = level**: Using `baseValue: 0, baseValueIncrease: { type: 'constant', value: 1 }` gives effect = 0 at level 0, 1 at level 1, 2 at level 2, etc. Need to verify `getResearchEffect` handles the constant type correctly for this configuration — existing code checks `if (level <= 0) return 0` for constant type.

3. **TeleportRechargeSpeed naming** (confirmed with user): User chose "TeleportRechargeSpeed" over "TeleportRefillRate" or "TeleportCooldown".

4. **Cost scaling 1.3× for recharge speed** (confirmed with user): Slow cost increase as requested — L2: 13k, L3: 16.9k, L4: ~22k.

5. **Base research duration 1800s** (confirmed with user): Both teleport and recharge speed researches take 30 minutes base build time (user specified this explicitly).

6. **Time multiplier applies to recharge** (confirmed with user): Turbo mode accelerates teleport charge filling, consistent with defense regen.

7. **Battle blocks teleport** (confirmed with user): Same restriction as navigation.

8. **Angle unchanged on teleport** (confirmed with user): Teleport doesn't modify ship angle regardless of mode.

9. **Canvas teleport as toggle button** (confirmed with user): Click to enter mode → click canvas to teleport → auto-exits mode.

10. **Hierarchy: TeleportRechargeSpeed as child of Teleport** (confirmed with user): Requires Teleport to be researched first (level ≥ 1) to see/research refill rate.

11. **User-stats API extended** (agent decision): Rather than creating a separate API endpoint for teleport info, extend the existing `/api/user-stats` response. This keeps the polling model simple and avoids extra network requests. The game page already fetches user stats.

## Open Questions

_No remaining open questions. All design decisions have been confirmed with the user._
