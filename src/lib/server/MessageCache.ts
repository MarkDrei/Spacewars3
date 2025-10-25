// ---
// MessageCache - Independent cache for user messages
// Uses IronGuard lock system with per-user locking
// ---

import {
  createLockContext,
  type ValidLock4Context,
  type LockLevel
} from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from './database';
import type { Message, UnreadMessage } from './messagesRepo';
import { MESSAGE_CACHE_LOCK, MESSAGE_DATA_LOCK } from './LockDefinitions';
import sqlite3 from 'sqlite3';

interface MessageCacheConfig {
  persistenceIntervalMs: number;
  enableAutoPersistence: boolean;
}

interface MessageCacheStats {
  messageCacheSize: number;
  cacheHits: number;
  cacheMisses: number;
  dirtyUsers: number;
}

/**
 * MessageCache - Manages in-memory cache of user messages
 * - Independent from other cache systems
 * - Per-user message storage
 * - Automatic persistence to database
 * - Thread-safe with IronGuard locks
 */
export class MessageCache {
  private static instance: MessageCache | null = null;
  
  private constructor() {
    console.log('📬 Message cache initialized');
  }

  static getInstance(config?: MessageCacheConfig): MessageCache {
    if (!this.instance) {
      this.instance = new MessageCache();
      if (config) {
        this.instance.config = config;
      }
    }
    return this.instance;
  }

  static resetInstance(): void {
    this.instance = null;
  }

