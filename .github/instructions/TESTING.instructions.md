---
applyTo: "src/__tests__/**"
---

## Integration Test Bootstrapping
- Prefer using the shared helper `initializeIntegrationTestServer()` from `src/__tests__/helpers/testServer.ts` for any integration-style test.
- This helper calls `resetTestDatabase()` (from `src/lib/server/database.ts`) to ensure a clean in-memory SQLite database, resets all cache singletons, and then runs `initializeServer()` so caches are wired exactly as production code expects.
- Pair every call to the initializer with `shutdownIntegrationTestServer()` in `afterEach`/`afterAll` hooks to flush dirty data, stop background persistence, and reset singletons for the next test.

## In-Memory Database Behavior
- `getDatabase()` automatically returns an in-memory SQLite database whenever `NODE_ENV === 'test'`. The helper `initializeTestDatabase()` creates tables, seeds default users/space objects, and mirrors production defaults so tests rely on realistic data.
- Avoid manual calls to `createTestDatabase()` for integration tests; rely on `main.initializeServer()` + the in-memory DB to keep schema/seed logic in sync with production.
- For unit tests that truly need isolated DB control, import from `src/__tests__/helpers/testDatabase.ts`, but document the reason in the test to avoid divergence from the standard flow.

## Cache Expectations
- When using the integration helper, do **not** manually call `BattleCache.initialize`, `UserWorldCache.initialize`, `WorldCache.initializeWithWorld`, etc.—they are already initialized via `main.initializeServer()`.
- If a test requires mocking a cache, call the relevant `configureDependencies` (e.g., `BattleCache.configureDependencies`) **before** `initializeIntegrationTestServer()` so the custom wiring is in place for startup.

# Testing Commands

##  Avoid Interactive Test Commands
- **NEVER** use commands that require manual input (like pressing 'q' to quit). These will hang in automated environments.
- If a command mentions "watch", "ui", or "interactive" → **DON'T USE IT**

## ✅ Safe Commands to USE
- `npm test` 
- `npx vitest run` 