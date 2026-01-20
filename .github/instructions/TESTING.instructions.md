---
applyTo: "src/__tests__/**"
---

## Test Isolation Strategy

**Goal:** All integration tests use transaction-based isolation for perfect test independence and reproducibility.

### Transaction Wrapper

- **Every integration test** must wrap its body with `await withTransaction(async () => { ... })`
- Import from: `import { withTransaction } from '../helpers/transactionHelper';`
- Automatic ROLLBACK after test completion ensures zero data pollution
- Enables future parallel test execution

### Example

```typescript
import { withTransaction } from "../helpers/transactionHelper";

it("myTest_scenario_expectedOutcome", async () => {
  await withTransaction(async () => {
    // All test code here
    // Database changes automatically rolled back
  });
});
```

### Why Transactions?

- **Perfect Isolation:** Each test starts with clean database state
- **No Manual Cleanup:** No need for DELETE/UPDATE queries in test helpers
- **Deterministic:** Tests always see the same initial data (from seedData)
- **Parallel Ready:** Transaction isolation enables safe parallel execution
- **Catches Bugs:** Exposes issues with background persistence escaping transaction scope

### Background Persistence

- Disabled in test mode (`NODE_ENV === 'test'`)
- Cache mutations trigger immediate synchronous persistence instead
- This ensures all database writes happen within the transaction boundary

## Integration Test Bootstrapping

- Prefer using the shared helper `initializeIntegrationTestServer()` from `src/__tests__/helpers/testServer.ts` for any integration-style test.
- This helper calls `resetTestDatabase()` (from `src/lib/server/database.ts`) to ensure a clean PostgreSQL test database, resets all cache singletons, and then runs `initializeServer()` so caches are wired exactly as production code expects.
- Pair every call to the initializer with `shutdownIntegrationTestServer()` in `afterEach`/`afterAll` hooks to flush dirty data, stop background persistence, and reset singletons for the next test.

## PostgreSQL Test Database Behavior

- `getDatabase()` automatically connects to a PostgreSQL test database whenever `NODE_ENV === 'test'`. The database is configured via environment variables (POSTGRES_TEST_DB defaults to 'spacewars_test').
- `resetTestDatabase()` drops all tables and recreates them with seed data, providing a clean state for each test run.
- Avoid manual calls to `createTestDatabase()` for integration tests; rely on `main.initializeServer()` + the test DB to keep schema/seed logic in sync with production.
- For unit tests that truly need isolated DB control, import from `src/__tests__/helpers/testDatabase.ts`, but document the reason in the test to avoid divergence from the standard flow.

## Cache Expectations

- When using the integration helper, do **not** manually call `BattleCache.initialize`, `UserWorldCache.initialize`, `WorldCache.initializeWithWorld`, etc.—they are already initialized via `main.initializeServer()`.
- If a test requires mocking a cache, call the relevant `configureDependencies` (e.g., `BattleCache.configureDependencies`) **before** `initializeIntegrationTestServer()` so the custom wiring is in place for startup.

# Testing Commands

## Avoid Interactive Test Commands

- **NEVER** use commands that require manual input (like pressing 'q' to quit). These will hang in automated environments.
- If a command mentions "watch", "ui", or "interactive" → **DON'T USE IT**

## ✅ Safe Commands to USE

- `npm test`
- `npx vitest run`
