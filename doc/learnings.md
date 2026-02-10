# Project Learnings

## Database Setup for Tests

### Issue Discovered (2026-02-10)
Tests require PostgreSQL databases to be running and the `POSTGRES_TEST_PORT` environment variable to be set to `5433`.

### Solution
1. Start both databases: `docker compose up db db-test -d`
2. Export the test port: `export POSTGRES_TEST_PORT=5433`
3. Run tests: `npm run test:ci`

### Note
- The `package.json` script `test:local` uses the old `docker-compose` command (with hyphen)
- The system uses `docker compose` (space) instead
- All 60 test files with 477 tests pass when databases are configured correctly

### Commands That Work
```bash
# Start databases
docker compose up db db-test -d

# Wait for healthy status
docker compose ps

# Run tests (with correct env var)
export POSTGRES_TEST_PORT=5433
npm run test:ci

# Full CI pipeline (requires manual database start)
npm run lint && npm run typecheck && export POSTGRES_TEST_PORT=5433 && npm run test:ci && npm run build
```

## Development Plan Validation (2026-02-10)

### Navigator Phase Completion
The development plan for world size expansion (500×500 → 5000×5000) has been validated and confirmed ready for implementation:

- **Codebase Status**: All 477 tests passing, lint and typecheck clean
- **Plan Completeness**: All tasks clearly defined with inputs/outputs
- **Open Questions**: None - all resolved
- **Arc42 Updates**: None required (configuration change only)
- **Human Review**: Plan approved and confirmed

### Key Plan Characteristics
- 9 goals with 20+ actionable tasks
- Centralized constants approach using shared module
- Position normalization at data load boundaries
- Comprehensive test coverage required
- Sequential implementation order maintained

## Shared Module Conventions (2026-02-10)

### Implementation Patterns Discovered
When adding new constants to the shared module:

1. **Naming Convention**: Use `DEFAULT_[CONSTANT_NAME]` for exported constants (e.g., `DEFAULT_WORLD_WIDTH`, `DEFAULT_WORLD_HEIGHT`)
2. **Type Reuse**: Leverage existing interfaces from `physics.ts` (e.g., `WorldBounds`) rather than creating duplicates
3. **Barrel Exports**: Always add new modules to `src/shared/src/index.ts` using `export * from './moduleName'`
4. **Module Organization**: Create dedicated files for related constants (e.g., `worldConstants.ts` for world-related values)
5. **Documentation**: Add brief JSDoc comments explaining purpose and noting any planned changes
6. **Test Coverage**: Place comprehensive tests in `src/__tests__/shared/[moduleName].test.ts` following the naming convention `whatIsTested_scenario_expectedOutcome`

### Test Structure Pattern
- Tests verify type safety, value consistency, and structural correctness
- Tests document expected values (e.g., "Starting value is 500, will be updated to 5000 in Goal 8")
- Tests check both individual constants and derived objects
- Consistency tests ensure related values remain synchronized

## Code Review Insights (2026-02-10)

### Tasks 1.1 and 1.2 Review
- **Implementation Quality**: Clean, well-documented code following TypeScript best practices
- **Test Coverage**: 14 comprehensive tests covering all aspects of worldConstants module
- **Naming Consistency**: Proper use of DEFAULT_ prefix for constants
- **Type Safety**: Leverages existing WorldBounds interface from physics.ts
- **Module Integration**: Proper barrel export pattern in shared module index
- **ES Modules**: Clean use of import/export, no CommonJS detected

### Known Code Duplications (To Be Addressed in Later Tasks)
The following world size constant duplications exist in the codebase and are intentional at this stage:
1. `src/shared/src/worldConstants.ts` - NEW centralized constants (500x500)
2. ~~`src/lib/server/constants.ts` - Lines 12-13 (500x500)~~ - ✅ RESOLVED in Task 2.1
3. ~~`src/lib/server/battle/battleService.ts` - Lines 44-45 (3000x3000)~~ - ✅ RESOLVED in Task 2.4
4. ~~`src/lib/client/game/World.ts` - Lines 17-18 (500x500)~~ - ✅ RESOLVED in Task 3.1
5. ~~`src/lib/server/world/worldRepo.ts` - Line 50 hardcoded value~~ - ✅ RESOLVED in Task 2.2
6. ~~`src/lib/server/world/world.ts` - Line 194 hardcoded value~~ - ✅ RESOLVED in Task 2.3

