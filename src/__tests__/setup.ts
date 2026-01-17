import '@testing-library/jest-dom';
import { vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createBcryptMock } from './helpers/bcryptMock';
import { withTransaction } from './helpers/transactionHelper';

// Mock bcrypt globally for all tests to use precomputed hashes
// This provides a 50-70% speedup for authentication tests
vi.mock('bcrypt', () => createBcryptMock());

// Initialize test database once before all tests
beforeAll(async () => {
  const { getDatabase } = await import('@/lib/server/database');
  await getDatabase(); // This will initialize the database with seed data
});

// Store original test function to wrap it in a transaction
let originalTestFn: (() => Promise<void>) | null = null;

// Wrap each test in a database transaction for isolation
// All database changes are automatically rolled back after the test
beforeEach(async (context) => {
  // Store the original test function
  originalTestFn = context.task.fn;
  
  // Wrap the test function in a transaction
  context.task.fn = async () => {
    await withTransaction(async () => {
      if (originalTestFn) {
        await originalTestFn();
      }
    });
  };
});

// Global cleanup after each test to prevent async operations from leaking
afterEach(async () => {
  // Wait for any pending MessageCache writes to complete
  // This prevents foreign key violations when tests delete users
  // while MessageCache is still asynchronously persisting messages
  try {
    const { getMessageCache } = await import('@/lib/server/messages/MessageCache');
    const messageCache = getMessageCache();
    if (messageCache) {
      await messageCache.waitForPendingWrites();
    }
  } catch (error) {
    // Ignore if MessageCache doesn't exist or isn't initialized
  }

  // Wait for any pending BattleCache writes to complete
  // This prevents race conditions with dirty battles being persisted
  // asynchronously after tests delete users
  try {
    const { getBattleCache } = await import('@/lib/server/battle/BattleCache');
    const battleCache = getBattleCache();
    if (battleCache) {
      await battleCache.waitForPendingWrites();
    }
  } catch (error) {
    // Ignore if BattleCache doesn't exist or isn't initialized
  }

  // Brief delay to allow any other lingering async operations to complete
  // This helps prevent foreign key violations in PostgreSQL when
  // subsequent tests reset the database
  // Reduced from 35ms to 10ms since caches are now properly flushed
  await new Promise(resolve => setTimeout(resolve, 10));
});

// Note: Transaction-based test isolation is now enabled globally
// Each test runs in its own transaction that is automatically rolled back
// This allows parallel test execution without database conflicts
// Individual integration tests may still use initializeIntegrationTestServer() for cache management

