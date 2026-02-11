# Development Plan

## Vision

Centralize the currently hardcoded world size (500×500) into a single global constant, make all position calculations robust against out-of-range values by normalizing them within world bounds, and then increase the world size to 5000×5000.

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

### Goal 1: Create Centralized World Size Constants

**Description**: Define world size in a single shared location that can be imported by both client and server code, ensuring consistency across the entire codebase.

**Quality Requirements**: Single source of truth for world dimensions, TypeScript type safety.

#### Task 1.1: Create Shared World Constants Module

**Action**: Create a new world constants file in the shared module that exports world size values.

**Files**:

- `src/shared/src/worldConstants.ts` - New shared constants file

**Inputs**: Current hardcoded values (500×500, to be changed to 5000×5000)

**Outputs**: Exported `DEFAULT_WORLD_WIDTH`, `DEFAULT_WORLD_HEIGHT`, and `WorldBounds` default object

**Status**: ✅ COMPLETED

**Implementation Summary**: Created centralized world constants module with `DEFAULT_WORLD_WIDTH`, `DEFAULT_WORLD_HEIGHT`, and `DEFAULT_WORLD_BOUNDS` exports, starting with 500×500 dimensions.

**Files Modified/Created**:
- `src/shared/src/worldConstants.ts` - Implemented world size constants (DEFAULT_WORLD_WIDTH=500, DEFAULT_WORLD_HEIGHT=500, DEFAULT_WORLD_BOUNDS)
- `src/__tests__/shared/worldConstants.test.ts` - Added 14 comprehensive tests covering type safety, value consistency, and structure validation

**Deviations from Plan**: Output name changed from `WorldBounds` default object to `DEFAULT_WORLD_BOUNDS` for consistency with naming convention.

**Test Results**: All 14 tests passing, 491 total tests passing

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Implementation meets all requirements. Clean code with comprehensive test coverage. Proper use of TypeScript types, ES Modules, and naming conventions. WorldBounds type properly reused from physics.ts. Documentation clearly indicates this is starting with 500×500 and will be updated to 5000×5000 in Goal 8. No issues found.

#### Task 1.2: Export from Shared Module Index

**Action**: Export the new world constants from the shared module index.

**Files**:

- `src/shared/src/index.ts` - Add exports for world constants

**Status**: ✅ COMPLETED

**Implementation Summary**: Added barrel export for worldConstants module to shared package index.

**Files Modified/Created**:
- `src/shared/src/index.ts` - Added `export * from './worldConstants'` following existing barrel export pattern

**Deviations from Plan**: None

**Test Results**: All tests passing (491 tests), TypeScript compilation successful, lint clean

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Barrel export pattern correctly followed. Module properly integrated into shared package index. All tests passing, TypeScript compilation clean. Implementation meets requirements.

---

### Goal 2: Update Server-Side World Size References

**Description**: Replace all hardcoded world size values on the server with imports from the shared constants.

#### Task 2.1: Update Server Constants File

**Action**: Update `src/lib/server/constants.ts` to import from shared constants instead of defining its own values. Also update `DEFAULT_SHIP_START_X` and `DEFAULT_SHIP_START_Y` to use world center (half of world size).

**Files**:

- `src/lib/server/constants.ts` - Replace hardcoded 500 values with imports and calculate center positions

**Status**: ✅ COMPLETED

**Implementation Summary**: Replaced hardcoded world size constants with imports from shared module and updated ship starting positions to dynamically calculate world center.

**Files Modified/Created**:
- `src/lib/server/constants.ts` - Removed duplicate `DEFAULT_WORLD_WIDTH` and `DEFAULT_WORLD_HEIGHT` (lines 12-13), imported from `@shared/worldConstants`, updated `DEFAULT_SHIP_START_X/Y` to calculate as `DEFAULT_WORLD_WIDTH / 2` and `DEFAULT_WORLD_HEIGHT / 2`
- `src/__tests__/lib/server-constants.test.ts` - Added 7 tests verifying ship start positions are world center and match shared constants

**Deviations from Plan**: None

**Test Results**: All tests passing (7 new tests added)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Clean implementation following shared constants pattern. Ship starting positions correctly calculated as world center. Comprehensive test coverage with meaningful assertions. No code duplication detected.

#### Task 2.2: Update worldRepo.ts

**Action**: Replace hardcoded `{ width: 500, height: 500 }` with imported shared constants.

**Files**:

- `src/lib/server/world/worldRepo.ts` - Import and use shared world size constants (line ~50)

**Status**: ✅ COMPLETED

**Implementation Summary**: Replaced hardcoded world size object literal with `DEFAULT_WORLD_BOUNDS` import from shared constants.

