# TODO: Implement Transaction-Based Test Isolation

**Status:** Planning  
**Goal:** Re-enable parallel test execution by implementing transaction-based test isolation

## Context

### Why Parallel Tests Worked on Master

On the `master` branch, all tests ran in parallel successfully because:

- **SQLite `:memory:` databases**: Each test created a completely isolated in-memory database
- **Vitest worker isolation**: Each worker process had its own memory space with separate cache instances
- **No shared state**: Different workers couldn't interfere with each other

### Current Situation (PostgreSQL Migration)

After migrating to PostgreSQL:

- ✅ **Caches are NOT a problem** - Each Vitest worker has its own singleton instances (UserCache, BattleCache, MessageCache, WorldCache)
- ✅ **IronGuard is NOT a problem** - Lock system is per-worker, same as on master
- ❌ **Database IS the problem** - All workers share ONE PostgreSQL database (`spacewars_test`)

**Current workaround:** `singleThread: true` in vitest.config.ts forces sequential execution (~30 seconds for 402 tests)

### Vitest Worker Model

```
Worker 1: Test A → Test B → Test C  (sequential within worker)
Worker 2: Test D → Test E → Test F  (sequential within worker)
Worker 3: Test G → Test H → Test I  (sequential within worker)
         ↕        ↕        ↕
    (parallel between workers)
```

**Key insight:** Tests within a worker run sequentially, so caches/locks don't conflict. Only the shared database causes race conditions between different workers.

## Why This Is Simple (Not Complex!)

Initially thought transaction isolation would require:

- ❌ Rewriting all cache classes (WRONG - caches are per-worker isolated!)
- ❌ Refactoring IronGuard lock system (WRONG - locks are per-worker isolated!)
- ❌ Changing 200+ business logic functions (WRONG - they already use `getDatabase()`!)

**Reality:** Only need to make `getDatabase()` transaction-aware using Node.js AsyncLocalStorage!

## Implementation Plan

### Phase 1: Infrastructure Setup (Day 1)

#### Step 1.1: Add AsyncLocalStorage to database.ts

**File:** `src/lib/server/database.ts`

Add transaction context management:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";

// Add after pool declaration
const transactionStorage = new AsyncLocalStorage<PoolClient>();

export function getTransactionContext(): PoolClient | undefined {
  return transactionStorage.getStore();
}

export function setTransactionContext(client: PoolClient) {
  return transactionStorage.run(client, () => {});
}
```

Update `getDatabase()` function:

```typescript
export async function getDatabase(): Promise<Pool | PoolClient> {
  // In test environment, check for transaction context first
  if (process.env.NODE_ENV === "test") {
    const txContext = getTransactionContext();
    if (txContext) {
      return txContext; // Return transaction client instead of pool
    }
  }

  // Production and non-transaction tests use pool as before
  if (!pool) {
    pool = await initializeDatabase();
  }
  return pool;
}
```

**Why this works:**

- Production code: No transaction context → uses pool as before
- Test code: Transaction context exists → uses transaction client
- All existing business logic continues to work without changes!

#### Step 1.2: Create transaction test helper

**File:** `src/__tests__/helpers/transactionHelper.ts` (NEW FILE)

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { getDatabase } from "../../lib/server/database.js";
import type { Pool, PoolClient } from "pg";

const transactionStorage = new AsyncLocalStorage<PoolClient>();

/**
 * Wraps a test function in a database transaction that will be rolled back.
 * This allows parallel test execution without interference.
 */
export async function withTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const pool = (await getDatabase()) as Pool;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    return await transactionStorage.run(client, async () => {
      try {
        return await callback();
      } catch (error) {
        // Rollback happens in finally block
        throw error;
      }
    });
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error during transaction rollback:", rollbackError);
    }
    client.release();
  }
}

export function getTransactionContext(): PoolClient | undefined {
  return transactionStorage.getStore();
}
```

#### Step 1.3: Update database.ts to use transactionHelper

**File:** `src/lib/server/database.ts`

Update imports and getDatabase():

```typescript
import { getTransactionContext } from "../__tests__/helpers/transactionHelper.js";

export async function getDatabase(): Promise<Pool | PoolClient> {
  if (process.env.NODE_ENV === "test") {
    const txContext = getTransactionContext();
    if (txContext) {
      return txContext;
    }
  }

  if (!pool) {
    pool = await initializeDatabase();
  }
  return pool;
}
```

**Testing Step 1:**

- Run a single test file: `npm test -- user-stats-api.test.ts`
- Verify it still works with pool (no transaction context yet)

### Phase 2: Test Setup Integration (Day 2)

#### Step 2.1: Update global test setup

**File:** `src/__tests__/setup.ts`

Add transaction setup that wraps each test:

