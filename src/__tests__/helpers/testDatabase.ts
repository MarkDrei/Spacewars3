// ---
// Database test utilities for Next.js API route testing
// ---

import { DatabaseConnection, getDatabase, resetTestDatabase } from '@/lib/server/database';

let testDatabaseConnection: DatabaseConnection | null = null;

/**
 * Creates a test database with all tables and seed data
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
