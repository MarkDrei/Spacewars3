// ---
// Database test utilities for Next.js API route testing
// ---

import sqlite3 from 'sqlite3';
import { CREATE_TABLES } from '@/lib/server/schema';

let testDb: sqlite3.Database | null = null;

/**
 * Creates an in-memory test database with all tables
 */
export async function createTestDatabase(): Promise<sqlite3.Database> {
  const db = new (sqlite3.verbose().Database)(':memory:');
  
  // Create all tables
  await Promise.all(
    CREATE_TABLES.map(
      (createTableSQL) =>
        new Promise<void>((resolve, reject) => {
          db.run(createTableSQL, (err) => {
            if (err) reject(err);
            else resolve();
          });
        })
    )
  );
  
  return db;
}

/**
 * Gets or creates a test database instance
 */
export async function getTestDatabase(): Promise<sqlite3.Database> {
  if (!testDb) {
    testDb = await createTestDatabase();
  }
  return testDb;
}

/**
 * Closes the test database
 */
export async function closeTestDatabase(): Promise<void> {
  if (testDb) {
    await new Promise<void>((resolve, reject) => {
      testDb!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    testDb = null;
  }
}

/**
 * Clears all data from test database tables
 */
export async function clearTestDatabase(): Promise<void> {
  const db = await getTestDatabase();
  
  const tables = ['users', 'space_objects', 'messages'];
  
  await Promise.all(
    tables.map(
      (table) =>
        new Promise<void>((resolve, reject) => {
          db.run(`DELETE FROM ${table}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        })
    )
  );
}