**Files Modified/Created**:
- `src/lib/server/world/worldRepo.ts` - Added import for `DEFAULT_WORLD_BOUNDS` from `@shared/worldConstants`, replaced `{ width: 500, height: 500 }` at line 50 with `DEFAULT_WORLD_BOUNDS`
- `src/__tests__/lib/world-initialization.test.ts` - Added 5 tests verifying `loadWorldFromDb()` uses shared constants

**Deviations from Plan**: None

**Test Results**: All tests passing (5 new tests added)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Correct use of DEFAULT_WORLD_BOUNDS import. Replaced hardcoded object literal with shared constant. Tests properly verify both World.createDefault() and loadWorldFromDb() use shared constants.

#### Task 2.3: Update world.ts createDefault Method

**Action**: Replace hardcoded `{ width: 500, height: 500 }` in `World.createDefault()` with imported shared constants.

**Files**:

- `src/lib/server/world/world.ts` - Import and use shared world size constants (line ~194)

**Status**: ✅ COMPLETED

**Implementation Summary**: Replaced hardcoded world size object literal in `World.createDefault()` with `DEFAULT_WORLD_BOUNDS` import from shared constants.

**Files Modified/Created**:
- `src/lib/server/world/world.ts` - Added import for `DEFAULT_WORLD_BOUNDS` from `@shared/worldConstants`, replaced `{ width: 500, height: 500 }` at line 194 with `DEFAULT_WORLD_BOUNDS`
- Tests included in world-initialization.test.ts (covers both `World.createDefault()` and `loadWorldFromDb()`)

**Deviations from Plan**: None

**Test Results**: All tests passing (tests shared with Task 2.2)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Clean refactoring of World.createDefault() to use DEFAULT_WORLD_BOUNDS. Test coverage shared with Task 2.2 effectively validates both creation methods. No issues found.

#### Task 2.4: Update battleService.ts

**Action**: Replace hardcoded `WORLD_WIDTH = 3000` and `WORLD_HEIGHT = 3000` with imports from shared constants.

**Files**:

- `src/lib/server/battle/battleService.ts` - Import shared constants (lines 44-45)

**Status**: ✅ COMPLETED

**Implementation Summary**: Removed local world dimension constants and replaced all references with imports from shared constants module.

**Files Modified/Created**:
- `src/lib/server/battle/battleService.ts` - Added import for `DEFAULT_WORLD_WIDTH` and `DEFAULT_WORLD_HEIGHT` from `@shared/worldConstants`, removed local `WORLD_WIDTH` and `WORLD_HEIGHT` constants (lines 44-45), updated 4 references in `generateTeleportPosition()` function (lines 159, 160, 170, 171)
- `src/__tests__/lib/battle-world-constants.test.ts` - Added 4 tests verifying shared constants are defined and accessible

**Deviations from Plan**: Corrected a discrepancy - the original `WORLD_WIDTH` and `WORLD_HEIGHT` in battleService.ts were set to 3000 (not 500), now properly use the centralized 500 value from shared constants, which will be updated to 5000 in Goal 8.

**Test Results**: All tests passing (4 new tests added)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Excellent correction of battle arena size discrepancy (was 3000x3000, now properly uses 500x500 from shared constants). All 4 references in generateTeleportPosition() correctly updated. Proper IronGuard lock usage verified. No code duplication detected.

**Goal 2 Summary**: All 4 tasks completed successfully. Total of 16 new tests added (507 tests passing). All server-side hardcoded world size values now reference the centralized shared constants module.

**Goal 2 Review Status**: ✅ APPROVED
**Goal 2 Reviewer**: Medicus
**Goal 2 Review Date**: 2026-02-10
**Goal 2 Review Notes**: All tasks completed to high quality standards. Implementation correctly eliminates server-side world size constant duplications. Tests are comprehensive and meaningful. TypeScript compilation clean. All 507 tests passing. No code duplication issues. Proper lock usage verified. Ready to proceed to Goal 3.

---

### Goal 3: Update Client-Side World Size References

**Description**: Update the client-side World class to use shared constants for its static defaults.

#### Task 3.1: Update Client World Class Defaults

**Action**: Import shared constants and use them as default values for `World.WIDTH` and `World.HEIGHT` static properties.

**Files**:

- `src/lib/client/game/World.ts` - Import shared constants and set defaults (lines 16-18)

**Status**: ✅ COMPLETED

**Implementation Summary**: Imported shared constants and updated World class static properties to use DEFAULT_WORLD_WIDTH and DEFAULT_WORLD_HEIGHT as default values.

