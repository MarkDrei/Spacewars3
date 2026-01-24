import { Pool, PoolClient } from 'pg';
import { CREATE_TABLES } from './schema';
import { seedDatabase } from './seedData';
import { applyTechMigrations } from './migrations';
import { DatabaseAdapter, PostgreSQLAdapter, QueryResult } from './databaseAdapter';

// Dynamic import for transaction context in test environment
let getTransactionContext: (() => PoolClient | undefined) | null = null;

// Initialize transaction context getter in test environment
async function initTransactionContext() {
  if (process.env.NODE_ENV === 'test' && !getTransactionContext) {
    try {
      const { getTransactionContext: txContext } = await import('../../__tests__/helpers/transactionHelper.js');
      getTransactionContext = txContext;
    } catch {
      // Transaction helper not available, tests will use pool directly
      console.log('⚠️ Transaction helper not available, using pool directly');
    }
  }
}

// Database connection pool (for both production and test PostgreSQL)
let pool: Pool | null = null;
let initializationPromise: Promise<Pool> | null = null;

// Cached adapter
let adapter: PostgreSQLAdapter | null = null;

/**
 * Type for the database - PostgreSQL connection interface
 */
export interface DatabaseConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/**
 * Adapter that dynamically switches between global pool and transaction client
 * based on the current execution context. Critical for proper test isolation
 * with singletons like UserCache.
 */
class TestAwareAdapter implements DatabaseConnection {
  constructor(private adapter: PostgreSQLAdapter) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    // Check if we are inside a test transaction
    if (getTransactionContext) {
      const txContext = getTransactionContext();
      if (txContext) {
        // Use the transaction client directly
        const result = await txContext.query(sql, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? 0
        };
      }
    }
    
    // Fallback to the main adapter (pool)
    return this.adapter.query<T>(sql, params);
  }
}

/**
 * Get database connection configuration from environment
 */
function getDatabaseConfig() {
  const isTest = process.env.NODE_ENV === 'test';
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: isTest 
      ? (process.env.POSTGRES_TEST_DB || 'spacewars_test')
      : (process.env.POSTGRES_DB || 'spacewars'),
    user: process.env.POSTGRES_USER || 'spacewars',
    password: process.env.POSTGRES_PASSWORD || 'spacewars',
    max: isTest ? 10 : 20, // Increased from 5 to 10 for parallel test workers
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Render requires SSL for production databases
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
}

export async function getDatabase(): Promise<DatabaseConnection> {
  const isTest = process.env.NODE_ENV === 'test';

  // In test environment, ensure transaction context is initialized
  if (isTest) {
    await initTransactionContext();
  }

  // If database is already initialized, return the adapter
  if (pool && adapter) {
    // In test environment, always return the context-aware adapter
    // This ensures singletons initialized with this connection will 
    // respect transactions started later
    if (isTest) {
      return new TestAwareAdapter(adapter);
    }
    return adapter;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    await initializationPromise;
    if (isTest) {
      return new TestAwareAdapter(adapter!);
    }
    return adapter!;
  }

  // Start initialization
  initializationPromise = (async () => {
    const config = getDatabaseConfig();
    pool = new Pool(config);
    adapter = new PostgreSQLAdapter(pool);
    
    const dbLabel = isTest ? 'test' : 'production';
    console.log(`✅ Connected to PostgreSQL ${dbLabel} database: ${config.database}@${config.host}:${config.port}`);
    
    const client = await pool.connect();
    try {
      // Check if tables exist
      const tablesExist = await checkTablesExist(client);
      let needsInit = !tablesExist;

      // If tables exist, make sure verify that seeding is complete
      // (Another process might have created tables but is still seeding)
      if (tablesExist) {
        const isSeeded = await checkDatabaseSeeded(client);
        if (!isSeeded) {
          needsInit = true;
        }
      }
      
      if (needsInit) {
        console.log(`🆕 New ${dbLabel} database detected (or unseeded), initializing...`);
        await initializeDatabase(client, pool);
      } else if (!isTest) {
        // Only run migrations in production, not in tests
        console.log('📊 Existing database detected, checking for migrations...');
        await applyTechMigrations(pool);
      }
      
      return pool;
    } finally {
      client.release();
    }
  })();

  await initializationPromise;
  
  if (isTest) {
    return new TestAwareAdapter(adapter!);
  }
  return adapter!;
}

