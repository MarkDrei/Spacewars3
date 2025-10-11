// ---
// MessagesRepo - Database operations for user messages
// ---

import sqlite3 from 'sqlite3';
import { getDatabase } from './database';

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

export class MessagesRepo {
  private db: sqlite3.Database;

  constructor(database: sqlite3.Database) {
    this.db = database;
  }

  /**
   * Create a new message for a user
   */
  createMessage(recipientId: number, message: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const createdAt = Math.floor(Date.now() / 1000);
      const stmt = this.db.prepare(`
        INSERT INTO messages (recipient_id, created_at, is_read, message)
        VALUES (?, ?, 0, ?)
      `);
      
      stmt.run(recipientId, createdAt, message, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize(); // Finalize the statement
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  /**
   * Get all unread messages for a user and mark them as read
   */
  getAndMarkUnreadMessages(userId: number): Promise<UnreadMessage[]> {
    return new Promise((resolve, reject) => {
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
          selectStmt.finalize(); // Finalize the select statement
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
            updateStmt.finalize(); // Finalize the update statement
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
  }

  /**
   * Get count of unread messages for a user (without marking them as read)
   */
  getUnreadMessageCount(userId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM messages 
        WHERE recipient_id = ? AND is_read = 0
      `);
      
      stmt.get(userId, (err: Error | null, result: { count: number } | undefined) => {
        stmt.finalize(); // Finalize the statement
        if (err) {
          reject(err);
          return;
        }
        resolve(result?.count || 0);
      });
    });
  }

  /**
   * Get all messages for a user (both read and unread)
   */
  getAllMessages(userId: number, limit = 50): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT id, recipient_id, created_at, is_read, message
        FROM messages 
        WHERE recipient_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      stmt.all(userId, limit, (err: Error | null, rows: Message[]) => {
        stmt.finalize(); // Finalize the statement
        if (err) {
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Delete old read messages (cleanup utility)
   */
  deleteOldReadMessages(olderThanDays = 30): Promise<number> {
    return new Promise((resolve, reject) => {
      const cutoffTime = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
      const stmt = this.db.prepare(`
        DELETE FROM messages 
        WHERE is_read = 1 AND created_at < ?
      `);
      
      stmt.run(cutoffTime, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize(); // Finalize the statement
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }
}

// Note: The sendMessageToUser helper function has been replaced with sendMessageToUserCached
// from typedCacheManager.ts for better performance and consistency with the cache system.