// ---
// Database test utilities for Next.js API route testing
// ---

import { Pool } from 'pg';
import { CREATE_TABLES } from '@/lib/server/schema';

let testPool: Pool | null = null;

/**
 * Creates a test database pool with all tables
 */
export async function createTestDatabase(): Promise<Pool> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_TEST_DB || 'spacewars_test',
    user: process.env.POSTGRES_USER || 'spacewars',
    password: process.env.POSTGRES_PASSWORD || 'spacewars',
    max: 5,
  });
  
  // Clean up and create all tables
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS battles CASCADE');
    await client.query('DROP TABLE IF EXISTS messages CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS space_objects CASCADE');
    
    for (const createTableSQL of CREATE_TABLES) {
      await client.query(createTableSQL);
    }
  } finally {
    client.release();
  }
  
  return pool;
}

/**
 * Gets or creates a test database instance
 */
export async function getTestDatabase(): Promise<Pool> {
  if (!testPool) {
    testPool = await createTestDatabase();
  }
  return testPool;
}

/**
 * Closes the test database
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Clears all data from test database tables
 */
export async function clearTestDatabase(): Promise<void> {
  const pool = await getTestDatabase();
  
  const tables = ['messages', 'battles', 'users', 'space_objects'];
  
  for (const table of tables) {
    await pool.query(`DELETE FROM ${table}`);
  }
}
