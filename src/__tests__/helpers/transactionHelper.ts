import { AsyncLocalStorage } from 'node:async_hooks';
import { getDatabase } from '../../lib/server/database.js';
import type { Pool, PoolClient } from 'pg';

const transactionStorage = new AsyncLocalStorage<PoolClient>();

/**
 * Wraps a test function in a database transaction that will be rolled back.
 * This allows parallel test execution without interference.
 * 
 * Usage:
 * ```typescript
 * await withTransaction(async () => {
 *   // Your test code here
 *   // All database operations will be in a transaction
 *   // Transaction is automatically rolled back after the test
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  const pool = db as Pool;
  
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    return await transactionStorage.run(client, async () => {
      try {
        return await callback();
      } catch (error) {
        // Rollback happens in finally block
        throw error;
      }
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during transaction rollback:', rollbackError);
    }
    client.release();
  }
}

/**
 * Gets the current transaction context if one exists.
 * Returns undefined if no transaction is active.
 */
export function getTransactionContext(): PoolClient | undefined {
  return transactionStorage.getStore();
}