Tasks 2.1-2.4 completed: All server-side duplications eliminated.
Tasks 3.1-3.2 completed: All client-side duplications eliminated. All world size references now use shared constants.

## Server-Side Constants Refactoring (2026-02-10)

### Goal 2 Implementation Complete
All server-side world size constants now reference the centralized shared module:

1. **Import Pattern**: Server files use `@shared/worldConstants` for importing `DEFAULT_WORLD_WIDTH`, `DEFAULT_WORLD_HEIGHT`, and `DEFAULT_WORLD_BOUNDS`
2. **World Object Structure**: The `World` class uses `worldSize` property (not `bounds`) with shape `{ width: number; height: number }`
3. **Ship Starting Position**: Calculated dynamically as `DEFAULT_WORLD_WIDTH / 2` and `DEFAULT_WORLD_HEIGHT / 2` in `src/lib/server/constants.ts`
4. **Battle Arena**: Changed from hardcoded 3000x3000 to using shared 500x500 constants (will scale to 5000x5000 in Goal 8)

### Testing Patterns for Constant Refactoring
- Create focused test files for each logical group (server-constants, world-initialization, battle-world-constants)
- Verify imports work correctly by checking equality with shared constants
- Document current values in tests (e.g., "500x500 before increase to 5000x5000")
- Use real database for integration tests but avoid cleanup complexity
- Test both static creation (`World.createDefault()`) and database loading (`loadWorldFromDb()`)

### Battle Service World Size Discovery
The `battleService.ts` originally used `WORLD_WIDTH = 3000` and `WORLD_HEIGHT = 3000`, which was inconsistent with the main world size of 500x500. This has been corrected to use the shared constants (currently 500x500, will be 5000x5000 after Goal 8).

## Code Review Best Practices (2026-02-10)

### Medicus Review - Goal 2 Complete
Conducted comprehensive review of Tasks 2.1-2.4:

**Review Process Checklist**:
1. ✅ Read development plan and understand task requirements
2. ✅ Review code changes via git diff
3. ✅ Check for code duplications (grep searches for patterns)
4. ✅ Verify lock usage (IronGuard TypeScript Locks)
5. ✅ Review test files for quality and coverage
6. ✅ Run tests to verify passing (507 tests passing)
7. ✅ Run linting (passed with warnings only)
8. ✅ Run typecheck (passed, build failed due to network issues with Google Fonts)
9. ✅ Update development plan with review status
10. ✅ Update learnings with insights

**Key Findings**:
- All 16 new tests are meaningful and comprehensive
- No code duplication detected in server-side code
- Proper use of IronGuard TypeScript Locks in battleService.ts
- TypeScript strict mode compliance verified
- ES Modules usage correct throughout
- Test naming follows convention: `whatIsTested_scenario_expectedOutcome`

**Test Quality Indicators**:
- Tests verify both happy path and edge cases
- Tests document current values with comments about future changes
- Tests use real database connections with proper setup/teardown
- Test assertions are specific and meaningful
- Tests cover both static creation and database loading paths

**Network Build Issue**:
- `npm run build` fails due to inability to fetch Google Fonts (network isolation)
- `npm run typecheck` succeeds, confirming TypeScript compilation is clean
- This is expected in CI/test environments without internet access

## Client-Side Constants Refactoring (2026-02-10)

### Goal 3 Implementation Complete
All client-side world size constants now reference the centralized shared module:

1. **Import Pattern**: Client files use `@shared/worldConstants` for importing `DEFAULT_WORLD_WIDTH` and `DEFAULT_WORLD_HEIGHT`
2. **Static Property Pattern**: World class static properties (`World.WIDTH`, `World.HEIGHT`) are initialized from shared constants but remain mutable
3. **Server Override**: The `updateFromServerData()` method updates static properties with actual world dimensions from the server
4. **Singleton Pattern**: World class uses static properties that are shared across all instances and updated once from server

