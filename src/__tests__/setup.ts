import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { createBcryptMock } from './helpers/bcryptMock';

// Mock bcrypt globally for all tests to use precomputed hashes
// This provides a 50-70% speedup for authentication tests
vi.mock('bcrypt', () => createBcryptMock());

// Initialize test database once before all tests
beforeAll(async () => {
  const { getDatabase } = await import('@/lib/server/database');
  await getDatabase(); // This will initialize the database with seed data
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

// Note: Transaction-based test isolation is implemented but not enabled globally yet
// Individual integration tests use initializeIntegrationTestServer() which resets caches
// Each test's database changes are automatically rolled back via withTransaction wrapper