```typescript
import { beforeEach, afterEach } from "vitest";
import { withTransaction } from "./helpers/transactionHelper.js";

// Store the original test function
let currentTest: (() => Promise<void>) | null = null;

beforeEach(async (context) => {
  // Wrap test execution in transaction
  if (context.task.suite.name !== "setup") {
    const originalFn = context.task.fn;
    context.task.fn = async () => {
      await withTransaction(async () => {
        await originalFn();
      });
    };
  }
});
```

**Alternative approach (if global setup doesn't work):**

Create a test wrapper utility:

**File:** `src/__tests__/helpers/testWrapper.ts` (NEW FILE)

```typescript
import { describe as vitestDescribe, beforeEach, afterEach } from "vitest";
import { withTransaction } from "./transactionHelper.js";

export function describe(name: string, fn: () => void) {
  return vitestDescribe(name, () => {
    let testFn: (() => Promise<void>) | null = null;

    beforeEach(async (context) => {
      testFn = context.task.fn;
      context.task.fn = async () => {
        await withTransaction(async () => {
          await testFn!();
        });
      };
    });

    fn();
  });
}
```

#### Step 2.2: Choose implementation strategy

**Option A: Global Setup (Preferred)**

- Automatically wraps all tests
- No test file changes needed
- Less code duplication

**Option B: Manual Wrapper**

- Replace `describe` imports in all test files
- More explicit, easier to debug
- Better IDE support

**Decision:** Try Option A first, fall back to Option B if needed.

#### Step 2.3: Handle test files with existing beforeEach/afterEach

Some test files have complex setup (e.g., `testServer.ts`). These need special handling:

**File:** `src/__tests__/helpers/testServer.ts`

Update to work within transactions:

```typescript
export async function initializeIntegrationTestServer() {
  // Database is already in transaction context from global setup
  const db = await getDatabase();

  // Clear data (will be rolled back after test)
  await clearTestData(db);

  // Seed test data (will be rolled back after test)
  await seedDefaultData(db);

  // Reset defense values
  await resetDefenseValues(db);
}
```

**Key insight:** No need to manually manage transactions in test files - they're handled globally!

**Testing Step 2:**

- Run test suite: `npm test`
- Verify all tests still pass with transactions
- Check that database is clean between tests
- Verify no "connection pool exhausted" errors

### Phase 3: Enable Parallel Execution (Day 2-3)

#### Step 3.1: Remove singleThread restriction

**File:** `vitest.config.ts`

Remove or comment out the singleThread option:

```typescript
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    pool: "threads",
    poolOptions: {
      threads: {
        // singleThread: true,  // REMOVE THIS LINE
        // Tests now run in parallel with transaction isolation!
      },
    },
  },
});
```

#### Step 3.2: Adjust connection pool size

**File:** `src/lib/server/database.ts`

Increase test pool size to handle parallel workers:

```typescript
const config = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: testMode ? 5433 : 5432,
  database: testMode
    ? process.env.POSTGRES_TEST_DB || "spacewars_test"
    : dbName,
  user: process.env.POSTGRES_USER || "spacewars",
  password: process.env.POSTGRES_PASSWORD || "spacewars",
  max: testMode ? 10 : 20, // Increased from 5 to 10 for parallel tests
};
```

**Why 10 connections?**

- Default: 4 Vitest workers (threads)
- Each worker needs 1-2 connections (transaction + potential nested queries)
- 10 connections = safe buffer for 4 workers

#### Step 3.3: Run parallel tests

```bash
npm test
```

**Expected behavior:**

- Tests run in ~10-15 seconds (down from ~30 seconds)
- All 402 tests pass
- No race conditions
- No connection pool exhaustion

**Testing Step 3:**

- Run full test suite multiple times: `for i in {1..5}; do npm test; done`
- Verify consistent results (no flaky tests)
- Monitor connection pool usage
- Check for transaction deadlocks

### Phase 4: Validation & Cleanup (Day 3)

#### Step 4.1: Test specific scenarios

Run tests that previously had race conditions:

```bash
# Message cache tests
npm test -- MessageCache.test.ts

# Battle defense persistence
npm test -- battle-defense-persistence.test.ts

# User persistence
npm test -- user-persistence.test.ts

# Integration tests
npm test -- integration/
```

#### Step 4.2: Update documentation

**Files to update:**

- `doc/testing.md` - Explain transaction-based isolation
- `.github/copilot-instructions.md` - Update testing strategy
- `README.md` - Update test running instructions

Add section about parallel test execution:

```markdown
## Testing

Tests use transaction-based isolation for parallel execution:

- Each test runs in its own PostgreSQL transaction
- Transactions are automatically rolled back after each test
- No shared state between parallel tests
- Caches and locks are isolated per Vitest worker
```

#### Step 4.3: Performance comparison

Document the improvement:

```bash
# Before (sequential)
npm test  # ~30 seconds

# After (parallel)
npm test  # ~10-15 seconds
```

Create performance report in `doc/test-performance.md`

#### Step 4.4: Remove workarounds

Remove any test workarounds added during PostgreSQL migration:

- Check for `// TODO: Fix race condition` comments
- Remove `Date.now()` username suffixes if no longer needed
- Clean up any test-specific delays or timeouts

## Files Changed Summary

### Core Infrastructure (3 files)

- ✏️ `src/lib/server/database.ts` - Add AsyncLocalStorage transaction support
- ➕ `src/__tests__/helpers/transactionHelper.ts` - NEW: Transaction wrapper
- ✏️ `src/__tests__/setup.ts` - Add global transaction wrapping

### Configuration (1 file)

- ✏️ `vitest.config.ts` - Remove `singleThread: true`

### Documentation (3 files)

- ✏️ `doc/testing.md` - Explain transaction isolation
- ✏️ `.github/copilot-instructions.md` - Update testing strategy
- ➕ `doc/test-performance.md` - NEW: Performance comparison

### Optional (if global setup doesn't work)

- ➕ `src/__tests__/helpers/testWrapper.ts` - NEW: Manual test wrapper
- ✏️ ~50 test files - Replace `describe` imports

## What Does NOT Need Changes

- ❌ Cache classes (`UserCache`, `BattleCache`, `MessageCache`, `WorldCache`)
  - Reason: Already isolated per Vitest worker
- ❌ IronGuard lock system
  - Reason: Already isolated per Vitest worker
- ❌ Business logic functions (~200+ functions in `src/lib/server/`)
  - Reason: Already use `getDatabase()` which becomes transaction-aware
- ❌ API routes (~15 files in `src/app/api/`)
  - Reason: Already use `getDatabase()` which becomes transaction-aware
- ❌ Individual test files (if Option A works)
  - Reason: Global setup handles transaction wrapping automatically

## Risks & Mitigation

### Risk 1: Connection Pool Exhaustion

**Symptom:** "remaining connection slots are reserved" errors  
**Mitigation:**

- Increased pool size from 5 to 10 connections
- Monitor with `SELECT * FROM pg_stat_activity` during tests
- Add connection cleanup in error handlers

### Risk 2: Transaction Deadlocks

**Symptom:** Tests hang or timeout  
**Mitigation:**

- PostgreSQL deadlock detection is automatic
- Add transaction timeout: `SET LOCAL statement_timeout = '5s'`
- Use `withTransaction` helper that ensures rollback

### Risk 3: Nested Transaction Issues

**Symptom:** "cannot start subtransaction" errors  
**Mitigation:**

- Avoid explicit `BEGIN` in test code
- Use SAVEPOINTs if nested transactions are needed
- Document in test guidelines

### Risk 4: Cache Invalidation Timing

**Symptom:** Tests see stale data from cache  
**Mitigation:**

- Caches query through `getDatabase()` → use transaction automatically
- If issues arise, add cache invalidation in transaction rollback
- Monitor with cache hit/miss logging

## Success Criteria

- ✅ All 402 tests pass consistently
- ✅ Tests run in parallel (multiple workers)
- ✅ Test execution time reduced from ~30s to ~10-15s
- ✅ No race conditions or flaky tests
- ✅ No connection pool exhaustion
- ✅ No transaction deadlocks
- ✅ CI/CD pipeline passes
- ✅ Documentation updated

## Rollback Plan

If transaction-based isolation causes issues:

1. Revert `vitest.config.ts` → restore `singleThread: true`
2. Revert `src/lib/server/database.ts` → remove transaction context logic
3. Delete `src/__tests__/helpers/transactionHelper.ts`
4. Tests continue to work sequentially (current state)

**Effort to rollback:** 5 minutes (simple git revert)

## Future Improvements

Once transaction isolation is working:

1. **Test-specific seeding:** Each test can seed only the data it needs
2. **Parallel CI jobs:** Split test suite across multiple CI runners
3. **Watch mode:** Faster feedback loop during development
4. **Test sharding:** Distribute tests across machines for large test suites

## References

- Node.js AsyncLocalStorage: https://nodejs.org/api/async_context.html#class-asynclocalstorage
- PostgreSQL Transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
- Vitest Worker Model: https://vitest.dev/guide/improving-performance.html#pool
- Original Discussion: PR #67 - Migrate tests from SQLite to PostgreSQL

## Notes

- SQLite `:memory:` provided natural test isolation (new DB per test)
- PostgreSQL requires explicit isolation mechanism (transactions)
- Caches/IronGuard were never the problem - they're process-isolated
- Only database sharing between workers caused race conditions
- Transaction-based isolation is the standard approach for this scenario