### Client-Side Testing Patterns for Shared Constants
- Test both static initialization (from shared constants) and dynamic updates (from server data)
- Verify instance methods (`getWidth()`, `getHeight()`) return values from static properties
- Test wrapping behavior with both default and custom world dimensions
- Test edge cases: positions at boundaries, negative positions, very large positions
- Document that tests verify current 500x500 values that will become 5000x5000 in Goal 8
- Use proper TypeScript types for test data (include all required properties like `currentTime`, `value`)

### InterceptCalculator Integration
- InterceptCalculator reads `World.WIDTH` directly for toroidal wrapping calculations
- No changes needed - already correctly uses static properties
- Integration tests verify correct behavior with world wrapping, dynamic resizing, and edge cases
- Important: InterceptCalculator adapts automatically when World.WIDTH/HEIGHT change (e.g., after server update)

### Key Architectural Insight
The client-side World class uses a **mutable static properties** pattern:
- Properties are initialized with sensible defaults (from shared constants)
- Server provides actual world dimensions on first update
- All client code reads from these static properties
- This ensures consistency across all renderers, calculators, and game logic

## Code Review Best Practices - Goal 3 (2026-02-10)

### Medicus Review - Goal 3 Complete
Conducted comprehensive review of Tasks 3.1-3.2:

**Review Process Checklist**:
1. ✅ Read development plan and understand task requirements
2. ✅ Review code changes via git diff (only World.ts modified, tests added)
3. ✅ Check for code duplications (no hardcoded 500 values found in src/)
4. ✅ Verify lock usage (not applicable for client-side code)
5. ✅ Review test files for quality and coverage (17 new tests, well-structured)
6. ✅ Run tests to verify passing (524 tests passing)
7. ✅ Run linting (passed with warnings only)
8. ✅ Run typecheck (passed - TypeScript compilation clean)
9. ✅ Update development plan with review status
10. ✅ Update learnings with insights

