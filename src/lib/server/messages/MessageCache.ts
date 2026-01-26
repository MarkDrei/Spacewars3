// ---
// MessageCache - Independent cache for user messages
// Uses IronGuard lock system with per-user locking
// ---

import {
  createLockContext,
  LOCK_12,
  LockContext,
  LocksAtMost7,
  LocksAtMostAndHas8,
} from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '../database';
import { DATABASE_LOCK_MESSAGES, MESSAGE_LOCK } from '../typedLocks';
import { MessagesRepo, type Message, type UnreadMessage } from './messagesRepo';
import { Cache } from '../caches/Cache';

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

interface BattleStats {
  damageDealt: number;
  damageReceived: number;
  victories: number;
  defeats: number;
  shotsHit: number;
  shotsMissed: number;
  enemyShotsHit: number;
  enemyShotsMissed: number;
}

interface CollectionStats {
  asteroids: number;
  asteroidsIron: number;
  shipwrecks: number;
  shipwrecksIron: number;
  escapePods: number;
  escapePodsIron: number;
}

/**
 * MessageCache - Manages in-memory cache of user messages
 * - Independent from other cache systems
 * - Per-user message storage
 * - Automatic persistence to database
 * - Thread-safe with IronGuard locks
 */
export class MessageCache extends Cache {
  private static instance: MessageCache | null = null;
  
