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
  // Don't reset or close the database here - it's shared across tests.
  // Tests isolate their data with withTransaction().
}