**Key Findings**:
- All 17 new tests are meaningful and comprehensive
- No code duplication detected in client-side code
- Lock usage not applicable (client-side code doesn't need locks)
- TypeScript strict mode compliance verified
- ES Modules usage correct throughout
- Test naming follows convention: `whatIsTested_scenario_expectedOutcome`
- InterceptCalculator already correctly implemented (verification only)

**Test Quality Indicators**:
- Tests verify both static initialization and dynamic server updates
- Tests cover instance methods (getWidth, getHeight)
- Tests cover wrapping behavior with edge cases (boundaries, negatives, large values)
- Tests document current 500x500 values with comments about future 5000x5000
- Integration tests verify InterceptCalculator adapts to World dimension changes
- Tests properly reset static properties in beforeEach hooks

**Code Quality Observations**:
- Clean import of shared constants at top of file
- Good comments explaining static properties are "initialized from shared constants, updated by server data"
- Proper TypeScript typing throughout
- updateFromServerData() method correctly updates static properties (lines 114-115)
- InterceptCalculator uses World.WIDTH at line 40 for wrapping (no changes needed)

## Position Normalization Implementation (2026-02-10)

### Goal 4 Implementation Complete (Tasks 4.1 & 4.2)
Created `normalizePosition` function in shared physics module with comprehensive test coverage.

**Implementation Patterns Discovered**:
1. **Modulo Arithmetic Pattern**: The proven formula `((value % bound) + bound) % bound` correctly handles all cases:
   - Positive values within bounds → unchanged
   - Values at/beyond boundary → wrap to valid range
   - Negative values → wrap to opposite side
   - Very large values → multiple wraps handled correctly
   
2. **Consistent with Existing Code**: The normalizePosition function reuses the same modulo pattern already used in:
   - `updateObjectPosition` (lines 42-43)
   - `updateObjectPositionWithTimeCorrection` (lines 79-80)
   - Client-side `World.wrapPosition` (though with slightly different syntax)

3. **Function Documentation**: Added JSDoc comments with:
   - Purpose description
   - @param tags for each parameter
   - @returns tag describing output range `[0, worldBounds.width)` and `[0, worldBounds.height)`

**Test Coverage Strategy**:
- 12 comprehensive test cases covering all edge cases
- Test naming follows convention: `normalizePosition_scenario_expectedOutcome`
- Edge cases tested:
  - Within bounds (unchanged)
  - At origin (0,0)
  - At boundary (wraps to 0)
  - Slightly over boundary with floating point
  - Negative positions
  - Very large negative positions (multiples and non-multiples)
  - Very large positive positions (multiples and non-multiples)
  - Floating point precision
  - Custom world bounds (1000x2000)
  - Future world size (5000x5000)

**Key Insights**:
- No error handling needed - modulo arithmetic works for all numeric inputs
- No validation errors thrown (consistent with other physics functions)
- Using `const` instead of `let` for variables that aren't reassigned
- Function is pure - no side effects, no state, no logging
- Return type `{ x: number; y: number }` matches existing patterns

**Integration Points Identified**:
- Will be used in Task 5.1: `worldRepo.ts` `loadWorldFromDb()` to normalize positions loaded from database
- Will be used in Task 5.2: Client `World.ts` `updateFromServerData()` to normalize positions from server

**Test Results**: All 536 tests passing (38 in physics.test.ts, 12 new for normalizePosition)

## Code Review Best Practices - Goal 4 (2026-02-10)

### Medicus Review - Goal 4 Complete
Conducted comprehensive review of Tasks 4.1-4.2:

**Review Process Checklist**:
1. ✅ Read development plan and understand task requirements
2. ✅ Review code changes via git diff
3. ✅ Check for code duplications (grep searches confirmed no duplicates)
4. ✅ Verify lock usage (not applicable - pure function)
5. ✅ Review test files for quality and coverage (12 tests, excellent coverage)
6. ✅ Run tests to verify passing (536 tests passing)
7. ✅ Run linting (passed with warnings only)
8. ✅ Run typecheck (passed - TypeScript compilation clean)
9. ✅ Update development plan with review status
10. ✅ Update learnings with insights

**Key Findings**:
- All 12 new tests are meaningful and exceed plan requirements (5 edge cases → 12 tests)
- No code duplication - normalizePosition uses same pattern as existing physics functions
- Modulo arithmetic pattern `((value % bound) + bound) % bound` is proven and consistent
- Client-side `wrapPosition` uses equivalent but different syntax (pre-existing, acceptable)
- Lock usage not applicable (pure function, no state, no async)
- TypeScript strict mode compliance verified
- ES Modules usage correct throughout
- Test naming follows convention: `normalizePosition_scenario_expectedOutcome`

**Test Quality Indicators**:
- Tests exceed plan requirements (12 vs 5 requested edge cases)
- Tests cover comprehensive scenarios: within bounds, at origin, at boundary, slightly over, negative, very negative (multiples and non-multiples), very large (multiples and non-multiples), floating point, custom bounds, future 5000x5000 world
- Each test includes clear comments explaining the wrapping calculation
- Tests use both exact equality and floating-point tolerance appropriately
- Tests verify future-proofing (5000x5000 world size)

**Code Quality Observations**:
- Clean JSDoc documentation with @param and @returns tags
- Return type clearly specified: `[0, worldBounds.width)` and `[0, worldBounds.height)`
- Used `const` instead of `let` (ES6 best practices)
- Pure function - no side effects, no state, no logging
- Return type `{ x: number; y: number }` matches existing physics function patterns
- Implementation correctly changed from plan's `let` to `const` (deviation noted in plan)

**Pattern Consistency Check**:
Verified the modulo wrapping pattern is used consistently across codebase:
- `src/shared/src/physics.ts` line 42-43: `updateObjectPosition` uses same pattern
- `src/shared/src/physics.ts` line 79-80: `updateObjectPositionWithTimeCorrection` uses same pattern  
- `src/shared/src/physics.ts` line 189-190: New `normalizePosition` uses same pattern
- `src/lib/client/game/World.ts` line 90-95: `wrapPosition` uses equivalent but different syntax (if statement instead of double modulo)

**Client vs Server Wrapping Comparison**:
- **Server-side**: `((x % width) + width) % width` - Double modulo pattern (compact, mathematical)
- **Client-side**: `x % width; if (x < 0) x += width` - Conditional pattern (more verbose but equivalent)
- Both approaches are correct and produce identical results
- Client-side pattern is pre-existing and not in scope for this task
- No need to unify patterns - both work correctly
