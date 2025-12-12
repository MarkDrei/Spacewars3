import { Pool } from 'pg';
import { CREATE_TABLES } from './schema';
import { seedDatabase } from './seedData';

let pool: Pool | null = null;
let initializationPromise: Promise<Pool> | null = null;

// Test database management
let testPool: Pool | null = null;
let testDbInitialized = false;

async function initializeTestDatabase(): Promise<Pool> {
  if (testPool && testDbInitialized) {
    return testPool;
  }
  
  // For tests, use a separate test database or in-memory equivalent
  // PostgreSQL doesn't have :memory: like SQLite, so we'll use a separate test database
  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/spacewars_test';
  
  testPool = new Pool({
    connectionString: testDbUrl,
    max: 5,
  });
  
  // Drop all tables and recreate for clean test state
  const client = await testPool.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    
    // Create tables
    for (const createTableSQL of CREATE_TABLES) {
      await client.query(createTableSQL);
    }
    
    // Seed with test data
    await seedDatabase(testPool);
    
    testDbInitialized = true;
  } finally {
    client.release();
  }
  
  return testPool;
}

export async function getDatabase(): Promise<Pool> {
  // Use test database for tests
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase();
  }

  // If database pool is already initialized, return it immediately
  if (pool) {
    return pool;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/spacewars';
    
    console.log('🔌 Connecting to PostgreSQL database...');
    
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test the connection
    const client = await pool.connect();
    try {
      console.log('✅ Connected to PostgreSQL database');
      
      // Check if tables exist
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      const tablesExist = result.rows[0].exists;
      
      if (!tablesExist) {
        console.log('🆕 New database detected, initializing...');
        await initializeDatabase(pool);
      } else {
        console.log('📊 Existing database detected');
      }
      
      return pool;
    } finally {
      client.release();
    }
  })();

  return initializationPromise;
}

async function initializeDatabase(db: Pool): Promise<void> {
  console.log('🏗️ Creating database tables...');
  
  const client = await db.connect();
  try {
    // Run table creation statements in a transaction
    await client.query('BEGIN');
    
    for (const tableSQL of CREATE_TABLES) {
      await client.query(tableSQL);
      console.log('✅ Created table');
    }
    
    await client.query('COMMIT');
    
    console.log('🌱 Tables created, seeding initial data...');
    await seedDatabase(db);
    console.log('✅ Database initialization complete!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    initializationPromise = null;
  }
}

/**
 * Closes the test database (for cleanup in tests)
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool && process.env.NODE_ENV === 'test') {
    await testPool.end();
    testPool = null;
    testDbInitialized = false;
  }
}

/**
 * Resets the test database to fresh state
 */
export async function resetTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    await closeTestDatabase();
    // Next call to getDatabase() will create a fresh database
  }
}

/**
 * Execute a query with parameters (helper function for compatibility)
 */
export async function runQuery(
  db: Pool,
  sql: string,
  params: unknown[] = []
): Promise<unknown> {
  const client = await db.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Get a single row from a query
 */
export async function getRow(
  db: Pool,
  sql: string,
  params: unknown[] = []
): Promise<unknown | null> {
  const result = await runQuery(db, sql, params);
  return (result as { rows: unknown[] }).rows[0] || null;
}

/**
 * Get all rows from a query
 */
export async function getRows(
  db: Pool,
  sql: string,
  params: unknown[] = []
): Promise<unknown[]> {
  const result = await runQuery(db, sql, params);
  return (result as { rows: unknown[] }).rows;
}
