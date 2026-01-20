// ---
// Database test utilities for Next.js API route testing
// ---

import { DatabaseConnection, getDatabase } from '@/lib/server/database';

// Track if database has been initialized for tests
let testDbInitialized = false;

/**
 * Creates a test database with all tables and seed data.
 * Database is initialized once and shared across all tests.
 */
export async function createTestDatabase(): Promise<DatabaseConnection> {
  // Database is initialized in setup.ts, just return the connection
  if (!testDbInitialized) {
    testDbInitialized = true;
  }
  return await getDatabase();
}

/**
 * Gets or creates a test database instance.
 * Always calls getDatabase() which handles its own state management.
 */
export async function getTestDatabase(): Promise<DatabaseConnection> {
  return await getDatabase();
}

/**
 * Closes the test database (no-op for shared PostgreSQL connection)
 * The database connection is shared across all tests for performance
 */
export async function closeTestDatabase(): Promise<void> {
  // Don't reset or close the database here - it's shared across tests
  // Each test should clean up its own data using clearTestDatabase()
}

/**
 * Clears test data from database tables (messages and battles only, preserves seed data)
 * This allows tests to run with fresh data while keeping required seed users/space_objects
 */
export async function clearTestDatabase(): Promise<void> {
  const db = await getTestDatabase();
  
  // Only clear messages and battles - users and space_objects contain seed data
  // that other tests depend on (foreign keys)
  const tables = ['messages', 'battles'];
  
  for (const table of tables) {
    await db.query(`DELETE FROM ${table}`, []);
  }
}
