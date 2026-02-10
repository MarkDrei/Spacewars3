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

#### Task 2.2: Update worldRepo.ts

**Action**: Replace hardcoded `{ width: 500, height: 500 }` with imported shared constants.

**Files**:

- `src/lib/server/world/worldRepo.ts` - Import and use shared world size constants (line ~50)

#### Task 2.3: Update world.ts createDefault Method

**Action**: Replace hardcoded `{ width: 500, height: 500 }` in `World.createDefault()` with imported shared constants.

**Files**:

- `src/lib/server/world/world.ts` - Import and use shared world size constants (line ~194)

#### Task 2.4: Update battleService.ts

**Action**: Replace hardcoded `WORLD_WIDTH = 3000` and `WORLD_HEIGHT = 3000` with imports from shared constants.

**Files**:

- `src/lib/server/battle/battleService.ts` - Import shared constants (lines 44-45)

---

### Goal 3: Update Client-Side World Size References

**Description**: Update the client-side World class to use shared constants for its static defaults.

#### Task 3.1: Update Client World Class Defaults

**Action**: Import shared constants and use them as default values for `World.WIDTH` and `World.HEIGHT` static properties.

**Files**:

- `src/lib/client/game/World.ts` - Import shared constants and set defaults (lines 16-18)

#### Task 3.2: Verify InterceptCalculator Uses World Instance

**Action**: Verify `InterceptCalculator` gets world size from `World.WIDTH`/`World.HEIGHT` static properties (which are updated from server data). Currently uses `World.WIDTH` at line 40.

**Files**:

- `src/lib/client/game/InterceptCalculator.ts` - Verify (no change expected, uses `World.WIDTH`)

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

---

### Goal 5: Apply Position Normalization in Data Load Paths

**Description**: Ensure positions loaded from the database or received from external sources are normalized before use.

#### Task 5.1: Normalize Positions When Loading World from Database

**Action**: Apply `normalizePosition` to all space objects loaded from the database in `loadWorldFromDb`.

**Files**:

- `src/lib/server/world/worldRepo.ts` - Import and apply `normalizePosition` when mapping database rows

#### Task 5.2: Normalize Positions in Client World Update

**Action**: Apply position normalization when updating world data from server in the client `World` class.

**Files**:

- `src/lib/client/game/World.ts` - Apply normalization in `updateFromServerData` method

---

### Goal 6: Update Seed Data for Larger World

**Description**: Update seed data positions and comments to reflect the new 5000×5000 world size. Spread objects more evenly across the larger world.

#### Task 6.1: Update DEFAULT_SPACE_OBJECTS Positions

**Action**: Update the hardcoded positions in `DEFAULT_SPACE_OBJECTS` to spread across the 5000×5000 world instead of the 500×500 world.

**Files**:

- `src/lib/server/seedData.ts` - Update space object coordinates (lines ~351-365)

**Details**: Multiply existing coordinates by 10 to scale appropriately, or choose new representative positions.

#### Task 6.2: Update Seed Data Comments

**Action**: Update comments referencing "500x500 world" to "5000x5000 world".

**Files**:

- `src/lib/server/seedData.ts` - Update comments (lines ~498-500, ~85)

#### Task 6.3: Update User Ship Starting Positions

**Action**: Update user ship positions in `DEFAULT_USERS` to use the world center (2500, 2500) instead of (250, 250).

**Files**:

- `src/lib/server/seedData.ts` - Update ship positions in DEFAULT_USERS

---

### Goal 7: Update Test Files

**Description**: Update test files that use hardcoded world size values to use shared constants or appropriate test values.

#### Task 7.1: Update physics.test.ts

**Action**: Consider importing shared constants or keeping test-specific values with a note that tests use fixed values for reproducibility.

**Files**:

- `src/__tests__/shared/physics.test.ts` - Update `WORLD_BOUNDS` constant or add comment

**Notes**: Tests can keep their own fixed values for reproducibility, but the values should be documented.

#### Task 7.2: Update worldCache.test.ts

**Action**: Import shared constants for world size in test setup.

**Files**:

- `src/__tests__/lib/worldCache.test.ts` - Import and use shared constants in `createWorld` function

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
  3. **Interception calculations**: Toroidal distance calculations in `InterceptCalculator`
  4. **Battle system**: Teleportation positions in `battleService.ts`
  5. **Database loading**: World initialization in `worldRepo.ts`
  6. **Seed data**: Default object positions in `seedData.ts`

- The existing `wrapPosition` method in client World class and the toroidal wrapping in `updateObjectPosition` already handle the position normalization correctly using modulo arithmetic. The new `normalizePosition` function provides a standalone utility for use when loading data.

- The client World class receives world size from the server via `updateFromServerData`, which updates `World.WIDTH` and `World.HEIGHT` static properties. This ensures consistency between client and server.

## Agent Decisions

1. **Shared module location**: Chose to place world constants in `src/shared/src/worldConstants.ts` rather than in a server-only location, because both client and server need access to these values.

2. **Normalization approach**: The existing physics module already does toroidal wrapping in `updateObjectPosition`. A new `normalizePosition` function provides a cleaner API for one-time normalization (e.g., when loading data from database).

3. **Battle arena size**: Per user input, the battle arena should use the same world size as the main game (5000×5000), not a separate constant.

4. **Test file strategy**: Tests can keep their own fixed world bounds values for reproducibility, but the `createWorld` helper in test files should use imported shared constants to match production behavior.

5. **Position normalization location**: Applied normalization at data load boundaries (database loading, server data updates) rather than at every calculation point, as the existing physics calculations already handle wrapping correctly.

## Summary of Files to Modify

| File                                     | Change Type | Description                                         |
| ---------------------------------------- | ----------- | --------------------------------------------------- |
| `src/shared/src/worldConstants.ts`       | Create      | New shared world constants                          |
| `src/shared/src/index.ts`                | Modify      | Export world constants                              |
| `src/shared/src/physics.ts`              | Modify      | Add `normalizePosition` function                    |
| `src/lib/server/constants.ts`            | Modify      | Import shared constants, calculate center           |
| `src/lib/server/world/worldRepo.ts`      | Modify      | Use shared constants, apply normalization           |
| `src/lib/server/world/world.ts`          | Modify      | Use shared constants in `createDefault`             |
| `src/lib/server/battle/battleService.ts` | Modify      | Use shared constants                                |
| `src/lib/server/seedData.ts`             | Modify      | Update positions for larger world                   |
| `src/lib/client/game/World.ts`           | Modify      | Use shared constants as defaults, add normalization |
| `src/__tests__/shared/physics.test.ts`   | Modify      | Add normalizePosition tests                         |
| `src/__tests__/lib/worldCache.test.ts`   | Modify      | Use shared constants                                |

## Open Questions

_No open questions - ready for implementation._
