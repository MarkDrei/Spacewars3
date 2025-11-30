// ---
// Database abstraction layer for PostgreSQL (production) and SQLite (tests)
// ---

import type { Pool as PgPool, QueryResult as PgQueryResult } from 'pg';
import type BetterSqlite3 from 'better-sqlite3';

/**
 * Unified query result interface
 */
export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Abstract database interface that both adapters implement
 */
export interface DatabaseAdapter {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

/**
 * PostgreSQL adapter - wraps pg Pool
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
  constructor(private pool: PgPool) {}
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0
    };
  }
  
  async close(): Promise<void> {
    await this.pool.end();
  }
  
  /**
   * Get the underlying pool (for backward compatibility)
   */
  getPool(): PgPool {
    return this.pool;
  }
}

/**
 * SQLite adapter - wraps better-sqlite3 for tests
 * Converts PostgreSQL-style $1, $2 placeholders to SQLite ? placeholders
 * Also implements the Pool.query() interface for compatibility
 */
export class SQLiteAdapter implements DatabaseAdapter {
  constructor(private db: BetterSqlite3.Database) {}
  
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    // Convert PostgreSQL $1, $2, ... placeholders to SQLite ?
    const sqliteSql = this.convertPlaceholders(sql);
    
    // Convert boolean values to integers for SQLite
    const convertedParams = params?.map(p => {
      if (typeof p === 'boolean') return p ? 1 : 0;
      return p;
    });
    
    const trimmedSql = sql.trim().toUpperCase();
    const isSelect = trimmedSql.startsWith('SELECT');
    const isInsert = trimmedSql.startsWith('INSERT');
    const isReturning = sql.toUpperCase().includes('RETURNING');
    
    try {
      if (isSelect || isReturning) {
        // For SELECT or RETURNING queries, get rows
        let modifiedSql = sqliteSql;
        
        // Handle INSERT ... RETURNING id - SQLite needs special handling
        if (isInsert && isReturning) {
          // Remove RETURNING clause for INSERT
          modifiedSql = sqliteSql.replace(/\s+RETURNING\s+\w+/i, '');
          const stmt = this.db.prepare(modifiedSql);
          const info = convertedParams ? stmt.run(...convertedParams) : stmt.run();
          
          const convertedRows = [{ id: Number(info.lastInsertRowid) }] as T[];
          return {
            rows: convertedRows,
            rowCount: info.changes
          };
        }
        
        const stmt = this.db.prepare(modifiedSql);
        const rows = (convertedParams ? stmt.all(...convertedParams) : stmt.all()) as T[];
        
        // Convert SQLite integers back to booleans for is_read field
        const convertedRows = rows.map(row => this.convertBooleans(row));
        
        return {
          rows: convertedRows as T[],
          rowCount: rows.length
        };
      } else if (isInsert) {
        // For INSERT without RETURNING, execute and return lastInsertRowid
        const stmt = this.db.prepare(sqliteSql);
        const info = convertedParams ? stmt.run(...convertedParams) : stmt.run();
        return {
          rows: [{ id: Number(info.lastInsertRowid) }] as T[],
          rowCount: info.changes
        };
      } else {
        // For UPDATE, DELETE, etc.
        const stmt = this.db.prepare(sqliteSql);
        const info = convertedParams ? stmt.run(...convertedParams) : stmt.run();
        return {
          rows: [],
          rowCount: info.changes
        };
      }
    } catch (error) {
      console.error('SQLite query error:', sqliteSql, convertedParams, error);
      throw error;
    }
  }
  
  private convertPlaceholders(sql: string): string {
    // Replace $1, $2, etc. with ?
    return sql.replace(/\$\d+/g, '?');
  }
  
  private convertBooleans<T>(row: T): T {
    if (typeof row !== 'object' || row === null) return row;
    
    const converted = { ...row } as Record<string, unknown>;
    // Convert is_read from integer to boolean
    if ('is_read' in converted) {
      converted.is_read = Boolean(converted.is_read);
    }
    // Convert exists field from integer to boolean (for EXISTS queries)
    if ('exists' in converted) {
      converted.exists = Boolean(converted.exists);
    }
    // Convert in_battle from integer to boolean
    if ('in_battle' in converted) {
      converted.in_battle = Number(converted.in_battle);
    }
    return converted as T;
  }
  
  async close(): Promise<void> {
    this.db.close();
  }
  
  /**
   * Get the underlying database (for backward compatibility)
   */
  getDatabase(): BetterSqlite3.Database {
    return this.db;
  }
}

/**
 * Create a Pool-like object from SQLiteAdapter for compatibility
 * This allows existing code using db.query() to work unchanged
 */
export function createPoolLikeFromSQLite(adapter: SQLiteAdapter): { query: typeof adapter.query } {
  return {
    query: adapter.query.bind(adapter)
  };
}
