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
    } catch (error) {
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
 * Get database connection configuration from environment
 */
function getDatabaseConfig() {
  const isTest = process.env.NODE_ENV === 'test';
  
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
  };
}

export async function getDatabase(): Promise<DatabaseConnection> {
  // In test environment, check for transaction context first
  if (process.env.NODE_ENV === 'test') {
    await initTransactionContext();
    if (getTransactionContext) {
      const txContext = getTransactionContext();
      if (txContext) {
        // Return a wrapper that uses the transaction client
        return new PostgreSQLAdapter(txContext);
      }
    }
  }

  // If database is already initialized, return the adapter
  if (pool && adapter) {
    return adapter;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    await initializationPromise;
    return adapter!;
  }

  // Start initialization
  initializationPromise = (async () => {
    const config = getDatabaseConfig();
    pool = new Pool(config);
    adapter = new PostgreSQLAdapter(pool);
    
    const isTest = process.env.NODE_ENV === 'test';
    const dbLabel = isTest ? 'test' : 'production';
    console.log(`✅ Connected to PostgreSQL ${dbLabel} database: ${config.database}@${config.host}:${config.port}`);
    
    const client = await pool.connect();
    try {
      // Check if tables exist
      const tablesExist = await checkTablesExist(client);
      
      if (!tablesExist) {
        console.log(`🆕 New ${dbLabel} database detected, initializing...`);
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

async function initializeDatabase(client: PoolClient, pool: Pool): Promise<void> {
  console.log('🏗️ Creating database tables...');
  
  for (let i = 0; i < CREATE_TABLES.length; i++) {
    const tableSQL = CREATE_TABLES[i];
    await client.query(tableSQL);
    console.log(`✅ Created table ${i + 1}/${CREATE_TABLES.length}`);
  }
  
  console.log('🌱 Tables created, seeding initial data...');
  await seedDatabase(pool);
  console.log('✅ Database initialization complete!');
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
