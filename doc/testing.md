# Testing Strategy

This document outlines the comprehensive testing strategy for the Spacewars Ironcore project, including database isolation, test categories, and execution patterns.

## Table of Contents

- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Test Categories](#test-categories)
- [Environment Configuration](#environment-configuration)
- [Test Execution](#test-execution)
- [Database Management](#database-management)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)

## Overview

The Spacewars project uses a **multi-layered testing approach** with strict separation between test and production data. Tests are categorized by their scope and database requirements, ensuring both thorough coverage and complete isolation from production data.

### Key Principles

- ✅ **Complete Database Isolation**: Tests never touch production data
- ✅ **Environment-Based Switching**: Automatic database selection via `NODE_ENV`
- ✅ **Layered Test Architecture**: Unit → Integration → API → E2E
- ✅ **Zero Production Impact**: All test data exists only in memory during tests

## Database Architecture

### 🏭 Production Database
- **Type**: File-based SQLite database
- **Location**: `database/users.db`
- **Usage**: Development server, production deployment
- **Data**: Seeded with default users and space objects
- **Access**: `getDatabase()` when `NODE_ENV !== 'test'`

### 🧪 Test Database
- **Type**: In-memory SQLite database (`:memory:`)
- **Location**: RAM only, no file persistence
- **Usage**: All automated tests
- **Data**: Fresh seeded data for each test suite run
- **Access**: `getDatabase()` when `NODE_ENV === 'test'`

### 🔄 Database Switching Logic

```typescript
// src/lib/server/database.ts
export function getDatabase(): sqlite3.Database {
  // Automatic switching based on NODE_ENV
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase(); // In-memory database
  }
  
  // File-based production database
  return initializeProductionDatabase();
}
```

## Test Categories

### 1. 🎭 Unit Tests (Pure Functions)
**Location**: `src/__tests__/lib/`, `src/__tests__/components/`

**Characteristics**:
- No database dependencies
- Use mocks and dependency injection
- Test business logic in isolation
- Fast execution (< 1ms per test)

**Examples**:
```typescript
// src/__tests__/lib/user-domain.test.ts
const dummySave: SaveUserCallback = async () => { /* no-op */ };
const user = new User(1, 'test', 'hash', 0, 1000, techTree, dummySave);
```

### 2. 🧪 Repository/Integration Tests (Test Database)
**Location**: `src/__tests__/lib/messagesRepo.test.ts`, `src/__tests__/api/messages-api.test.ts`

**Characteristics**:
- Use in-memory test database
- Proper cleanup between tests
- Test database operations directly
- Medium execution speed (10-100ms per test)

**Pattern**:
```typescript
import { getTestDatabase, clearTestDatabase } from '../helpers/testDatabase';

beforeEach(async () => {
  await clearTestDatabase(); // ✅ Clean slate for each test
});
```

### 3. 🏭 API Integration Tests (Test Database via Environment)
**Location**: `src/__tests__/api/` (all files)

**Characteristics**:
- Import API routes directly
- Use in-memory test database (via `NODE_ENV=test`)
- Test complete request/response cycle
- Slower execution (100-1000ms per test)

**Pattern**:
```typescript
// Tests automatically use test database due to NODE_ENV=test
import { POST as registerPOST } from '@/app/api/register/route';

const response = await registerPOST(request);
// This uses test database, not production database
```

### 4. 🎯 Service Tests (Mocked Network)
**Location**: `src/__tests__/services/`

**Characteristics**:
- Mock HTTP requests with `vi.fn()`
- Test client-side service functions
- No database or network dependencies
- Fast execution (< 10ms per test)

**Pattern**:
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});
```

## Environment Configuration

### Vitest Configuration
**File**: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    env: {
      NODE_ENV: 'test' // ⚠️ Critical: Forces test database usage
    },
  },
});
```

### Environment Variables

| Variable | Value | Effect |
|----------|-------|--------|
| `NODE_ENV=test` | Set by Vitest | Uses in-memory test database |
| `NODE_ENV=development` | Default for dev server | Uses file-based production database |
| `NODE_ENV=production` | Deployment | Uses file-based production database |

## Test Execution

### Running Tests

```bash
# All tests with watch mode
npm test

# Single test run
npm test -- --run

# Specific test file
npm test -- src/__tests__/api/admin-api.test.ts --run

# UI mode for debugging
npm run test:ui

# CI pipeline (lint + test + build)
npm run ci
```

### Execution Flow

1. **Vitest starts** → Sets `NODE_ENV=test`
2. **API routes called** → `getDatabase()` detects test environment
3. **Test database created** → In-memory SQLite with seeded data
4. **Tests execute** → Isolated from production database
5. **Memory cleared** → Test data disappears, no cleanup needed

## Database Management

### Test Database Lifecycle

```typescript
// Automatic creation on first access
const db = getDatabase(); // Creates fresh in-memory DB with seeded data

// Manual cleanup (only needed for repository tests)
await clearTestDatabase(); // Deletes all data from tables

// Automatic destruction when process ends
// Memory-based database disappears automatically
```

### Seeded Test Data

The test database starts with the same seeded data as production:

- **User**: username='a', password='a' (bcrypt hashed)
- **Space Objects**: 10 asteroids, shipwrecks, escape pods
- **Player Ship**: Associated with default user

### Data Isolation Guarantees

- ✅ **No test data persists** after test completion
- ✅ **Production database never modified** during tests
- ✅ **Each test suite gets fresh seeded data**
- ✅ **Concurrent test runs don't interfere** (separate memory spaces)

## Best Practices

### 1. Test Data Management

```typescript
// ✅ Good: Use random usernames to avoid conflicts
const username = randomUsername('testuser');

// ✅ Good: Clear test database between repository tests
beforeEach(async () => {
  await clearTestDatabase();
});

// ❌ Avoid: Hardcoded usernames that might conflict
const username = 'testuser'; // Could conflict between tests
```

### 2. Database Access Patterns

```typescript
// ✅ Good: Repository tests with explicit test database
const testDb = await getTestDatabase();
const repo = new MessagesRepo(testDb);

// ✅ Good: API tests using environment-based switching
const response = await registerPOST(request); // Automatic test DB

// ❌ Avoid: Mixing database access patterns
const prodDb = getDatabase(); // Don't override environment detection
```

### 3. Test Isolation

```typescript
// ✅ Good: Reset singletons between tests
beforeEach(() => {
  TypedCacheManager.resetInstance();
});

// ✅ Good: Clean mocks between tests  
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Common Patterns

### API Authentication Testing

```typescript
describe('Protected API Endpoint', () => {
  test('unauthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/protected', 'GET');
    const response = await protectedAPI(request);
    
    expect(response.status).toBe(401);
  });

  test('authenticated_returnsData', async () => {
    const sessionCookie = await createAuthenticatedSession('testuser');
    const request = createRequest('http://localhost:3000/api/protected', 'GET', undefined, sessionCookie);
    const response = await protectedAPI(request);
    
    expect(response.status).toBe(200);
  });
});
```

### Database-Dependent Testing

```typescript
describe('Repository Tests', () => {
  let repo: MessagesRepo;

  beforeEach(async () => {
    const testDb = await getTestDatabase();
    await clearTestDatabase(); // Fresh start
    repo = new MessagesRepo(testDb);
  });

  test('createMessage_validData_success', async () => {
    const messageId = await repo.createMessage(1, 'Hello World');
    expect(messageId).toBeGreaterThan(0);
  });
});
```

### Cache Management Testing

```typescript
describe('Cache Manager Tests', () => {
  beforeEach(() => {
    TypedCacheManager.resetInstance();
  });

  afterEach(async () => {
    try {
      const manager = getTypedCacheManager();
      await manager.shutdown();
      TypedCacheManager.resetInstance();
    } catch {
      // Ignore cleanup errors
    }
  });
});
```

## Troubleshooting

### Common Issues

1. **Test database not isolated**
   - **Check**: `NODE_ENV=test` is set in vitest.config.ts
   - **Verify**: `getDatabase()` returns in-memory database during tests

2. **Tests interfering with each other**
   - **Solution**: Add `beforeEach` cleanup for shared resources
   - **Check**: Singleton instances are reset between tests

3. **Slow test execution**
   - **Cause**: Using file database instead of in-memory
   - **Solution**: Ensure proper environment variable configuration

4. **Production data modified by tests**
   - **Critical**: This should never happen if environment switching works
   - **Debug**: Log which database is being used in `getDatabase()`

### Debug Commands

```bash
# Run single test with verbose output
npm test -- src/__tests__/api/admin-api.test.ts --run --reporter=verbose

# Check environment variables during test
console.log('NODE_ENV:', process.env.NODE_ENV);

# Verify database type being used
console.log('Database type:', db.filename || 'in-memory');
```

---

*This testing strategy ensures robust, isolated, and maintainable tests while protecting production data integrity.*