  // Configuration
  private config: MessageCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true
  };

  // Database connection
  private db: sqlite3.Database | null = null;
  private isInitialized = false;
  private persistenceTimer: NodeJS.Timeout | null = null;

  // In-memory cache storage
  private userMessages: Map<number, Message[]> = new Map(); // userId -> messages
  private dirtyUsers: Set<number> = new Set(); // userIds with dirty messages

  // Async message creation tracking
  private nextTempId = -1; // Temporary IDs are negative to avoid conflicts
  private pendingWrites: Map<number, Promise<void>> = new Map(); // tempId -> write promise
  private pendingMessageIds: Set<number> = new Set(); // Track temp IDs being written

  // Statistics
  private stats = {
    cacheHits: 0,
    cacheMisses: 0
  };

  /**
   * Initialize the message cache
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const ctx = createLockContext();
    const cacheCtx = await ctx.acquireWrite(MESSAGE_CACHE_LOCK);
    
    try {
      if (this.isInitialized) {
        return; // Double-check inside lock
      }

      console.log('📬 Initializing message cache...');
      this.db = await getDatabase();
      
      this.startBackgroundPersistence();
      
      this.isInitialized = true;
      console.log('✅ Message cache initialization complete');
    } finally {
      cacheCtx.dispose();
    }
  }

  /**
   * Get all messages for a user from cache or database
   */
  async getMessagesForUser(userId: number): Promise<Message[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      // Check cache first
      if (this.userMessages.has(userId)) {
        this.stats.cacheHits++;
        return [...this.userMessages.get(userId)!]; // Return copy
      }

      // Cache miss - load from database
      this.stats.cacheMisses++;
      console.log(`📬 Loading messages for user ${userId} from database...`);
      const messages = await this.loadMessagesFromDb(dataCtx, userId);
      this.userMessages.set(userId, messages);
      return [...messages];
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Get unread messages for a user without marking them as read
   */
  async getUnreadMessages(userId: number): Promise<UnreadMessage[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      const allMessages = await this.ensureMessagesLoaded(dataCtx, userId);
      
      // Filter unread and convert to UnreadMessage format
      const unreadMessages: UnreadMessage[] = allMessages
        .filter(msg => !msg.is_read)
        .map(msg => ({
          id: msg.id,
          created_at: msg.created_at,
          message: msg.message
        }));

      return unreadMessages;
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Mark all unread messages as read for a user
   */
  async markAllMessagesAsRead(userId: number): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      const allMessages = await this.ensureMessagesLoaded(dataCtx, userId);
      
      // Count unread messages
      let markedCount = 0;
      
      // Mark as read in cache
      allMessages.forEach(msg => {
        if (!msg.is_read) {
          msg.is_read = true;
          markedCount++;
        }
      });

      // Mark user as dirty for persistence
      if (markedCount > 0) {
        this.dirtyUsers.add(userId);
        console.log(`📬 Marked ${markedCount} message(s) as read for user ${userId}`);
      }

      return markedCount;
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Get unread messages for a user and mark them as read
   * @deprecated Use getUnreadMessages() and markAllMessagesAsRead() separately
   */
  async getAndMarkUnreadMessages(userId: number): Promise<UnreadMessage[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      // Get all messages (will load from DB if not cached)
      let allMessages = this.userMessages.get(userId);
      
      if (!allMessages) {
        // Load from database
        console.log(`📬 Loading messages for user ${userId} from database...`);
        allMessages = await this.loadMessagesFromDb(dataCtx, userId);
        this.userMessages.set(userId, allMessages);
        this.stats.cacheMisses++;
      } else {
        this.stats.cacheHits++;
      }
      
      // Filter unread and convert to UnreadMessage format
      const unreadMessages: UnreadMessage[] = allMessages
        .filter(msg => !msg.is_read)
        .map(msg => ({
          id: msg.id,
          created_at: msg.created_at,
          message: msg.message
        }));

      // Mark as read in cache
      allMessages.forEach(msg => {
        if (!msg.is_read) {
          msg.is_read = true;
        }
      });

      // Mark user as dirty for persistence
      if (unreadMessages.length > 0) {
        this.dirtyUsers.add(userId);
        console.log(`📬 Marked ${unreadMessages.length} message(s) as read for user ${userId}`);
      }

      return unreadMessages;
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Create a new message for a user
   * Message is immediately cached with temporary ID and persisted asynchronously
   */
  async createMessage(userId: number, messageText: string): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      // Generate temporary ID (negative to avoid conflicts)
      const tempId = this.nextTempId--;
      
      // Create message in cache immediately with temporary ID
      const newMessage: Message = {
        id: tempId,
        recipient_id: userId,
        created_at: Math.floor(Date.now() / 1000),
        is_read: false,
        message: messageText,
        isPending: true
      };

      if (this.userMessages.has(userId)) {
        this.userMessages.get(userId)!.push(newMessage);
      } else {
        this.userMessages.set(userId, [newMessage]);
      }

      // Track as pending
      this.pendingMessageIds.add(tempId);

      console.log(`📬 Created message ${tempId} (pending) for user ${userId}`);
      
      // Start async DB insertion (don't await)
      const writePromise = this.persistMessageAsync(userId, tempId, newMessage);
      this.pendingWrites.set(tempId, writePromise);
      
      return tempId;
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Get count of unread messages for a user
   */
  async getUnreadMessageCount(userId: number): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      let messages = this.userMessages.get(userId);
      
      if (!messages) {
        // Load from database
        messages = await this.loadMessagesFromDb(dataCtx, userId);
        this.userMessages.set(userId, messages);
        this.stats.cacheMisses++;
      } else {
        this.stats.cacheHits++;
      }
      
      return messages.filter(msg => !msg.is_read).length;
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Delete old read messages (cleanup operation)
   */
  async deleteOldReadMessages(olderThanDays = 30): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      if (!this.db) throw new Error('Database not initialized');
      
      const cutoffTime = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
      const deletedCount = await this.deleteOldMessagesFromDb(cutoffTime);
      
      // Clear cache to force reload
      this.userMessages.clear();
      this.dirtyUsers.clear();
      
      console.log(`📬 Deleted ${deletedCount} old message(s)`);
      return deletedCount;
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<MessageCacheStats> {
    const ctx = createLockContext();
    const dataCtx = await ctx.acquireRead(MESSAGE_DATA_LOCK);
    
    try {
      return {
        messageCacheSize: this.userMessages.size,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        dirtyUsers: this.dirtyUsers.size
      };
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Manually flush all dirty messages to database
   */
  async flushToDatabase(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const ctx = createLockContext();
    const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
    
    try {
      const dirtyUserIds = Array.from(this.dirtyUsers);
      
      if (dirtyUserIds.length === 0) {
        return;
      }
      
      console.log(`📬 Persisting messages for ${dirtyUserIds.length} user(s) to database...`);
      
      for (const userId of dirtyUserIds) {
        await this.persistMessagesForUser(dataCtx, userId);
      }
      
      this.dirtyUsers.clear();
      console.log('✅ Message persistence complete');
    } finally {
      dataCtx.dispose();
    }
  }

  /**
   * Wait for all pending writes to complete
   * Useful before shutdown or testing
   */
  async waitForPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    
    console.log(`📬 Waiting for ${this.pendingWrites.size} pending message write(s)...`);
    await Promise.all(Array.from(this.pendingWrites.values()));
    console.log('✅ All pending message writes complete');
  }

  /**
   * Shutdown the message cache
   */
  async shutdown(): Promise<void> {
    const ctx = createLockContext();
    const cacheCtx = await ctx.acquireWrite(MESSAGE_CACHE_LOCK);
    
    try {
      console.log('📬 Shutting down message cache...');
      
      this.stopBackgroundPersistence();
      
      // Wait for pending message creations
      await this.waitForPendingWrites();
      
      // Final flush of read status updates
      if (this.dirtyUsers.size > 0) {
        console.log('📬 Final flush of dirty messages before shutdown');
        await this.flushToDatabase();
      }
      
      this.isInitialized = false;
      console.log('✅ Message cache shutdown complete');
    } finally {
      cacheCtx.dispose();
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Ensure messages are loaded for a user (from cache or DB)
   * Helper method to reduce code duplication
   */
  private async ensureMessagesLoaded<THeld extends readonly LockLevel[]>(
    context: ValidLock4Context<THeld> extends string ? never : ValidLock4Context<THeld>,
    userId: number
  ): Promise<Message[]> {
    let allMessages = this.userMessages.get(userId);
    
    if (!allMessages) {
      // Load from database
      console.log(`📬 Loading messages for user ${userId} from database...`);
      allMessages = await this.loadMessagesFromDb(context, userId);
      this.userMessages.set(userId, allMessages);
      this.stats.cacheMisses++;
    } else {
      this.stats.cacheHits++;
    }
    
    return allMessages;
  }

  private async loadMessagesFromDb<THeld extends readonly LockLevel[]>(
    context: ValidLock4Context<THeld> extends string ? never : ValidLock4Context<THeld>,
    userId: number
  ): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
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
  }

  private async createMessageInDb(userId: number, messageText: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const createdAt = Math.floor(Date.now() / 1000);
      const stmt = this.db!.prepare(`
        INSERT INTO messages (recipient_id, created_at, is_read, message)
        VALUES (?, ?, 0, ?)
      `);
      
      stmt.run(userId, createdAt, messageText, function(this: sqlite3.RunResult, err: Error | null) {
        stmt.finalize();
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  private async deleteOldMessagesFromDb(cutoffTime: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
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

  private async persistMessagesForUser<THeld extends readonly LockLevel[]>(
    context: ValidLock4Context<THeld> extends string ? never : ValidLock4Context<THeld>,
    userId: number
  ): Promise<void> {
    const messages = this.userMessages.get(userId);
    if (!messages || !this.db) return;

    // Update all messages for this user in the database
    for (const message of messages) {
      // Skip messages that are still being created (negative IDs)
      if (this.pendingMessageIds.has(message.id)) {
        console.log(`📬 Skipping pending message ${message.id} during persistence`);
        continue;
      }
      
      await new Promise<void>((resolve, reject) => {
        const stmt = this.db!.prepare(`
          UPDATE messages 
          SET is_read = ?
          WHERE id = ?
        `);
        
        stmt.run(message.is_read ? 1 : 0, message.id, (err: Error | null) => {
          stmt.finalize();
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Asynchronously persist a message to the database
   * Updates the message ID once DB insertion completes
   */
  private async persistMessageAsync(
    userId: number, 
    tempId: number, 
    message: Message
  ): Promise<void> {
    try {
      // Insert into DB
      const realId = await this.createMessageInDb(userId, message.message);
      
      // Update cache with real ID
      const ctx = createLockContext();
      const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
      
      try {
        const messages = this.userMessages.get(userId);
        if (messages) {
          const msgIndex = messages.findIndex(m => m.id === tempId);
          if (msgIndex !== -1) {
            const currentReadStatus = messages[msgIndex].is_read; // Preserve current state
            
            messages[msgIndex].id = realId;
            messages[msgIndex].isPending = false;
            
            // If read status changed during insertion, mark user as dirty
            if (currentReadStatus !== false) {
              console.log(`📬 Message ${realId} was marked as read during insertion`);
              this.dirtyUsers.add(userId);
            }
            
            console.log(`📬 Updated message ID from ${tempId} to ${realId} for user ${userId}`);
          }
        }
        
        // Remove from pending tracking
        this.pendingMessageIds.delete(tempId);
      } finally {
        dataCtx.dispose();
        this.pendingWrites.delete(tempId);
      }
    } catch (error) {
      console.error(`❌ Failed to persist message ${tempId} for user ${userId}:`, error);
      
      // Remove failed message from cache
      const ctx = createLockContext();
      const dataCtx = await ctx.acquireWrite(MESSAGE_DATA_LOCK);
      
      try {
        const messages = this.userMessages.get(userId);
        if (messages) {
          const msgIndex = messages.findIndex(m => m.id === tempId);
          if (msgIndex !== -1) {
            messages.splice(msgIndex, 1);
            console.log(`📬 Removed failed message ${tempId} from cache`);
          }
        }
        this.pendingMessageIds.delete(tempId);
      } finally {
        dataCtx.dispose();
        this.pendingWrites.delete(tempId);
      }
    }
  }

  private startBackgroundPersistence(): void {
    if (!this.config.enableAutoPersistence) {
      console.log('📬 Background persistence disabled by config');
      return;
    }

    console.log(`📬 Starting background persistence (interval: ${this.config.persistenceIntervalMs}ms)`);
    
    this.persistenceTimer = setInterval(async () => {
      try {
        if (this.dirtyUsers.size > 0) {
          console.log(`📬 Background persisting messages for ${this.dirtyUsers.size} user(s)`);
          await this.flushToDatabase();
        }
      } catch (error) {
        console.error('❌ Message persistence error:', error);
      }
    }, this.config.persistenceIntervalMs);
  }

  private stopBackgroundPersistence(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
      console.log('📬 Background persistence stopped');
    }
  }
}

// Convenience function to get singleton instance
export function getMessageCache(config?: MessageCacheConfig): MessageCache {
  return MessageCache.getInstance(config);
}

// Convenience functions for message operations
export async function sendMessageToUser(userId: number, message: string): Promise<number> {
  const cache = getMessageCache();
  return await cache.createMessage(userId, message);
}

export async function getUserMessages(userId: number): Promise<UnreadMessage[]> {
  const cache = getMessageCache();
  return await cache.getUnreadMessages(userId);
}

export async function markUserMessagesAsRead(userId: number): Promise<number> {
  const cache = getMessageCache();
  return await cache.markAllMessagesAsRead(userId);
}

export async function getUserMessageCount(userId: number): Promise<number> {
  const cache = getMessageCache();
  return await cache.getUnreadMessageCount(userId);
}
