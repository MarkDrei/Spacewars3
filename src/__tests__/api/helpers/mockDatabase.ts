// ---
// Mock database utilities for testing World class with dependency injection
// ---

import sqlite3 from 'sqlite3';

/**
 * Creates a mock database that implements the sqlite3.Database interface
 * but doesn't actually persist data. Useful for testing World class behavior
 * without needing real database operations.
 */
export function createMockDatabase(): sqlite3.Database {
  let nextId = 1;
  const mockObjects: Record<number, unknown> = {};

  // Create a mock database with minimal implementation
  const mockDb = {
    run: (sql: string, params: unknown[], callback?: (this: { lastID: number }, err: Error | null) => void) => {
      // Simulate INSERT operations
      if (sql.includes('INSERT INTO space_objects')) {
        const newId = nextId++;
        if (callback) {
          // Simulate the 'this' context with lastID
          callback.call({ lastID: newId }, null);
        }
        return mockDb as unknown as sqlite3.Database;
      }
      
      // Simulate DELETE operations
      if (sql.includes('DELETE FROM space_objects')) {
        const objectId = params[0] as number;
        delete mockObjects[objectId];
        if (callback) {
          callback.call({ lastID: 0 }, null);
        }
        return mockDb as unknown as sqlite3.Database;
      }
      
      // Default: simulate success
      if (callback) {
        callback.call({ lastID: 0 }, null);
      }
      return mockDb as unknown as sqlite3.Database;
    },
    
    get: (sql: string, params: unknown[], callback: (err: Error | null, row?: unknown) => void) => {
      // Mock implementation for get operations
      callback(null, undefined);
      return mockDb as unknown as sqlite3.Database;
    },
    
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => {
      // Mock implementation for all operations
      callback(null, []);
      return mockDb as unknown as sqlite3.Database;
    },
    
    close: (callback?: (err: Error | null) => void) => {
      if (callback) {
        callback(null);
      }
      return mockDb as unknown as sqlite3.Database;
    },
    
    // Add other methods as needed for sqlite3.Database interface
    prepare: () => mockDb as unknown as sqlite3.Database,
    exec: () => mockDb as unknown as sqlite3.Database,
    serialize: () => mockDb as unknown as sqlite3.Database,
    parallelize: () => mockDb as unknown as sqlite3.Database,
    
  } as unknown as sqlite3.Database; // Type assertion to satisfy sqlite3.Database interface

  return mockDb;
}

/**
 * Alternative: Create a real in-memory database for more realistic testing
 * This provides full SQLite functionality but in memory only
 */
export function createInMemoryDatabase(): sqlite3.Database {
  return new sqlite3.Database(':memory:');
}
