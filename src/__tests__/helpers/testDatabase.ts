// ---
// Database test utilities for Next.js API route testing
// ---

import { DatabaseConnection, getDatabase, resetTestDatabase } from '@/lib/server/database';

/**
 * Creates a test database with all tables and seed data.
 * Uses PostgreSQL test database.
 */
export async function createTestDatabase(): Promise<DatabaseConnection> {
  // Reset and get fresh test database (PostgreSQL test DB)
  await resetTestDatabase();
  return await getDatabase();
}

/**
 * Gets or creates a test database instance.
 * Always calls getDatabase() which handles its own state management.
 */
export async function getTestDatabase(): Promise<DatabaseConnection> {
  // The database module handles caching internally
  return await getDatabase();
}

/**
 * Closes the test database
 */
export async function closeTestDatabase(): Promise<void> {
  await resetTestDatabase();
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
