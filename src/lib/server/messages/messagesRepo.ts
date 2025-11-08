// ---
// MessagesRepo - Database operations for user messages
// Single responsibility: Handle all direct database interactions for messages
// All methods require DATABASE_LOCK to be held by caller
// ---

import sqlite3 from 'sqlite3';
import type { ValidLock8Context } from '../typedLocks';

export interface Message {
  id: number;
  recipient_id: number;
  created_at: number; // Unix timestamp in milliseconds
  is_read: boolean;
  message: string;
  isPending?: boolean; // Flag for messages not yet persisted to DB
}

export interface UnreadMessage {
  id: number;
  created_at: number;
  message: string;
}

/**
 * MessagesRepo - Repository pattern for message database operations
 * 
 * Responsibilities:
 * - All direct database interactions for messages
 * - SQL query execution
 * - Data transformation between DB and application layer
 * 
 * Does NOT:
 * - Handle caching (that's MessageCache's job)
 * - Handle business logic
 * - Acquire locks (caller must hold MESSAGE_DB_LOCK)
 */
export class MessagesRepo {
  private db: sqlite3.Database;

  constructor(database: sqlite3.Database) {
    this.db = database;
  }

  /**
   * Create a new message for a user
   * Returns the ID of the newly created message
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async createMessage(recipientId: number, message: string, _lockContext: ValidLock8Context): Promise<number> {
    return new Promise((resolve, reject) => {
      const createdAt = Date.now();
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
  }

  /**
   * Get all messages for a user (both read and unread)
   * Returns messages in descending order by creation time (newest first)
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async getAllMessages(userId: number, _lockContext: ValidLock8Context, limit?: number): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const query = limit 
        ? `SELECT id, recipient_id, created_at, is_read, message
           FROM messages 
           WHERE recipient_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        : `SELECT id, recipient_id, created_at, is_read, message
           FROM messages 
           WHERE recipient_id = ?
           ORDER BY created_at DESC`;
      
      const stmt = this.db.prepare(query);
      
      const callback = (err: Error | null, rows: Message[]) => {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      };
      
      if (limit) {
        stmt.all(userId, limit, callback);
      } else {
        stmt.all(userId, callback);
      }
    });
  }

  /**
   * Update the read status of a specific message
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async updateMessageReadStatus(messageId: number, isRead: boolean, _lockContext: ValidLock8Context): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE messages 
        SET is_read = ?
        WHERE id = ?
      `);
      
      stmt.run(isRead ? 1 : 0, messageId, (err: Error | null) => {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Update read status for multiple messages in a transaction
   * More efficient than calling updateMessageReadStatus multiple times
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async updateMultipleReadStatuses(updates: Array<{id: number, isRead: boolean}>, _lockContext: ValidLock8Context): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const stmt = this.db.prepare(`
          UPDATE messages 
          SET is_read = ?
          WHERE id = ?
        `);
        
        let completedCount = 0;
        let hadError = false;
        
        for (const update of updates) {
          stmt.run(update.isRead ? 1 : 0, update.id, (err: Error | null) => {
            if (err && !hadError) {
              hadError = true;
              stmt.finalize();
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            completedCount++;
            if (completedCount === updates.length && !hadError) {
              stmt.finalize();
              this.db.run('COMMIT', (commitErr: Error | null) => {
                if (commitErr) {
                  reject(commitErr);
                  return;
                }
                resolve();
              });
            }
          });
        }
        
        // Handle empty updates array
        if (updates.length === 0) {
          stmt.finalize();
          this.db.run('COMMIT', (commitErr: Error | null) => {
            if (commitErr) {
              reject(commitErr);
              return;
            }
            resolve();
          });
        }
      });
    });
  }

  /**
   * Mark all messages for a user as read
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async markAllMessagesAsRead(userId: number, _lockContext: ValidLock8Context): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE messages 
        SET is_read = 1 
        WHERE recipient_id = ? AND is_read = 0
      `);
      
      stmt.run(userId, (err: Error | null) => {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Delete old read messages (cleanup utility)
   * Returns the number of messages deleted
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async deleteOldReadMessages(olderThanDays: number, _lockContext: ValidLock8Context): Promise<number> {
    return new Promise((resolve, reject) => {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const stmt = this.db.prepare(`
        DELETE FROM messages 
        WHERE is_read = 1 AND created_at < ?
      `);
      
      stmt.run(cutoffTime, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  /**
   * Get count of unread messages for a user
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async getUnreadMessageCount(userId: number, _lockContext: ValidLock8Context): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM messages 
        WHERE recipient_id = ? AND is_read = 0
      `);
      
      stmt.get(userId, (err: Error | null, result: { count: number } | undefined) => {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(result?.count || 0);
      });
    });
  }

  /**
   * Get all unread messages for a user (without marking as read)
   * Used by MessageCache to load unread messages
   * Requires: MESSAGE_DB_LOCK (caller must hold lock)
   */
  async getUnreadMessages(userId: number, _lockContext: ValidLock8Context): Promise<UnreadMessage[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT id, created_at, message
        FROM messages 
        WHERE recipient_id = ? AND is_read = 0
        ORDER BY created_at ASC
      `);
      
      stmt.all(userId, (err: Error | null, rows: UnreadMessage[]) => {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }
}