async function checkTablesExist(client: PoolClient): Promise<boolean> {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    )
  `);
  return result.rows[0].exists;
}

async function checkDatabaseSeeded(client: PoolClient): Promise<boolean> {
  try {
    const result = await client.query('SELECT COUNT(*) FROM users');
    const count = parseInt(result.rows[0].count, 10);
    
    // In test environment, we expect test users too (2 defaults + 8 test users = 10)
    // Use loosely coupled check in case we change number of test users
    if (process.env.NODE_ENV === 'test') {
       return count >= 10;
    }
    
    // We expect at least the default users (a, dummy)
    return count >= 2;
  } catch {
    return false;
  }
}

// Advisory lock ID for database initialization (arbitrary number, must be consistent)
const DB_INIT_LOCK_ID = 123456789;

async function initializeDatabase(client: PoolClient, pool: Pool): Promise<void> {
  console.log('🔒 Acquiring database initialization lock...');
  
  // Acquire advisory lock to prevent concurrent initialization from multiple processes
  // pg_advisory_lock blocks until the lock is available
  await client.query('SELECT pg_advisory_lock($1)', [DB_INIT_LOCK_ID]);
  
  try {
    // Check again if tables exist (another process may have created them while we waited)
    const tablesExist = await checkTablesExist(client);
    
    if (tablesExist) {
      console.log('✅ Tables already exist (created by another process)');
      return;
    }
    
    console.log('🏗️ Creating database tables...');
    
    for (let i = 0; i < CREATE_TABLES.length; i++) {
      const tableSQL = CREATE_TABLES[i];
      await client.query(tableSQL);
      console.log(`✅ Created table ${i + 1}/${CREATE_TABLES.length}`);
    }
    
    console.log('🌱 Tables created, seeding initial data...');
    await seedDatabase(pool);
    console.log('✅ Database initialization complete!');
  } finally {
    // Always release the advisory lock
    await client.query('SELECT pg_advisory_unlock($1)', [DB_INIT_LOCK_ID]);
    console.log('🔓 Released database initialization lock');
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    initializationPromise = null;
    adapter = null;
  }
}

/**
 * Resets the test database to fresh state
 * Truncates all tables and reseeds them with default data
 */
export async function resetTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    // If no pool exists, reinitialize everything
    if (!pool || !adapter) {
      // Clear state
      pool = null;
      initializationPromise = null;
      adapter = null;
      
      // Reinitialize from scratch
      await getDatabase();
      return;
    }

    try {
      // Use TRUNCATE instead of DROP for faster reset
      // CASCADE removes dependent rows in referencing tables
      // RESTART IDENTITY resets sequences to 1
      await pool.query('TRUNCATE TABLE battles, messages, users, space_objects RESTART IDENTITY CASCADE');
      
      // Reseed the database with default data (force=true to skip user count check)
      await seedDatabase(adapter, true);
      
      console.log('🔄 Test database reset complete');
    } catch (error) {
      console.error('❌ Error resetting test database:', error);
      // If reset fails, force reinitialization
      pool = null;
      initializationPromise = null;
      adapter = null;
      // Reinitialize
      await getDatabase();
    }
  }
}

// Export the adapter interface for type usage
export type { DatabaseAdapter };

/**
 * Get the database pool for transaction management.
 * Should only be used by transaction helper in tests.
 */
export async function getDatabasePool(): Promise<Pool> {
  if (!pool) {
    await getDatabase(); // Initialize if needed
  }
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
}