  private constructor() {
    super();
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

  /**
   * Reset singleton instance (for testing)
   * WARNING: Call shutdown() and await it BEFORE calling this method to ensure clean state
   */
  static resetInstance(): void {
    if (MessageCache.instance) {
      // Note: shutdown() is async but we can't await in a sync method
      // Callers MUST call shutdown() before resetInstance()
      void MessageCache.instance.shutdown();
    }
    this.instance = null;
  }

  // Configuration
  private config: MessageCacheConfig = {
    persistenceIntervalMs: 30000,
    enableAutoPersistence: true
  };

  // Database connection and repo
  private db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  private messagesRepo: MessagesRepo | null = null;
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
    // Return the value from the lock callback so the outer method resolves with Message[]
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      if (this.isInitialized) {
        return; // Double-check inside lock
      }

      // need database connection
      await messageContext.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async () => {
        console.log('📬 Initializing message cache...');
        this.db = await getDatabase();
        this.messagesRepo = new MessagesRepo();
        
        this.startBackgroundPersistence(messageContext);
        
        this.isInitialized = true;
        console.log('✅ Message cache initialization complete');
      });
    });
  }

  /**
   * Get all messages for a user from cache or database
   * Cache is the single source of truth - once loaded, always use cache
   */
  async getMessagesForUser(userId: number): Promise<Message[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      // Check cache first - cache is source of truth
      if (this.userMessages.has(userId)) {
        this.stats.cacheHits++;
        return [...this.userMessages.get(userId)!]; // Return copy
      }

      // Cache miss - load from database and cache it
      this.stats.cacheMisses++;
      console.log(`📬 Loading messages for user ${userId} from database...`);
      const messages = await this.loadMessagesFromDb(messageContext, userId);
      this.userMessages.set(userId, messages);
      return [...messages];
    });
  }

  /**
   * Get unread messages for a user
   * Returns all unread messages from cache, including pending messages
   * Cache is the single source of truth
   */
  async getUnreadMessages(userId: number): Promise<UnreadMessage[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      const allMessages = await this.ensureMessagesLoaded(messageContext, userId);
      
      // Filter unread and convert to UnreadMessage format
      const unreadMessages: UnreadMessage[] = allMessages
        .filter(msg => !msg.is_read)
        .map(msg => ({
          id: msg.id,
          created_at: msg.created_at,
          message: msg.message
        }));
  
      return unreadMessages;

    });
  }

  /**
   * Mark all unread messages as read for a user
   */
  async markAllMessagesAsRead(userId: number): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      const allMessages = await this.ensureMessagesLoaded(messageContext, userId);
      
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
    });
  }

  /**
   * Internal method to create a message when already holding MESSAGE_DATA_LOCK
   * Does not acquire locks - must be called from within a lock context
   */
  private async createMessageInternal(
    context: LockContext<LocksAtMostAndHas8>,
    userId: number,
    messageText: string
  ): Promise<number> {
    // Ensure user's messages are loaded first (so we don't lose pending messages)
    await this.ensureMessagesLoaded(context, userId);
    
    // Generate temporary ID (negative to avoid conflicts)
    const tempId = this.nextTempId--;
    
    // Create message in cache immediately with temporary ID
    const newMessage: Message = {
      id: tempId,
      recipient_id: userId,
      created_at: Date.now(),
      is_read: false,
      message: messageText,
      isPending: true
    };

    // Messages are guaranteed to exist now due to ensureMessagesLoaded above
    this.userMessages.get(userId)!.push(newMessage);

    // Track as pending
    this.pendingMessageIds.add(tempId);

    console.log(`📬 Created message ${tempId} (pending) for user ${userId}`);
    
    // In test mode, persist immediately (within transaction context)
    // In production, persist asynchronously
    if (this.isTestMode) {
      await this.persistMessageAsync(context, userId, tempId, newMessage);
    } else {
      const writePromise = this.persistMessageAsync(context, userId, tempId, newMessage);
      this.pendingWrites.set(tempId, writePromise);
    }
    
    return tempId;
  }

  /**
   * Create a new message for a user
   * Message is immediately added to cache with temporary ID and persisted asynchronously
   * 
   * CRITICAL: Cache is the single source of truth
   * - Ensures messages are loaded from DB first to avoid cache miss after creation
   * - Message is immediately visible in cache (with temporary negative ID)
   * - DB write happens asynchronously, ID updated once complete
   * - No race conditions: locks ensure atomicity
   */
  async createMessage(userId: number, messageText: string): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      return await this.createMessageInternal(messageContext, userId, messageText);

    });
  }

  /**
   * Get count of unread messages for a user
   */
  async getUnreadMessageCount(userId: number): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      let messages = this.userMessages.get(userId);
      
      if (!messages) {
        // Load from database
        messages = await this.loadMessagesFromDb(messageContext, userId);
        this.userMessages.set(userId, messages);
        this.stats.cacheMisses++;
      } else {
        this.stats.cacheHits++;
      }
      
      return messages.filter(msg => !msg.is_read).length;
    });
  }

  /**
   * Delete old read messages (cleanup operation)
   */
  async deleteOldReadMessages(olderThanDays = 30): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      if (!this.db) throw new Error('Database not initialized');
      
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const deletedCount = await this.deleteOldMessagesFromDb(messageContext, cutoffTime);
      
      // Clear cache to force reload
      this.userMessages.clear();
      this.dirtyUsers.clear();
      
      console.log(`📬 Deleted ${deletedCount} old message(s)`);
      return deletedCount;

    });
  }

  /**
   * Summarize messages for a user
   * - Marks all UNREAD messages as read
   * - Parses and summarizes known message types (battle damage, victories, defeats, collections)
   * - Preserves unknown messages as new unread messages
   * Returns the summary message
   * 
   * IMPORTANT: Only processes unread messages to avoid re-summarizing already-read messages
   */
  async summarizeMessages(userId: number): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = createLockContext();

    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      const allMessages = await this.ensureMessagesLoaded(messageContext, userId);
      
      // Filter for only unread messages - this prevents re-summarizing already-read messages
      const unreadMessages = allMessages.filter(msg => !msg.is_read);
      
      if (unreadMessages.length === 0) {
        return 'No messages to summarize.';
      }
  
      // Track statistics
      const battleStats: BattleStats = {
        damageDealt: 0,
        damageReceived: 0,
        victories: 0,
        defeats: 0,
        shotsHit: 0,
        shotsMissed: 0,
        enemyShotsHit: 0,
        enemyShotsMissed: 0
      };

      const collectionStats: CollectionStats = {
        asteroids: 0,
        asteroidsIron: 0,
        shipwrecks: 0,
        shipwrecksIron: 0,
        escapePods: 0,
        escapePodsIron: 0
      };

      const unknownMessages: string[] = [];
  
      // Process only unread messages
      for (const msg of unreadMessages) {
        const text = msg.message;
        
        // Try to parse as battle message
        if (this.parseBattleMessage(text, battleStats)) {
          // Successfully parsed as battle message
        }
        // Try to parse as collection message
        else if (this.parseCollectionMessage(text, collectionStats)) {
          // Successfully parsed as collection message
        }
        // Unknown message - preserve it
        else {
          unknownMessages.push(text);
        }
  
        // Mark as read
        msg.is_read = true;
      }
  
      // Mark user as dirty for persistence
      this.dirtyUsers.add(userId);
  
      // Remove only the unread messages from cache (now marked as read and will be persisted)
      // Keep already-read messages in cache
      const readMessagesIds = new Set(unreadMessages.map(m => m.id));
      this.userMessages.set(
        userId, 
        allMessages.filter(m => !readMessagesIds.has(m.id))
      );
  
      // Build summary
      const summaryParts: string[] = ['📊 **Message Summary**'];
      
      // Add battle summary
      const battleSummary = this.buildBattleSummary(battleStats);
      summaryParts.push(...battleSummary);

      // Add collection summary
      const collectionSummary = this.buildCollectionSummary(collectionStats);
      summaryParts.push(...collectionSummary);
  
      const summary = summaryParts.join('\n');
  
      // Create summary as new message (using internal method that doesn't acquire lock)
      await this.createMessageInternal(messageContext, userId, summary);
  
      // Re-create unknown messages as unread
      for (const unknownMsg of unknownMessages) {
        await this.createMessageInternal(messageContext, userId, unknownMsg);
      }
  
      console.log(`📊 Summarized ${unreadMessages.length} unread message(s) for user ${userId}`);
      return summary;
    });
  }

  /**
   * Parse a battle message and update battle statistics
   * Returns true if the message was successfully parsed as a battle message
   */
  private parseBattleMessage(text: string, stats: BattleStats): boolean {
    // Parse battle damage dealt (P: prefix, with "hit for X damage")
    if (text.startsWith('P:') && text.includes('hit') && text.includes('for') && text.includes('damage')) {
      const damageMatch = text.match(/\*\*(\d+)\s+hit\*\*\s+for\s+\*\*(\d+)\s+damage/);
      if (damageMatch) {
        const hits = parseInt(damageMatch[1], 10);
        const damage = parseInt(damageMatch[2], 10);
        stats.damageDealt += damage;
        stats.shotsHit += hits;
        
        // Count missed shots from this salvo
        const shotsMatch = text.match(/fired\s+(\d+)\s+shot\(s\)/);
        if (shotsMatch) {
          const totalShots = parseInt(shotsMatch[1], 10);
          stats.shotsMissed += (totalShots - hits);
        }
        return true;
      }
    }
    // Parse battle damage received (N: prefix, with "hit you for X damage")
    else if (text.startsWith('N:') && text.includes('hit') && text.includes('you for') && text.includes('damage')) {
      const damageMatch = text.match(/\*\*(\d+)\s+hit\*\*\s+you\s+for\s+\*\*(\d+)\s+damage\*\*/);
      if (damageMatch) {
        const hits = parseInt(damageMatch[1], 10);
        const damage = parseInt(damageMatch[2], 10);
        stats.damageReceived += damage;
        stats.enemyShotsHit += hits;
        
        // Count missed shots from this salvo
        const shotsMatch = text.match(/fired\s+(\d+)\s+shot\(s\)/);
        if (shotsMatch) {
          const totalShots = parseInt(shotsMatch[1], 10);
          stats.enemyShotsMissed += (totalShots - hits);
        }
        return true;
      }
    }
    // Parse missed shots (Your weapon)
    else if (text.includes('Your') && text.includes('but all missed!')) {
      const shotsMatch = text.match(/(\d+)\s+shot\(s\)/);
      if (shotsMatch) {
        stats.shotsMissed += parseInt(shotsMatch[1], 10);
        return true;
      }
    }
    // Parse missed shots (Enemy weapon with A: prefix)
    else if (text.startsWith('A:') && text.includes('but all missed!')) {
      const shotsMatch = text.match(/(\d+)\s+shot\(s\)/);
      if (shotsMatch) {
        stats.enemyShotsMissed += parseInt(shotsMatch[1], 10);
        return true;
      }
    }
    // Parse victory
    else if (text.includes('Victory!') || (text.startsWith('P:') && text.includes('won the battle'))) {
      stats.victories++;
      return true;
    }
    // Parse defeat
    else if (text.includes('Defeat!') || (text.startsWith('A:') && text.includes('lost the battle'))) {
      stats.defeats++;
      return true;
    }

    return false;
  }

  /**
   * Parse a collection message and update collection statistics
   * Returns true if the message was successfully parsed as a collection message
   */
  private parseCollectionMessage(text: string, stats: CollectionStats): boolean {
    // Parse collection messages: "P: Successfully collected {type} and received **{iron}** iron."
    // or "P: Successfully collected {type}." (no iron)
    if (text.startsWith('P:') && text.includes('Successfully collected')) {
      // Extract object type - match only known collection types
      const typeMatch = text.match(/Successfully collected\s+(asteroid|shipwreck|ship\s+wreck|escape\s+pod)/i);
      if (!typeMatch) return false;

      const objectType = typeMatch[1].toLowerCase();
      
      // Extract iron amount if present
      const ironMatch = text.match(/received\s+\*\*(\d+)\*\*\s+iron/);
      const ironAmount = ironMatch ? parseInt(ironMatch[1], 10) : 0;

      // Match against known object types
      if (objectType === 'asteroid') {
        stats.asteroids++;
        stats.asteroidsIron += ironAmount;
        return true;
      } else if (objectType === 'shipwreck' || objectType === 'ship wreck') {
        stats.shipwrecks++;
        stats.shipwrecksIron += ironAmount;
        return true;
      } else if (objectType === 'escape pod') {
        stats.escapePods++;
        stats.escapePodsIron += ironAmount;
        return true;
      }
    }

    return false;
  }

  /**
   * Build battle summary text from statistics
   */
  private buildBattleSummary(stats: BattleStats): string[] {
    const parts: string[] = [];

    if (stats.victories > 0 || stats.defeats > 0) {
      const battleResults: string[] = [];
      if (stats.victories > 0) battleResults.push(`${stats.victories} victory(ies)`);
      if (stats.defeats > 0) battleResults.push(`${stats.defeats} defeat(s)`);
      parts.push(`⚔️ **Battles:** ${battleResults.join(', ')}`);
    }

    if (stats.damageDealt > 0 || stats.damageReceived > 0) {
      parts.push(`💥 **Damage:** Dealt ${stats.damageDealt}, Received ${stats.damageReceived}`);
    }

    if (stats.shotsHit > 0 || stats.shotsMissed > 0) {
      const totalShots = stats.shotsHit + stats.shotsMissed;
      const accuracy = totalShots > 0 ? Math.round((stats.shotsHit / totalShots) * 100) : 0;
      parts.push(`🎯 **Your Accuracy:** ${stats.shotsHit}/${totalShots} hits (${accuracy}%)`);
    }

    if (stats.enemyShotsHit > 0 || stats.enemyShotsMissed > 0) {
      const totalEnemyShots = stats.enemyShotsHit + stats.enemyShotsMissed;
      const enemyAccuracy = totalEnemyShots > 0 ? Math.round((stats.enemyShotsHit / totalEnemyShots) * 100) : 0;
      parts.push(`🛡️ **Enemy Accuracy:** ${stats.enemyShotsHit}/${totalEnemyShots} hits (${enemyAccuracy}%)`);
    }

    return parts;
  }

  /**
   * Build collection summary text from statistics
   */
  private buildCollectionSummary(stats: CollectionStats): string[] {
    const parts: string[] = [];
    const items: string[] = [];

    if (stats.asteroids > 0) {
      items.push(`Asteroids: ${stats.asteroids} (${stats.asteroidsIron} iron)`);
    }

    if (stats.shipwrecks > 0) {
      items.push(`Shipwrecks: ${stats.shipwrecks} (${stats.shipwrecksIron} iron)`);
    }

    if (stats.escapePods > 0) {
      items.push(`Escape Pods: ${stats.escapePods} (${stats.escapePodsIron} iron)`);
    }

    if (items.length > 0) {
      parts.push('🪨 **Collections:**');
      items.forEach(item => parts.push(`- ${item}`));
    }

    return parts;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<MessageCacheStats> {
    const ctx = createLockContext();
    return await ctx.useLockWithAcquire(MESSAGE_LOCK, async () => {
      return {
        messageCacheSize: this.userMessages.size,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        dirtyUsers: this.dirtyUsers.size
      };
    });
  }

  /**
   * Manually flush all dirty messages to database
   */
  async flushToDatabase(context: LockContext<LocksAtMost7>): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      return await this.flushToDatabaseWithLock(messageContext);
    });
  }

   /**
   * Manually flush all dirty messages to database
   */
  async flushToDatabaseWithLock(
    context: LockContext<LocksAtMostAndHas8>
  ): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    const dirtyUserIds = Array.from(this.dirtyUsers);

    if (dirtyUserIds.length === 0) {
      return;
    }

    console.log(`📬 Persisting messages for ${dirtyUserIds.length} user(s) to database...`);

    for (const userId of dirtyUserIds) {
      await this.persistMessagesForUser(context, userId);
    }

    this.dirtyUsers.clear();
    console.log('✅ Message persistence complete');
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
    ctx.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      console.log('📬 Shutting down message cache...');
      
      this.stopBackgroundPersistence();
      
      // Wait for pending message creations
      await this.waitForPendingWrites();
      
      // Final flush of read status updates
      if (this.dirtyUsers.size > 0) {
        console.log('📬 Final flush of dirty messages before shutdown');
        await this.flushToDatabaseWithLock(messageContext);
      }
      
      this.isInitialized = false;
      console.log('✅ Message cache shutdown complete');
    });
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Ensure messages are loaded for a user (from cache or DB)
   * Helper method to reduce code duplication
   */
  private async ensureMessagesLoaded(
    context: LockContext<LocksAtMostAndHas8>,
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

  private async loadMessagesFromDb(
    context: LockContext<LocksAtMostAndHas8>,
    userId: number
  ): Promise<Message[]> {
    return await context.useLockWithAcquire(LOCK_12, async (databaseContext) => {
      if (!this.messagesRepo) throw new Error('MessagesRepo not initialized')
      return await this.messagesRepo.getAllMessages(databaseContext, userId);
    });
  }

  private async createMessageInDb(
    context: LockContext<LocksAtMostAndHas8>,
    userId: number, messageText: string
  ): Promise<number> {
    return await context.useLockWithAcquire(LOCK_12, async (databaseContext) => {
      if (!this.messagesRepo) throw new Error('MessagesRepo not initialized')
      return await this.messagesRepo.createMessage(databaseContext, userId, messageText);
    });
  }

  private async deleteOldMessagesFromDb(
    context: LockContext<LocksAtMostAndHas8>,
    cutoffTime: number
  ): Promise<number> {
    const olderThanDays = Math.floor((Date.now() - cutoffTime) / (24 * 60 * 60 * 1000));
    return await context.useLockWithAcquire(LOCK_12, async (databaseContext) => {
      if (!this.messagesRepo) throw new Error('MessagesRepo not initialized')
      return await this.messagesRepo.deleteOldReadMessages(databaseContext, olderThanDays);
    });
  }

  private async persistMessagesForUser(
    context: LockContext<LocksAtMostAndHas8>,
    userId: number
  ): Promise<void> {
    const messages = this.userMessages.get(userId);
    if (!messages || !this.messagesRepo) return;

    // Collect all updates for batch processing
    const updates: Array<{id: number, isRead: boolean}> = [];
    
    for (const message of messages) {
      // Skip messages that are still being created (negative IDs)
      if (this.pendingMessageIds.has(message.id)) {
        console.log(`📬 Skipping pending message ${message.id} during persistence`);
        continue;
      }
      
      updates.push({
        id: message.id,
        isRead: message.is_read
      });
    }
    
    // Batch update all messages at once
    await context.useLockWithAcquire(LOCK_12, async (databaseContext) => {
      if (updates.length > 0) {
        await this.messagesRepo!.updateMultipleReadStatuses(databaseContext, updates);
      }
    });
  }

  /**
   * Asynchronously persist a message to the database
   * Updates the message ID once DB insertion completes
   */
  private async persistMessageAsync(
    context: LockContext<LocksAtMostAndHas8>,
    userId: number, 
    tempId: number, 
    message: Message
  ): Promise<void> {

    // Insert into DB
    const realId = await this.createMessageInDb(context, userId, message.message);

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

    } catch (error) {
      console.error(`❌ Failed to persist message ${tempId} for user ${userId}:`, error);

      const messages = this.userMessages.get(userId);
      if (messages) {
        const msgIndex = messages.findIndex(m => m.id === tempId);
        if (msgIndex !== -1) {
          messages.splice(msgIndex, 1);
          console.log(`📬 Removed failed message ${tempId} from cache`);
        }
      }
      this.pendingMessageIds.delete(tempId);
    }
  }

  private startBackgroundPersistence(context: LockContext<LocksAtMostAndHas8>): void {
    if (!this.shouldEnableBackgroundPersistence(this.config.enableAutoPersistence)) {
      console.log('📬 Background persistence disabled (test mode or config)');
      return;
    }

    console.log(`📬 Starting background persistence (interval: ${this.config.persistenceIntervalMs}ms)`);
    
    this.persistenceTimer = setInterval(async () => {
      try {
        if (this.dirtyUsers.size > 0) {
          console.log(`📬 Background persisting messages for ${this.dirtyUsers.size} user(s)`);
          await this.flushToDatabaseWithLock(context);
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

// Re-export types from MessagesRepo for convenience
export type { Message, UnreadMessage } from './messagesRepo';

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
