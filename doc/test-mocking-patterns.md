# Test Mocking Patterns

Maintained by the **Cleaner** agent. Each pattern below is a reusable technique for eliminating
database/cache dependencies from tests. Before writing new infrastructure, check if an existing
pattern already covers your case.

---

## Pattern 1 — `createMockSessionCookie(userId?)`

**Location**: `src/__tests__/helpers/apiTestHelpers.ts`

**What it does**: Seals `{ userId }` with iron-session's `sealData` using the same secret as the
application. Produces a valid `spacewars-session=…` cookie string without any database round-trip.

**When to use**: Any test that needs an _authenticated_ request but does **not** care about the
actual user record (auth-guard tests, input-validation tests, 401 checks with a valid session, etc.)

**When NOT to use**:

- The route accesses `UserCache` / `WorldCache` / database **before** the first interesting
  assertion (the cache singleton may not be initialised in unit mode — calling
  `UserCache.getInstance2()` at module level will throw)
- The test needs username, iron, tech tree, or any other real user fields

**How to detect if safe**: Read the route handler top-to-bottom. Find the first
`UserCache.getInstance2()` / `WorldCache.getInstance()` / `getDatabase()` call. If
`requireAuth(session.userId)` (or any 400/401/403 throw) comes **before** that call, it is safe.

**Usage**:

```typescript
import { createMockSessionCookie } from "../../helpers/apiTestHelpers";

const cookie = await createMockSessionCookie(); // userId = 1 (seeded user 'a')
const cookie = await createMockSessionCookie(42); // custom userId
const request = createRequest(url, "POST", body, cookie);
```

**Discovered**: During test-pyramid refactoring of `collection-api`, `complete-build-api`,
`inventory-api` (2026-02-27).

---

## Pattern 2 — No-cookie 401 test (zero infrastructure)

**What it does**: Sends a request with no session cookie at all. iron-session will parse an empty
session and `requireAuth(session.userId)` throws `ApiError(401)` immediately.

**When to use**: Every route's "not authenticated → 401" test. Requires no mocking, no helpers,
no DB.

**Placement**: Always in `unit/` — these tests never need `initializeIntegrationTestServer`.

**Usage**:

```typescript
const request = createRequest(
  "http://localhost:3000/api/some-route",
  "POST",
  {},
);
// No sessionCookie argument
const response = await HANDLER(request);
expect(response.status).toBe(401);
```

**Discovered**: During analysis of `admin-api`, `complete-build-api`, `inventory-api`
(2026-02-27).

---

## Pattern 3 — Inline pure-logic helper (zero imports)

**What it does**: Business logic defined _inside_ the test file without importing server modules.
Used when a test exercises a calculation or filtering function that has no side effects and no
server dependencies.

**When to use**: Test verifies an algorithm (e.g., `calculateCounts`, score formula, sort order)
that is defined in the test itself or imported from `src/shared/`.

**Placement**: `unit/` — safe because nothing in `src/lib/server/` is imported.

**Example**: `unit/admin/space-object-count-summary.test.ts` — `calculateCounts` is defined
inline; only a TypeScript type is imported.

---

## Pattern 4 — Inline UI business-logic test (no imports from `src/`)

**Location**: inline (all logic defined inside the test file)

**What it does**: Tests pure business logic (formatting, validation, state calculations) that was
written inline in a `ui/` test file. Because the logic has no React rendering, no DOM APIs,
and no imports from `src/`, it runs fine in the `node` environment and belongs in `unit/`.

**When to use**: A `ui/` test file whose every test function defines its own helper inline
(e.g. `const formatX = (n) => …`) and calls only standard JS/TS — no `render`, no `renderHook`,
no DOM queries, no `@testing-library/react`.

**When NOT to use**:
- The file imports React components or hooks from `src/`
- The file uses `render`, `renderHook`, `screen`, `fireEvent`, or any `@testing-library/react` API
- Any test accesses `document`, `window`, or other DOM globals

**Usage**: Simply move the `.test.ts` file from `src/__tests__/ui/` to the corresponding
`src/__tests__/unit/` subfolder. No code changes required.

**Discovered**: Cleaner agent during UI test audit (2025-07-09).

---

## Pattern 5 — Extracted service tests from mixed UI file

**Location**: new `unit/` file extracted from `ui/` file

**What it does**: When a `ui/` test file contains a mix of pure service/fetch tests and React
component render tests, the service tests are extracted to a new `unit/` file and the `ui/`
file is trimmed to keep only the React rendering tests.

**When to use**: A `ui/.test.tsx` file has two or more `describe` blocks where at least one
block only uses `vi.stubGlobal('fetch', …)` and calls the real service function — no React.

**When NOT to use**:
- All tests in the file need DOM/React (just `KEEP` the whole file)
- The service tests import server-side modules that throw outside integration context

**Usage**:
1. Create `unit/components/<service-name>.test.ts` containing only the service/type tests.
2. Remove those `describe` blocks from the `ui/` file; leave only the React render blocks.
3. Both files keep identical test logic — no behaviour change.

**Discovered**: Cleaner agent during UI test audit (2025-07-09); applied to `teleport-controls.test.tsx`.

---

## Template — Adding a new pattern

When the Cleaner agent discovers a new mocking technique, append a section here with:

```markdown
## Pattern N — <short name>

**Location**: <file path of the helper, or "inline">

**What it does**: <one paragraph>

**When to use**: <conditions>

**When NOT to use**: <anti-conditions>

**Usage**: <minimal code example>

**Discovered**: <agent name + date>
```
