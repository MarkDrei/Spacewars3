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
