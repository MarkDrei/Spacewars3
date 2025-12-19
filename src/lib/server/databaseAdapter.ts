// ---
// Database abstraction layer for PostgreSQL
// ---

import type { Pool as PgPool, PoolClient } from 'pg';

/**
 * Unified query result interface
 */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Abstract database interface
 */
export interface DatabaseAdapter {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

/**
 * PostgreSQL adapter - wraps pg Pool or PoolClient
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
  constructor(private poolOrClient: PgPool | PoolClient) {}
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const result = await this.poolOrClient.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0
    };
  }
  
  async close(): Promise<void> {
    // Only close if it's a Pool, not a PoolClient
    if ('end' in this.poolOrClient && typeof this.poolOrClient.end === 'function') {
      await this.poolOrClient.end();
    }
  }
  
  /**
   * Get the underlying pool (for backward compatibility)
   */
  getPool(): PgPool | PoolClient {
    return this.poolOrClient;
  }
}
