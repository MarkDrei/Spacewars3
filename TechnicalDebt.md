# Technical Debt

## 🧪 Test Database Isolation

**Issue**: API tests use shared SQLite file database instead of isolated in-memory databases.

**Problems**:
- Tests share state through `database/users.db` file
- No test isolation - tests can affect each other
- Data accumulates across test runs
- Slower file I/O operations
- Potential test flakiness

**Current State**:
```typescript
// Tests call getDatabase() which uses file-based SQLite
const db = getDatabase(); // → database/users.db
```

**Solution**:
- Use existing `testDatabase.ts` infrastructure
- Switch to in-memory SQLite during tests
- Add `NODE_ENV=test` detection in `getDatabase()`
- Each test gets fresh isolated database

**Files to Modify**:
- `src/lib/server/database.ts` - Add test mode detection
- `vitest.config.ts` - Set `NODE_ENV=test`
- Test files - Use `createTestDatabase()` helper

**Impact**: High (better test reliability and speed)