**Files Modified/Created**:
- `src/lib/client/game/World.ts` - Added import for `DEFAULT_WORLD_WIDTH` and `DEFAULT_WORLD_HEIGHT` from `@shared/worldConstants`, updated lines 17-18 to use these constants as defaults for static properties
- `src/__tests__/lib/client-world-constants.test.ts` - Added 11 comprehensive tests covering static property initialization, server updates, instance methods, wrapping behavior, and consistency with shared constants

**Deviations from Plan**: None

**Test Results**: All tests passing (11 new tests for World class, 6 new tests for InterceptCalculator integration, total 524 tests passing)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Clean implementation with proper import of shared constants. World.WIDTH and World.HEIGHT static properties correctly initialized from DEFAULT_WORLD_WIDTH and DEFAULT_WORLD_HEIGHT. Server override mechanism works correctly via updateFromServerData() method. Comprehensive test coverage with 11 tests covering initialization, server updates, instance methods, wrapping behavior, and consistency. All tests passing. No code duplication detected.

#### Task 3.2: Verify InterceptCalculator Uses World Instance

**Action**: Verify `InterceptCalculator` gets world size from `World.WIDTH`/`World.HEIGHT` static properties (which are updated from server data). Currently uses `World.WIDTH` at line 40.

**Files**:

- `src/lib/client/game/InterceptCalculator.ts` - Verify (no change expected, uses `World.WIDTH`)

**Status**: ✅ COMPLETED

**Implementation Summary**: Verified InterceptCalculator correctly uses World.WIDTH static property at line 40; no changes needed.

**Files Modified/Created**:
- `src/lib/client/game/InterceptCalculator.ts` - No changes (already correctly using World.WIDTH for wrapping calculations)
- `src/__tests__/lib/intercept-calculator-world-integration.test.ts` - Added 6 comprehensive integration tests verifying InterceptCalculator works correctly with shared constants, world wrapping, dynamic resizing, and edge cases

**Deviations from Plan**: None

**Test Results**: All tests passing (6 new integration tests)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Verification complete - InterceptCalculator correctly uses World.WIDTH at line 40 for toroidal wrapping calculations. No changes needed as implementation already correct. Comprehensive integration tests (6 tests) cover world wrapping, dynamic resizing, edge cases (same position, zero speed), and consistency with shared constants. Tests properly structured and meaningful.

**Goal 3 Summary**: Both tasks completed successfully. Total of 17 new tests added (524 tests passing). Client-side World class now uses shared constants for default dimensions, maintaining consistency with server-side code. InterceptCalculator verified to work correctly with dynamic world dimensions.

**Goal 3 Review Status**: ✅ APPROVED
**Goal 3 Reviewer**: Medicus
**Goal 3 Review Date**: 2026-02-10
**Goal 3 Review Notes**: Excellent implementation quality for both tasks. Client-side World class properly refactored to use shared constants while maintaining mutable static property pattern for server override. InterceptCalculator already correctly implemented and verified with comprehensive integration tests. All 524 tests passing, lint clean (warnings only), TypeScript compilation successful. No code duplication detected. Proper ES Modules usage. Test naming follows convention. Ready to proceed to Goal 4.

---

### Goal 4: Add Position Normalization Function

**Description**: Create a robust utility function that normalizes any position into valid world bounds, handling edge cases like negative values and values exceeding world dimensions.

**Quality Requirements**: Handle all edge cases, comprehensive test coverage.

#### Task 4.1: Create Position Normalization Utility

**Action**: Add a `normalizePosition` function to the shared physics module that ensures positions are always within valid world bounds.

**Files**:

- `src/shared/src/physics.ts` - Add `normalizePosition(x, y, worldBounds): {x, y}` function

**Details**:

```typescript
export function normalizePosition(
  x: number,
  y: number,
  worldBounds: WorldBounds,
): { x: number; y: number } {
  // Use modulo and handle negatives to wrap positions into valid range
  let normalizedX =
    ((x % worldBounds.width) + worldBounds.width) % worldBounds.width;
  let normalizedY =
    ((y % worldBounds.height) + worldBounds.height) % worldBounds.height;
  return { x: normalizedX, y: normalizedY };
}
```

**Status**: ✅ COMPLETED

**Implementation Summary**: Added `normalizePosition` function to physics.ts using proven modulo arithmetic pattern for toroidal position wrapping.

**Files Modified/Created**:
- `src/shared/src/physics.ts` - Implemented `normalizePosition(x, y, worldBounds)` function with JSDoc documentation (lines 174-192)

**Deviations from Plan**: Changed `let` to `const` for normalizedX and normalizedY variables following ES6 best practices (values are not reassigned).

**Test Results**: Function implementation complete, covered by 12 comprehensive tests in Task 4.2.

