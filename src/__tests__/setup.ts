import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';
import { createBcryptMock } from './helpers/bcryptMock';

// Mock bcrypt globally for all tests to use precomputed hashes
// This provides a 50-70% speedup for authentication tests
vi.mock('bcrypt', () => createBcryptMock());

// Initialize test database once before all tests
beforeAll(async () => {
  const { getDatabase, getDatabasePool } = await import('@/lib/server/database');
  const { PostgreSQLAdapter } = await import('@/lib/server/databaseAdapter');
  
  // Ensure database schema is initialized
  await getDatabase(); 
  
  // Use a dedicated client and advisory lock for seeding to prevent race conditions
  // when multiple test workers start simultaneously
  const pool = await getDatabasePool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    // Acquire advisory lock 987654321 for seeding coordination
    // pg_advisory_xact_lock is automatically released at end of transaction
    await client.query('SELECT pg_advisory_xact_lock(987654321)');
    
    // Check user count using the locked client
    const result = await client.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(result.rows[0].count, 10);
    
    if (userCount === 0) {
      console.log(`🌱 Test database is empty (worker ${process.pid}), seeding...`);
      const { seedDatabase } = await import('@/lib/server/seedData');
      // Wrap client in adapter for seedDatabase
      const adapter = new PostgreSQLAdapter(client);
      await seedDatabase(adapter, true);
      console.log('✅ Test database seeded');
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

// Global cleanup after each test to prevent async operations from leaking
afterEach(async () => {
  // Wait for any pending MessageCache writes to complete
  // This prevents foreign key violations when tests delete users
  // while MessageCache is still asynchronously persisting messages
  try {
    const { MessageCache } = await import('@/lib/server/messages/MessageCache');
    const messageCache = MessageCache.getInstance();
    if (messageCache) {
      await messageCache.waitForPendingWrites();
    }
  } catch {
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
  } catch {
    // Ignore if BattleCache doesn't exist or isn't initialized
  }

  // Brief delay to allow any other lingering async operations to complete
  // This helps prevent foreign key violations in PostgreSQL when
  // subsequent tests reset the database
  // Reduced from 35ms to 10ms since caches are now properly flushed
  await new Promise(resolve => setTimeout(resolve, 10));
});

// Note: Transaction-based test isolation infrastructure is in place but not yet enabled
// The transactionHelper.ts provides withTransaction() for wrapping tests
// The database.ts checks for transaction context via AsyncLocalStorage
// 
// Remaining challenges before enabling parallel execution:
// 1. Cache background persistence writes happen outside transaction scope
//    - MessageCache persists messages asynchronously every 30s
//    - BattleCache persists battles asynchronously
//    - These writes can reference users/data that was rolled back in transactions
//
// 2. Tests use initializeIntegrationTestServer() which expects to manage DB state
//    - Deletes battles/messages tables manually
//    - Resets defense values for test users
//    - This conflicts with transaction-based isolation
//
// Solution path:
// 1. Add test mode flag to disable background persistence in caches
// 2. Refactor initializeIntegrationTestServer() to work with transactions
// 3. Wrap individual tests or test suites with withTransaction()
// 4. Remove singleThread flag to enable parallel execution

