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
2. `src/lib/server/constants.ts` - Lines 12-13 (500x500) - Will be updated in Task 2.1
3. `src/lib/server/battle/battleService.ts` - Lines 44-45 (3000x3000) - Will be updated in Task 2.4
4. `src/lib/client/game/World.ts` - Lines 17-18 (500x500) - Will be updated in Task 3.1
5. `src/lib/server/world/worldRepo.ts` - Line 50 hardcoded value - Will be updated in Task 2.2
6. `src/lib/server/world/world.ts` - Line 194 hardcoded value - Will be updated in Task 2.3

These duplications are expected and addressed in the subsequent tasks (Goals 2 and 3 of the development plan).
