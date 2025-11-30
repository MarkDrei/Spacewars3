// ---
// Database test utilities for Next.js API route testing
// ---

import { DatabaseConnection, getDatabase, resetTestDatabase } from '@/lib/server/database';

let testDatabaseConnection: DatabaseConnection | null = null;

/**
 * Creates a test database with all tables
 */
export async function createTestDatabase(): Promise<DatabaseConnection> {
  // Reset and get fresh test database (SQLite in-memory for tests)
  resetTestDatabase();
  return await getDatabase();
}

/**
 * Gets or creates a test database instance
 */
export async function getTestDatabase(): Promise<DatabaseConnection> {
  if (!testDatabaseConnection) {
    testDatabaseConnection = await createTestDatabase();
  }
  return testDatabaseConnection;
}

/**
 * Closes the test database
 */
export async function closeTestDatabase(): Promise<void> {
  if (testDatabaseConnection) {
    resetTestDatabase();
    testDatabaseConnection = null;
  }
}

/**
 * Clears all data from test database tables
 */
export async function clearTestDatabase(): Promise<void> {
  const db = await getTestDatabase();
  
  const tables = ['messages', 'battles', 'users', 'space_objects'];
  
  for (const table of tables) {
    await db.query(`DELETE FROM ${table}`, []);
  }
}
