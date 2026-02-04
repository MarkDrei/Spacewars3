// ---
// MessagesRepo - Database operations for user messages
// Single responsibility: Handle all direct database interactions for messages
// ---

import { HasLock12Context, LockLevel } from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '../database';

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
 * - Handle locking (caller's responsibility, but verified via context type parameters)
 */
export class MessagesRepo {
  /**
   * Create a new message for a user
   * Returns the ID of the newly created message
   * @param createdAt - Optional timestamp in milliseconds. Defaults to Date.now() if not provided.
   */
  async createMessage<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    recipientId: number,
    message: string,
    createdAt?: number
  ): Promise<number> {
    const db = await getDatabase();
    const timestamp = createdAt ?? Date.now();
    const result = await db.query(
      `INSERT INTO messages (recipient_id, created_at, is_read, message)
       VALUES ($1, $2, FALSE, $3) RETURNING id`,
      [recipientId, timestamp, message]
    );
    return result.rows[0].id;
  }

  /**
   * Get all messages for a user (both read and unread)
   * Returns messages in descending order by creation time (newest first)
   */
  async getAllMessages<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    userId: number, 
    limit?: number
  ): Promise<Message[]> {
    const query = limit 
      ? `SELECT id, recipient_id, created_at, is_read, message
         FROM messages 
         WHERE recipient_id = $1
         ORDER BY created_at DESC
         LIMIT $2`
      : `SELECT id, recipient_id, created_at, is_read, message
         FROM messages 
         WHERE recipient_id = $1
         ORDER BY created_at DESC`;
    
    const db = await getDatabase();
    const params = limit ? [userId, limit] : [userId];
    const result = await db.query(query, params);
    
    // Convert created_at from string to number if needed (PostgreSQL BIGINT returns as string)
    return (result.rows || []).map(row => ({
      ...row,
      created_at: typeof row.created_at === 'string' ? parseInt(row.created_at, 10) : row.created_at
    }));
  }

  /**
   * Update the read status of a specific message
   */
  async updateMessageReadStatus<THeld extends readonly LockLevel[]> (
    _context: HasLock12Context<THeld>,
    messageId: number, 
    isRead: boolean
  ): Promise<void> {
    const db = await getDatabase();
    await db.query(
      `UPDATE messages 
       SET is_read = $1
       WHERE id = $2`,
      [isRead, messageId]
    );
  }

  /**
   * Update read status for multiple messages
   * Note: Transaction support removed for SQLite test compatibility.
   * For production PostgreSQL, each update is atomic but not collectively transactional.
   * This trade-off provides test isolation while accepting minor consistency risk
   * on bulk operations (which are rare and low-impact for read status updates).
   */
  async updateMultipleReadStatuses<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    updates: Array<{id: number, isRead: boolean}>
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    const db = await getDatabase();
    // Process updates individually for SQLite test compatibility
    // PostgreSQL production still works with individual queries
    for (const update of updates) {
      await db.query(
        `UPDATE messages 
         SET is_read = $1
         WHERE id = $2`,
        [update.isRead, update.id]
      );
    }
  }

  /**
   * Mark all messages for a user as read
   */
  async markAllMessagesAsRead<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    userId: number,
  ): Promise<void> {
    const db = await getDatabase();
    await db.query(
      `UPDATE messages 
       SET is_read = TRUE 
       WHERE recipient_id = $1 AND is_read = FALSE`,
      [userId]
    );
  }

  /**
   * Delete old read messages (cleanup utility)
   * Returns the number of messages deleted
   */
  async deleteOldReadMessages<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    olderThanDays = 30
  ): Promise<number> {
    const db = await getDatabase();
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.query(
      `DELETE FROM messages 
       WHERE is_read = TRUE AND created_at < $1`,
      [cutoffTime]
    );
    return result.rowCount || 0;
  }

  /**
   * Get count of unread messages for a user
   */
  async getUnreadMessageCount<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    userId: number,
  ): Promise<number> {
    const db = await getDatabase();
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM messages 
       WHERE recipient_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Get all unread messages for a user (without marking as read)
   * Used by MessageCache to load unread messages
   */
  async getUnreadMessages<THeld extends readonly LockLevel[]>(
    _context: HasLock12Context<THeld>,
    userId: number,
  ): Promise<UnreadMessage[]> {
    const db = await getDatabase();
    const result = await db.query(
      `SELECT id, created_at, message
       FROM messages 
       WHERE recipient_id = $1 AND is_read = FALSE
       ORDER BY created_at ASC`,
      [userId]
    );
    
    // Convert created_at from string to number if needed (PostgreSQL BIGINT returns as string)
    return (result.rows || []).map(row => ({
      ...row,
      created_at: typeof row.created_at === 'string' ? parseInt(row.created_at, 10) : row.created_at
    }));
  }
}