#### Task 4.2: Add Tests for Position Normalization

**Action**: Add comprehensive unit tests for the `normalizePosition` function covering edge cases.

**Files**:

- `src/__tests__/shared/physics.test.ts` - Add test cases for normalizePosition

**Test Cases**:

- Position within bounds returns unchanged
- Position exactly at boundary (e.g., x=5000) wraps to 0
- Negative positions wrap correctly
- Very large out-of-range positions (e.g., 30000) normalize correctly
- Very negative positions (e.g., -3000) normalize correctly

**Status**: ✅ COMPLETED

**Implementation Summary**: Added 12 comprehensive tests covering all edge cases including within bounds, at boundaries, negative values, very large/negative values, floating point precision, and different world sizes.

**Files Modified/Created**:
- `src/__tests__/shared/physics.test.ts` - Added import for `normalizePosition` and 12 test cases covering all edge cases (lines 12, 412-518)

**Deviations from Plan**: Added 12 tests instead of the 5 mentioned in plan to provide more thorough coverage including:
- Position at origin (0,0)
- Slightly over boundary values with floating point precision
- Very negative non-multiples
- Very large non-multiples
- Floating point values
- Mixed boundary conditions with custom world bounds
- Future 5000x5000 world size validation

**Test Results**: All 536 tests passing (38 tests in physics.test.ts, 12 new for normalizePosition)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Excellent implementation. The `normalizePosition` function uses the proven modulo arithmetic pattern `((value % bound) + bound) % bound` that is consistent with existing physics functions. Clean code with proper JSDoc documentation, const instead of let for immutable variables, and pure function design. Test coverage is exceptional - 12 comprehensive tests covering all edge cases including within bounds, at boundaries, negative values, very large values, floating point precision, and different world sizes. All 536 tests passing. No code duplication issues - the pattern reuses the same formula as `updateObjectPosition` and `updateObjectPositionWithTimeCorrection`. Client-side `wrapPosition` uses equivalent but different syntax (pre-existing, not in scope). TypeScript compilation clean, lint passed. Ready for Goal 5.

**Goal 4 Summary**: Both tasks completed successfully with high quality. Total of 12 new tests added. The `normalizePosition` function provides a clean, reusable utility for position normalization at data load boundaries.

**Goal 4 Review Status**: ✅ APPROVED
**Goal 4 Reviewer**: Medicus
**Goal 4 Review Date**: 2026-02-10
**Goal 4 Review Notes**: Outstanding implementation quality. Function is mathematically correct, well-tested, and properly documented. Test coverage exceeds plan requirements (12 tests vs 5 requested). All tests follow naming convention. Ready to proceed to Goal 5.

---

### Goal 5: Apply Position Normalization in Data Load Paths

**Description**: Ensure positions loaded from the database or received from external sources are normalized before use.

#### Task 5.1: Normalize Positions When Loading World from Database

**Action**: Apply `normalizePosition` to all space objects loaded from the database in `loadWorldFromDb`.

**Files**:

- `src/lib/server/world/worldRepo.ts` - Import and apply `normalizePosition` when mapping database rows

**Status**: ✅ COMPLETED

**Implementation Summary**: Added position normalization in `loadWorldFromDb` function to ensure all positions loaded from database are within valid world bounds using `normalizePosition` from shared physics module.

**Files Modified/Created**:
- `src/lib/server/world/worldRepo.ts` - Added import for `normalizePosition` from `@shared/physics`, applied normalization in the `map()` function when converting database rows to space objects (lines 34-36)
- `src/__tests__/lib/position-normalization-worldRepo.test.ts` - Added 10 comprehensive tests covering out-of-bounds positive/negative positions, very large/negative values, floating point precision, boundary wrapping, and multiple objects

**Deviations from Plan**: None

**Test Results**: All 10 new tests passing, total 559 tests passing

#### Task 5.2: Normalize Positions in Client World Update

**Action**: Apply position normalization when updating world data from server in the client `World` class.

**Files**:

- `src/lib/client/game/World.ts` - Apply normalization in `updateFromServerData` method

**Status**: ✅ COMPLETED

**Implementation Summary**: Added position normalization in `updateFromServerData` method to ensure all positions received from server are normalized before client object creation, protecting against out-of-bounds server data.

**Files Modified/Created**:
- `src/lib/client/game/World.ts` - Added imports for `normalizePosition` and `WorldBounds` from `@shared/physics`, created `worldBounds` object from `worldData.worldSize`, applied normalization before object construction (lines 9-11, 119-126, 131-135)
- `src/__tests__/lib/position-normalization-client.test.ts` - Added 13 comprehensive tests covering out-of-bounds positions, negative values, very large/negative values, floating point precision, boundary wrapping, player ships, multiple object types, custom world sizes, and verification that normalization occurs before object construction

