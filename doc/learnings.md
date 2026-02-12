# Project Learnings

## Database Setup for Tests

### Issue Discovered (2026-02-10)

Tests require PostgreSQL databases to be running and the `POSTGRES_TEST_PORT` environment variable to be set to `5433`.

### Solution

1. Start both databases: `docker compose up db db-test -d`
2. Export the test port: `export POSTGRES_TEST_PORT=5433`
3. Run tests: `npm run test:ci`
