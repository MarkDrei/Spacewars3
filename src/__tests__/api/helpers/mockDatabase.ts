// ---
// Mock database utilities for testing World class with dependency injection
// ---

import { DatabaseConnection } from '@/lib/server/database';
import type { QueryResult } from '@/lib/server/databaseAdapter';

/**
 * Creates a mock database pool that implements the DatabaseConnection interface
 * but doesn't actually persist data. Useful for testing World class behavior
 * without needing real database operations.
 */
export function createMockDatabase(): DatabaseConnection {
  let nextId = 1;
  const mockObjects: Record<number, unknown> = {};

  // Create a mock database pool with minimal implementation
  const mockPool: DatabaseConnection = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: async <T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
      // Simulate INSERT operations with RETURNING id
      if (sql.includes('INSERT INTO space_objects') && sql.includes('RETURNING id')) {
        const newId = nextId++;
        return {
          rows: [{ id: newId }] as T[],
          rowCount: 1,
        };
      }
      
      // Simulate DELETE operations
      if (sql.includes('DELETE FROM space_objects')) {
        const objectId = params?.[0] as number;
        delete mockObjects[objectId];
        return {
          rows: [] as T[],
          rowCount: 1,
        };
      }
      
      // Simulate SELECT operations
      if (sql.includes('SELECT')) {
        return {
          rows: [] as T[],
          rowCount: 0,
        };
      }
      
      // Default: simulate success
      return {
        rows: [] as T[],
        rowCount: 0,
      };
    },
  };

  return mockPool;
}

/**
 * Create mock pool for test purposes
 * This provides pool interface but stores nothing
 */
export function createInMemoryDatabase(): DatabaseConnection {
  return createMockDatabase();
}