**Deviations from Plan**: None

**Test Results**: All 13 new tests passing, total 559 tests passing

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Notes**: Excellent implementation of position normalization at both data load boundaries. Server-side (worldRepo.ts) normalizes positions when loading from database using DEFAULT_WORLD_BOUNDS. Client-side (World.ts) normalizes positions before object construction in updateFromServerData using dynamic worldBounds from server data. Normalization is correctly applied BEFORE object construction, ensuring constructors receive valid coordinates. Both implementations use the normalizePosition function from shared physics module. 23 comprehensive tests covering all edge cases (out-of-bounds, negative, very large/negative, floating point, boundaries, multiple objects). All 559 tests passing, lint clean (warnings only), typecheck clean. No code duplication - existing wrapPosition in client World uses equivalent but different approach (pre-existing, not in scope). Defense-in-depth strategy: positions normalized at both boundaries for maximum robustness.

**Goal 5 Summary**: Both tasks completed successfully. Total of 23 new tests added. Position normalization is now applied at both data load boundaries (database loading on server and server data updates on client), ensuring all positions are always within valid world bounds.

**Goal 5 Review Status**: ✅ APPROVED
**Goal 5 Reviewer**: Medicus
**Goal 5 Review Date**: 2026-02-10
**Goal 5 Review Notes**: Outstanding implementation quality with comprehensive test coverage. Position normalization correctly applied at both critical boundaries: database loading (server-side) and server data updates (client-side). Implementation follows defense-in-depth principle - positions are normalized at both entry points. Normalization occurs before object construction, ensuring constructors receive valid coordinates. All 23 tests are meaningful, cover edge cases, and follow naming convention. All 559 tests passing. No code duplication issues. TypeScript compilation clean. Ready to proceed to Goal 6.

---

### Goal 6: Update Seed Data for Larger World

**Description**: Update seed data positions and comments to reflect the new 5000×5000 world size. Spread objects more evenly across the larger world.

#### Task 6.1: Update DEFAULT_SPACE_OBJECTS Positions

**Action**: Update the hardcoded positions in `DEFAULT_SPACE_OBJECTS` to spread across the 5000×5000 world instead of the 500×500 world.

**Files**:

- `src/lib/server/seedData.ts` - Update space object coordinates (lines ~351-365)

**Details**: Multiply existing coordinates by 10 to scale appropriately, or choose new representative positions.

**Status**: ✅ COMPLETED

**Implementation Summary**: Updated all space object coordinates by multiplying by 10 to scale from 500x500 to 5000x5000 world. Asteroids, shipwrecks, and escape pods now spread across the larger world.

**Files Modified/Created**:
- `src/lib/server/seedData.ts` - Updated DEFAULT_SPACE_OBJECTS positions (lines 351-365): multiplied all coordinates by 10 (e.g., 100→1000, 400→4000)
- `src/__tests__/lib/picture-id.test.ts` - Updated hardcoded position assertions to match new coordinates (lines 116-119)

**Deviations from Plan**: None

**Test Results**: All picture-id tests passing (8 tests), positions verified correctly

#### Task 6.2: Update Seed Data Comments

**Action**: Update comments referencing "500x500 world" to "5000x5000 world".

**Files**:

- `src/lib/server/seedData.ts` - Update comments (lines ~498-500, ~85)

**Status**: ✅ COMPLETED

**Implementation Summary**: Updated all comments referencing "500x500 world" to "5000x5000 world" in seed data file.

**Files Modified/Created**:
- `src/lib/server/seedData.ts` - Updated 4 comment references:
  - Line 85: User 'a' ship position comment
  - Line 352: DEFAULT_SPACE_OBJECTS comment
  - Line 498: Test environment logging comment
  - Line 500: Production environment logging comment

**Deviations from Plan**: None

**Test Results**: Comments updated, no test changes needed

#### Task 6.3: Update User Ship Starting Positions

**Action**: Update user ship positions in `DEFAULT_USERS` to use the world center (2500, 2500) instead of (250, 250).

**Files**:

- `src/lib/server/seedData.ts` - Update ship positions in DEFAULT_USERS

**Status**: ✅ COMPLETED

**Implementation Summary**: Updated all user ship starting positions to use world center (2500, 2500) and maintained relative positioning for dummy users (within 100-unit battle range).

