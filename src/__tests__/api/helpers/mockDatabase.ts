// ---
// Mock database utilities for testing World class with dependency injection
// ---

import { Pool, QueryResult } from 'pg';

/**
 * Creates a mock database pool that implements the Pool interface
 * but doesn't actually persist data. Useful for testing World class behavior
 * without needing real database operations.
 */
export function createMockDatabase(): Pool {
  let nextId = 1;
  const mockObjects: Record<number, unknown> = {};

  // Create a mock database pool with minimal implementation
  const mockPool = {
    query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
      // Simulate INSERT operations with RETURNING id
      if (sql.includes('INSERT INTO space_objects') && sql.includes('RETURNING id')) {
        const newId = nextId++;
        return {
          rows: [{ id: newId }],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: []
        } as QueryResult;
      }
      
      // Simulate DELETE operations
      if (sql.includes('DELETE FROM space_objects')) {
        const objectId = params?.[0] as number;
        delete mockObjects[objectId];
        return {
          rows: [],
          rowCount: 1,
          command: 'DELETE',
          oid: 0,
          fields: []
        } as QueryResult;
      }
      
      // Simulate SELECT operations
      if (sql.includes('SELECT')) {
        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: []
        } as QueryResult;
      }
      
      // Default: simulate success
      return {
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: []
      } as QueryResult;
    },
    
    connect: async () => ({
      query: mockPool.query,
      release: () => {}
    }),
    
    end: async () => {},
    
  } as unknown as Pool;

  return mockPool;
}

/**
 * Create mock pool for test purposes
 * This provides pool interface but stores nothing
 */
export function createInMemoryDatabase(): Pool {
  return createMockDatabase();
}
