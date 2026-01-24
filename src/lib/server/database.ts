import { Pool } from 'pg';
import { CREATE_TABLES_PG } from './schema-pg';
import { seedDatabase } from './seedData';
import { applyTechMigrations } from './migrations-pg';

let pool: Pool | null = null;
let initializationPromise: Promise<Pool> | null = null;

// Test database management
let testPool: Pool | null = null;
let testPoolInitialized = false;

// Compatibility: Export a type that works for both SQLite and PostgreSQL
export type Database = Pool;

/**
 * Initialize test database
 */
async function initializeTestDatabase(): Promise<Pool> {
  if (testPool && testPoolInitialized) {
    return testPool;
  }
  
  // For tests, use a separate test database
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/spacewars_test',
    max: 5,
  });
  
  // Create tables
  for (const createTableSQL of CREATE_TABLES_PG) {
    await testPool.query(createTableSQL);
  }
  
  // Seed with the same default data as production
  await seedDatabase(testPool);
  
  testPoolInitialized = true;
  return testPool;
}

export async function getDatabase(): Promise<Pool> {
  // Use test database for tests
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase();
  }

  // If database is already initialized, return it immediately
  if (pool) {
    return pool;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/spacewars';
    
    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    console.log('✅ Connected to PostgreSQL database');
    
    try {
      // Check if tables exist
      const tableCheckResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      
      const dbExists = tableCheckResult.rows.length > 0;
      
      if (!dbExists) {
        console.log('🆕 New database detected, initializing...');
        await initializeDatabase(pool);
      } else {
        console.log('📊 Existing database detected, checking for migrations...');
        await applyTechMigrations(pool);
      }
      
      return pool;
    } catch (initError) {
      console.error('❌ Database initialization failed:', initError);
      initializationPromise = null;
      pool = null;
      throw initError;
    }
  })();

  return initializationPromise;
}

async function initializeDatabase(pool: Pool): Promise<void> {
  console.log('🏗️ Creating database tables...');
  
  // Run table creation statements
  for (let i = 0; i < CREATE_TABLES_PG.length; i++) {
    const tableSQL = CREATE_TABLES_PG[i];
    try {
      await pool.query(tableSQL);
      console.log(`✅ Created table ${i + 1}/${CREATE_TABLES_PG.length}`);
    } catch (err) {
      console.error(`❌ Error creating table ${i + 1}:`, err);
      throw err;
    }
  }
  
  console.log('🌱 Tables created, seeding initial data...');
  await seedDatabase(pool);
  console.log('✅ Database initialization complete!');
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Closes the test database (for cleanup in tests)
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool && process.env.NODE_ENV === 'test') {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Resets the test database to fresh state
 */
export async function resetTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    if (testPool) {
      // Drop all tables in reverse order (respecting foreign keys)
      try {
        await testPool.query('DROP TABLE IF EXISTS battles CASCADE');
        await testPool.query('DROP TABLE IF EXISTS messages CASCADE');
        await testPool.query('DROP TABLE IF EXISTS users CASCADE');
        await testPool.query('DROP TABLE IF EXISTS space_objects CASCADE');
      } catch (error) {
        console.error('Error dropping tables:', error);
      }
    }
    testPool = null;
    testPoolInitialized = false;
    // Next call to getDatabase() will create a fresh database
  }
}