**Files Modified/Created**:
- `src/lib/server/seedData.ts` - Updated ship positions:
  - User 'a': (250, 250) → (2500, 2500)
  - User 'dummy': (280, 280) → (2530, 2530)
  - User 'dummy2': (220, 280) → (2470, 2530)
  - User 'dummy3': (310, 280) → (2560, 2530)
  - User 'dummy4': (250, 310) → (2500, 2560)
  - Test users: 250+i*10 → 2500+i*10 (line 485)
- `src/__tests__/lib/picture-id.test.ts` - Updated position assertions to match new coordinates
- `scripts/reseed-test.ts` - Created helper script for reseeding test database

**Deviations from Plan**: 
- Created helper script for reseeding test/production databases
- Maintained battle-range proximity (30-60 units from center) for dummy users to preserve test functionality

**Test Results**: All 8 picture-id tests passing, ship positions verified correctly

**Goal 6 Summary**: All 3 tasks completed successfully. Seed data now uses 5000x5000 coordinates while world size constants remain at 500x500 (will be updated in Goal 8). User ships clustered at (2500, 2500), space objects spread across larger world. Test database reseeded with new positions.

---

### Goal 7: Update Test Files and Refactor InterceptCalculator

**Description**: Update test files that use hardcoded world size values to use shared constants or appropriate test values. Refactor InterceptCalculator to accept world size as a parameter instead of reading from World.WIDTH static property, enabling tests to work with various world sizes.

#### Task 7.1: Refactor InterceptCalculator to Accept World Size Parameter

**Action**: Modify the `calculateInterceptAngle` method signature to accept `worldSize` as a parameter instead of reading from `World.WIDTH` static property.

**Files**:

- `src/lib/client/game/InterceptCalculator.ts` - Update method signature and implementation (line 40)

**Current Implementation**:
```typescript
static calculateInterceptAngle(ship: SpaceObjectOld, target: SpaceObjectOld, maxSpeed?: number): InterceptResult
```

**New Implementation**:
```typescript
static calculateInterceptAngle(ship: SpaceObjectOld, target: SpaceObjectOld, worldSize: number, maxSpeed?: number): InterceptResult
```

**Details**:
- Add `worldSize: number` parameter after `target` and before `maxSpeed`
- Replace line 40: `const wrapSize = World.WIDTH;` with `const wrapSize = worldSize;`
- Update JSDoc comment to document the new parameter

**Quality Requirements**:
- Method signature should clearly indicate worldSize is required
- No breaking changes to return type or other parameters
- Implementation should continue to work with toroidal wrapping logic

#### Task 7.2: Update InterceptCalculator Call Sites

**Action**: Update all code that calls `calculateInterceptAngle` to pass the world size parameter.

**Files**:
- `src/lib/client/game/Game.ts` - Update call sites to pass `World.WIDTH`
- `src/lib/client/renderers/InterceptionLineRenderer.ts` - Update call sites to pass `World.WIDTH`

**Details**:
- Search for all calls to `InterceptCalculator.calculateInterceptAngle`
- Add `World.WIDTH` as the third parameter in each call
- Maintain existing functionality while making world size explicit

**Quality Requirements**:
- All existing functionality should continue to work
- No runtime errors after refactoring
- TypeScript compiler should verify all call sites are updated

#### Task 7.3: Update InterceptCalculator Tests

**Action**: Update InterceptCalculator test files to pass world size explicitly, using 500×500 for existing test scenarios to maintain test validity.

**Files**:
- `src/__tests__/lib/InterceptCalculator.test.ts` - Update all test calls to pass worldSize parameter
- `src/__tests__/lib/intercept-calculator-world-integration.test.ts` - Update integration test calls

**Details**:
- Add `500` (or appropriate test value) as the third parameter to all `calculateInterceptAngle` calls
- Consider adding test cases with different world sizes (e.g., 1000×1000, 5000×5000) to verify the calculator works with various dimensions
- Update test descriptions if needed to document the world size being tested
- Existing test assertions should remain valid when using 500×500

**Test Coverage Requirements**:
- All existing tests should pass with 500×500 world size
- Add at least 2-3 test cases with different world sizes to verify flexibility
- Test toroidal wrapping behavior with various world dimensions

**Quality Requirements**:
- Test clarity: world size should be explicit in test setup
- Test reusability: tests should be easy to run with different world sizes
- Documentation: test comments should indicate what world size is being tested

**Status**: ✅ COMPLETED

**Implementation Summary**: 
Successfully refactored InterceptCalculator.calculateInterceptAngle to accept worldSize as an explicit parameter, updated all call sites to pass World.WIDTH, and updated all test files with explicit worldSize parameter. Added 3 new test cases verifying behavior with different world sizes (1000×1000, 5000×5000) and toroidal wrapping.

