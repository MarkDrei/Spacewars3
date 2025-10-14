// ---
// MessagesRepo - Database operations for user messages
// Phase 4: Migrated to IronGuard V2
// ---

import sqlite3 from 'sqlite3';
import { getDatabase } from './database';
import { createLockContext } from './ironGuardV2';
import { withMessageWriteLock, withDatabaseLock } from './lockHelpers';

export interface Message {
  id: number;
  recipient_id: number;
  created_at: number; // Unix timestamp in seconds
  is_read: boolean;
  message: string;
}

export interface UnreadMessage {
  id: number;
  created_at: number;
  message: string;
}

/**
 * MessagesRepoV2 - Uses IronGuard V2 lock system
 * Message operations use MESSAGE_WRITE lock for modifications
 */
export class MessagesRepoV2 {
  private db: sqlite3.Database;

  constructor(database: sqlite3.Database) {
    this.db = database;
  }

  /**
   * Create a new message for a user
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: MESSAGE_WRITE(41) → DATABASE(60)
   */
  async createMessage(recipientId: number, message: string): Promise<number> {
    const ctx = createLockContext();
    
    return withMessageWriteLock(ctx, async (msgCtx) => {
      return withDatabaseLock(msgCtx, async () => {
        return new Promise<number>((resolve, reject) => {
          const createdAt = Math.floor(Date.now() / 1000);
          const stmt = this.db.prepare(`
            INSERT INTO messages (recipient_id, created_at, is_read, message)
            VALUES (?, ?, 0, ?)
          `);
          
          stmt.run(recipientId, createdAt, message, function(this: sqlite3.RunResult, err: Error | null) {
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve(this.lastID);
          });
        });
      });
    });
  }

  /**
   * Get all unread messages for a user and mark them as read
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: MESSAGE_WRITE(41) → DATABASE(60)
   * Uses WRITE lock because it modifies (marks as read)
   */
  async getAndMarkUnreadMessages(userId: number): Promise<UnreadMessage[]> {
    const ctx = createLockContext();
    
    return withMessageWriteLock(ctx, async (msgCtx) => {
      return withDatabaseLock(msgCtx, async () => {
        return new Promise<UnreadMessage[]>((resolve, reject) => {
          this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            // First, get all unread messages
            const selectStmt = this.db.prepare(`
              SELECT id, created_at, message
              FROM messages 
              WHERE recipient_id = ? AND is_read = 0
              ORDER BY created_at ASC
            `);
            
            selectStmt.all(userId, (err: Error | null, rows: UnreadMessage[]) => {
              selectStmt.finalize();
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              if (rows.length === 0) {
                this.db.run('COMMIT');
                resolve([]);
                return;
              }
              
              // Mark all unread messages as read
              const updateStmt = this.db.prepare(`
                UPDATE messages 
                SET is_read = 1 
                WHERE recipient_id = ? AND is_read = 0
              `);
              
              updateStmt.run(userId, (updateErr: Error | null) => {
                updateStmt.finalize();
                if (updateErr) {
                  this.db.run('ROLLBACK');
                  reject(updateErr);
                  return;
                }
                
                this.db.run('COMMIT', (commitErr: Error | null) => {
                  if (commitErr) {
                    reject(commitErr);
                    return;
                  }
                  resolve(rows);
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Get all messages for a user (read and unread)
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: MESSAGE_WRITE(41) → DATABASE(60)
   * Note: Using WRITE lock to be consistent with cache manager operations
   */
  async getAllMessages(userId: number): Promise<Message[]> {
    const ctx = createLockContext();
    
    return withMessageWriteLock(ctx, async (msgCtx) => {
      return withDatabaseLock(msgCtx, async () => {
        return new Promise<Message[]>((resolve, reject) => {
          const stmt = this.db.prepare(`
            SELECT id, recipient_id, created_at, is_read, message
            FROM messages 
            WHERE recipient_id = ?
            ORDER BY created_at DESC
          `);
          
          stmt.all(userId, (err: Error | null, rows: Message[]) => {
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve(rows || []);
          });
        });
      });
    });
  }

  /**
   * Delete a message
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: MESSAGE_WRITE(41) → DATABASE(60)
   */
  async deleteMessage(messageId: number): Promise<void> {
    const ctx = createLockContext();
    
    return withMessageWriteLock(ctx, async (msgCtx) => {
      return withDatabaseLock(msgCtx, async () => {
        return new Promise<void>((resolve, reject) => {
          const stmt = this.db.prepare(`
            DELETE FROM messages WHERE id = ?
          `);
          
          stmt.run(messageId, (err: Error | null) => {
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  /**
   * Get count of unread messages for a user
   * 
   * MIGRATED: Uses IronGuard V2 lock system
   * Lock order: MESSAGE_WRITE(41) → DATABASE(60)
   */
  async getUnreadCount(userId: number): Promise<number> {
    const ctx = createLockContext();
    
    return withMessageWriteLock(ctx, async (msgCtx) => {
      return withDatabaseLock(msgCtx, async () => {
        return new Promise<number>((resolve, reject) => {
          const stmt = this.db.prepare(`
            SELECT COUNT(*) as count
            FROM messages 
            WHERE recipient_id = ? AND is_read = 0
          `);
          
          stmt.get(userId, (err: Error | null, row: { count: number } | undefined) => {
            stmt.finalize();
            if (err) {
              reject(err);
              return;
            }
            resolve(row?.count || 0);
          });
        });
      });
    });
  }
}

/**
 * Helper function to create MessagesRepoV2 instance
 */
export async function createMessagesRepoV2(): Promise<MessagesRepoV2> {
  const db = await getDatabase();
  return new MessagesRepoV2(db);
}