**Files Modified/Created**:
- `src/lib/client/game/InterceptCalculator.ts` - Updated method signature to accept worldSize parameter, removed unused World import, updated implementation to use parameter instead of World.WIDTH
- `src/lib/client/game/Game.ts` - Updated call site to pass World.WIDTH as third parameter
- `src/__tests__/lib/InterceptCalculator.test.ts` - Updated all 21 existing test calls to pass 500 as worldSize, added 3 new test cases for different world sizes (1000×1000, 5000×5000, toroidal wrapping with 1000×1000)
- `src/__tests__/lib/intercept-calculator-world-integration.test.ts` - Updated all 6 test calls to pass World.WIDTH as third parameter, maintaining maxSpeed as fourth parameter where applicable

**Deviations from Plan**: 
- InterceptionLineRenderer.ts did not require changes (no call sites found in that file)
- Removed unused World import from InterceptCalculator.ts (improved code quality, eliminated lint warning)

**Test Results**: All 562 tests passing (24 total tests for InterceptCalculator: 21 existing + 3 new varied world size tests)

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Date**: 2026-02-11
**Review Notes**: 
- Implementation meets all requirements for Tasks 7.1-7.3
- Method signature refactored correctly with worldSize parameter
- All 2 call sites updated (Game.ts; InterceptionLineRenderer.ts had no call sites)
- All 27 test calls updated (21 existing + 6 integration)
- Added 3 new tests for varied world sizes (1000×1000, 5000×5000, toroidal wrapping)
- Removed unused World import (code quality improvement)
- All 562 tests passing, lint and typecheck clean
- No code duplications found
- Proper TypeScript strict mode compliance
- ES Modules usage correct throughout

#### Task 7.4: Update physics.test.ts

**Action**: Consider importing shared constants or keeping test-specific values with a note that tests use fixed values for reproducibility.

**Files**:

- `src/__tests__/shared/physics.test.ts` - Update `WORLD_BOUNDS` constant or add comment

**Notes**: Tests can keep their own fixed values for reproducibility, but the values should be documented.

**Status**: ✅ COMPLETED
**Implementation Summary**: Added documentation comment explaining that tests use fixed 500x500 values for reproducibility and stability, noting these match DEFAULT_WORLD_BOUNDS from shared constants.
**Files Modified/Created**:
- `src/__tests__/shared/physics.test.ts` - Added comment explaining fixed values for test reproducibility
**Deviations from Plan**: None - chose to document fixed values rather than import shared constants, which is appropriate for test stability.
**Test Results**: All 562 tests passing

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Date**: 2026-02-11
**Review Notes**: Documentation approach is appropriate for physics tests that rely on specific expected values. Comment clearly explains the relationship between fixed test values and shared constants, and notes the future change to 5000×5000.

#### Task 7.5: Update worldCache.test.ts

**Action**: Import shared constants for world size in test setup.

**Files**:

- `src/__tests__/lib/worldCache.test.ts` - Import and use shared constants in `createWorld` function

**Status**: ✅ COMPLETED
**Implementation Summary**: Imported DEFAULT_WORLD_WIDTH and DEFAULT_WORLD_HEIGHT from @shared/worldConstants and updated the createWorld helper function to use these constants instead of hardcoded 500x500 values.
**Files Modified/Created**:
- `src/__tests__/lib/worldCache.test.ts` - Imported shared constants and updated createWorld function
**Deviations from Plan**: None - implementation exactly as specified.
**Test Results**: All 562 tests passing

**Review Status**: ✅ APPROVED
**Reviewer**: Medicus
**Review Date**: 2026-02-11
**Review Notes**: Import approach is appropriate for test helper that creates mock World instances. Ensures test mocks stay synchronized with production default values. Import path verified correct (@shared/worldConstants). Only server-side World instantiation in test suite (verified).

---

### Goal 8: Update World Size Value to 5000×5000

**Description**: Change the actual world size constant value from 500 to 5000.

**Quality Requirements**: All previous tasks must be complete before this change.

#### Task 8.1: Update Shared Constants Value

**Action**: Set `DEFAULT_WORLD_WIDTH` and `DEFAULT_WORLD_HEIGHT` to 5000 in the shared constants file.

**Files**:

- `src/shared/src/worldConstants.ts` - Set values to 5000

---

### Goal 9: Validation and Testing

**Description**: Verify the changes work correctly by running tests and checking for errors.

#### Task 9.1: Run Linting

**Action**: Run `npm run lint` to check for TypeScript and ESLint errors.

#### Task 9.2: Run Type Checking

**Action**: Run `npm run build` or `tsc --noEmit` to verify all types compile correctly.

#### Task 9.3: Run Unit Tests

**Action**: Run `npm test` to verify all tests pass with the new world size.

## Dependencies

- No new npm packages required

## Arc42 Documentation Updates

**Proposed Changes**: None - this is a configuration/constant change, not an architectural change.

## Architecture Notes

- The world size is used in multiple contexts:
  1. **Server-side physics**: Position updates, toroidal wrapping in `src/shared/src/physics.ts`
  2. **Client-side rendering**: World dimensions in `src/lib/client/game/World.ts`
  3. **Interception calculations**: Toroidal distance calculations in `InterceptCalculator` - now accepts world size as parameter for flexibility
  4. **Battle system**: Teleportation positions in `battleService.ts`
  5. **Database loading**: World initialization in `worldRepo.ts`
  6. **Seed data**: Default object positions in `seedData.ts`

- The existing `wrapPosition` method in client World class and the toroidal wrapping in `updateObjectPosition` already handle the position normalization correctly using modulo arithmetic. The new `normalizePosition` function provides a standalone utility for use when loading data.

- The client World class receives world size from the server via `updateFromServerData`, which updates `World.WIDTH` and `World.HEIGHT` static properties. This ensures consistency between client and server.

- **InterceptCalculator Refactoring**: The `calculateInterceptAngle` method has been refactored to accept world size as an explicit parameter instead of reading from `World.WIDTH`. This makes the function more testable, allows tests to verify behavior with various world sizes, and removes the implicit dependency on the World class static property. Call sites pass `World.WIDTH` to maintain existing behavior while making the dependency explicit.

## Agent Decisions

1. **Shared module location**: Chose to place world constants in `src/shared/src/worldConstants.ts` rather than in a server-only location, because both client and server need access to these values.

2. **Normalization approach**: The existing physics module already does toroidal wrapping in `updateObjectPosition`. A new `normalizePosition` function provides a cleaner API for one-time normalization (e.g., when loading data from database).

3. **Battle arena size**: Per user input, the battle arena should use the same world size as the main game (5000×5000), not a separate constant.

4. **Test file strategy**: Tests can keep their own fixed world bounds values for reproducibility, but the `createWorld` helper in test files should use imported shared constants to match production behavior.

5. **Position normalization location**: Applied normalization at data load boundaries (database loading, server data updates) rather than at every calculation point, as the existing physics calculations already handle wrapping correctly.

6. **InterceptCalculator parameter design** (per human review feedback): The InterceptCalculator should accept world size as an explicit parameter rather than reading from `World.WIDTH` static property. This improves testability by allowing tests to verify behavior with various world sizes (e.g., 500×500, 1000×1000, 5000×5000) and removes implicit dependencies. Call sites will pass `World.WIDTH` to maintain existing behavior. Tests will use 500×500 for existing scenarios to maintain test validity, with additional test cases for other world sizes.

## Summary of Files to Modify

| File                                                          | Change Type | Description                                         |
| ------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `src/shared/src/worldConstants.ts`                            | Create      | New shared world constants                          |
| `src/shared/src/index.ts`                                     | Modify      | Export world constants                              |
| `src/shared/src/physics.ts`                                   | Modify      | Add `normalizePosition` function                    |
| `src/lib/server/constants.ts`                                 | Modify      | Import shared constants, calculate center           |
| `src/lib/server/world/worldRepo.ts`                           | Modify      | Use shared constants, apply normalization           |
| `src/lib/server/world/world.ts`                               | Modify      | Use shared constants in `createDefault`             |
| `src/lib/server/battle/battleService.ts`                      | Modify      | Use shared constants                                |
| `src/lib/server/seedData.ts`                                  | Modify      | Update positions for larger world                   |
| `src/lib/client/game/World.ts`                                | Modify      | Use shared constants as defaults, add normalization |
| `src/lib/client/game/InterceptCalculator.ts`                  | Modify      | Accept worldSize parameter instead of reading World.WIDTH |
| `src/lib/client/game/Game.ts`                                 | Modify      | Pass World.WIDTH to InterceptCalculator calls       |
| `src/lib/client/renderers/InterceptionLineRenderer.ts`        | Modify      | Pass World.WIDTH to InterceptCalculator calls       |
| `src/__tests__/shared/physics.test.ts`                        | Modify      | Add normalizePosition tests                         |
| `src/__tests__/lib/InterceptCalculator.test.ts`               | Modify      | Pass worldSize parameter (500 for existing, add varied sizes) |
| `src/__tests__/lib/intercept-calculator-world-integration.test.ts` | Modify | Pass worldSize parameter to test calls              |
| `src/__tests__/lib/worldCache.test.ts`                        | Modify      | Use shared constants                                |

## Open Questions

_No open questions - ready for implementation._
