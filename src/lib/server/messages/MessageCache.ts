// ---
// MessageCache - Independent cache for user messages
// Uses IronGuard lock system with per-user locking
// ---

import {
  createLockContext,
  HasLock12Context,
  IronLocks,
  LOCK_12,
  LockContext,
  LocksAtMost7,
  LocksAtMostAndHas4,
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

declare global {
  var messageCacheInstance: MessageCache | null;
}

/**
 * MessageCache - Manages in-memory cache of user messages
 * - Independent from other cache systems
 * - Per-user message storage
 * - Automatic persistence to database
 * - Thread-safe with IronGuard locks
 */
export class MessageCache extends Cache {  
  private constructor() {
    super();
    console.log('📬 Message cache initialized');
  }

  private static get instance(): MessageCache | null {
    return globalThis.messageCacheInstance || null;
  }

  private static set instance(value: MessageCache | null) {
    globalThis.messageCacheInstance = value;
  }

  /**
   * Initialize the message cache
   */
  static async initialize<THeld extends IronLocks>(context: HasLock12Context<THeld>, config?: MessageCacheConfig ): Promise<void> {
    if (this.instance) {
      await this.instance.shutdown(context);
    }

    this.instance = new MessageCache();

    // Initialize database and repo
    console.log('📬 Initializing message cache...');
    this.instance!.db = await getDatabase();
    this.instance!.messagesRepo = new MessagesRepo();
    console.log('✅ Message cache initialization complete');

    if (config) {
      this.instance.config = config;
    }
    
    this.instance.startBackgroundPersistence();
  }

  static getInstance(): MessageCache {
    if (!this.instance) {
      throw new Error('MessageCache not initialized.');
    }
    return this.instance;
  }

  /**
   * Reset singleton instance (for testing)
   * WARNING: Call shutdown() and await it BEFORE calling this method to ensure clean state
   */
  static resetInstance(context: LockContext<LocksAtMost7>): void {
    if (MessageCache.instance) {
      // Note: shutdown() is async but we can't await in a sync method
      // Callers MUST call shutdown() before resetInstance()
      context.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (ctx) => {
        if (MessageCache.instance) {
          await MessageCache.instance.shutdown(ctx);
        }
      });
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
  protected persistenceTimer: NodeJS.Timeout | null = null;

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
   * Get all messages for a user from cache or database
   * Cache is the single source of truth - once loaded, always use cache
   */
  async getMessagesForUser(context: LockContext<LocksAtMost7>, userId: number): Promise<Message[]> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
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
  async getUnreadMessages(context: LockContext<LocksAtMost7>, userId: number): Promise<UnreadMessage[]> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
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
  async markAllMessagesAsRead(context: LockContext<LocksAtMost7>, userId: number): Promise<number> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
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
   * @param timestamp - Optional timestamp to use (defaults to Date.now())
   */
  private async createMessageInternal(
    context: LockContext<LocksAtMostAndHas8>,
    userId: number,
    messageText: string,
    timestamp?: number
  ): Promise<number> {
    // Ensure user's messages are loaded first (so we don't lose pending messages)
    await this.ensureMessagesLoaded(context, userId);
    
    // Generate temporary ID (negative to avoid conflicts)
    const tempId = this.nextTempId--;
    
    // Create message in cache immediately with temporary ID
    const newMessage: Message = {
      id: tempId,
      recipient_id: userId,
      created_at: timestamp ?? Date.now(),
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
  async createMessage(context: LockContext<LocksAtMost7>, userId: number, messageText: string): Promise<number> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      return await this.createMessageInternal(messageContext, userId, messageText);

    });
  }

  /**
   * Get count of unread messages for a user
   */
  async getUnreadMessageCount(context: LockContext<LocksAtMost7>, userId: number): Promise<number> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
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
  async deleteOldReadMessages(olderThanDays = 30, context: LockContext<LocksAtMost7>): Promise<number> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
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
   * Parse a previous summary message and extract its statistics
   * Returns null if the message is not a valid summary
   */
  private parsePreviousSummary(summaryText: string): {
    victories: number,
    defeats: number,
    damageDealt: number,
    damageReceived: number,
    shotsHit: number,
    shotsMissed: number,
    enemyShotsHit: number,
    enemyShotsMissed: number,
    asteroidsCollected: number,
    shipwrecksCollected: number,
    escapePodsCollected: number,
    totalIronCollected: number
  } | null {
    // Check if this is a summary message
    if (!summaryText.includes('📊') || !summaryText.includes('Message Summary')) {
      return null;
    }

    const stats = {
      victories: 0,
      defeats: 0,
      damageDealt: 0,
      damageReceived: 0,
      shotsHit: 0,
      shotsMissed: 0,
      enemyShotsHit: 0,
      enemyShotsMissed: 0,
      asteroidsCollected: 0,
      shipwrecksCollected: 0,
      escapePodsCollected: 0,
      totalIronCollected: 0
    };

    // Parse battles: "⚔️ **Battles:** X victory(ies), Y defeat(s)"
    const battleMatch = summaryText.match(/⚔️ \*\*Battles:\*\* (.+)/);
    if (battleMatch) {
      const victoriesMatch = battleMatch[1].match(/(\d+) victory\(ies\)/);
      const defeatsMatch = battleMatch[1].match(/(\d+) defeat\(s\)/);
      if (victoriesMatch) stats.victories = parseInt(victoriesMatch[1]);
      if (defeatsMatch) stats.defeats = parseInt(defeatsMatch[1]);
    }

    // Parse damage: "💥 **Damage:** Dealt X, Received Y"
    const damageMatch = summaryText.match(/💥 \*\*Damage:\*\* Dealt (\d+), Received (\d+)/);
    if (damageMatch) {
      stats.damageDealt = parseInt(damageMatch[1]);
      stats.damageReceived = parseInt(damageMatch[2]);
    }

    // Parse accuracy: "🎯 **Your Accuracy:** X/Y hits (Z%)"
    const accuracyMatch = summaryText.match(/🎯 \*\*Your Accuracy:\*\* (\d+)\/(\d+) hits/);
    if (accuracyMatch) {
      stats.shotsHit = parseInt(accuracyMatch[1]);
      const totalShots = parseInt(accuracyMatch[2]);
      stats.shotsMissed = totalShots - stats.shotsHit;
    }

    // Parse enemy accuracy: "🛡️ **Enemy Accuracy:** X/Y hits (Z%)"
    const enemyAccuracyMatch = summaryText.match(/🛡️ \*\*Enemy Accuracy:\*\* (\d+)\/(\d+) hits/);
    if (enemyAccuracyMatch) {
      stats.enemyShotsHit = parseInt(enemyAccuracyMatch[1]);
      const totalEnemyShots = parseInt(enemyAccuracyMatch[2]);
      stats.enemyShotsMissed = totalEnemyShots - stats.enemyShotsHit;
    }

    // Parse collections: "⛏️ **Collections:** X asteroid(s), Y shipwreck(s), Z escape pod(s)"
    const collectionsMatch = summaryText.match(/⛏️ \*\*Collections:\*\* (.+)/);
    if (collectionsMatch) {
      const collectionText = collectionsMatch[1].split('\n')[0]; // Get just the collection line
      const asteroidsMatch = collectionText.match(/(\d+) asteroid\(s\)/);
      const shipwrecksMatch = collectionText.match(/(\d+) shipwreck\(s\)/);
      const escapePodsMatch = collectionText.match(/(\d+) escape pod\(s\)/);
      if (asteroidsMatch) stats.asteroidsCollected = parseInt(asteroidsMatch[1]);
      if (shipwrecksMatch) stats.shipwrecksCollected = parseInt(shipwrecksMatch[1]);
      if (escapePodsMatch) stats.escapePodsCollected = parseInt(escapePodsMatch[1]);
    }

    // Parse iron collected: "💎 **Iron Collected:** X"
    const ironMatch = summaryText.match(/💎 \*\*Iron Collected:\*\* (\d+)/);
    if (ironMatch) {
      stats.totalIronCollected = parseInt(ironMatch[1]);
    }

    return stats;
  }

  /**
   * Summarize messages for a user
   * - Marks all UNREAD messages as read
   * - Parses and summarizes known message types:
   *   * Battle damage dealt: "P: ⚔️ Your **[weapon]** fired X shot(s), **Y hit** for **Z damage**!"
   *   * Battle damage received: "N: 🛡️ Enemy **[weapon]** fired X shot(s), **Y hit** you for **Z damage**!"
   *   * Missed shots (player): "Your [weapon] fired X shot(s) but all missed!"
   *   * Missed shots (enemy): "A: Enemy [weapon] fired X shot(s) but all missed!"
   *   * Victory: "P: 🎉 **Victory!** You won the battle!"
   *   * Defeat: "A: 💀 **Defeat!** You lost the battle..."
   *   * Collections: "P: Successfully collected [type] and received **X** iron."
   * - Preserves unknown messages as new unread messages with original timestamps
   * - Accumulates statistics from previous summaries to create a single comprehensive summary
   * Returns the summary message
   * 
   * IMPORTANT: Only processes unread messages to avoid re-summarizing already-read messages
   */
  async summarizeMessages(context: LockContext<LocksAtMost7>, userId: number): Promise<string> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async (messageContext) => {
      const allMessages = await this.ensureMessagesLoaded(messageContext, userId);
      
      // Filter for only unread messages - this prevents re-summarizing already-read messages
      const unreadMessages = allMessages.filter(msg => !msg.is_read);
      
      if (unreadMessages.length === 0) {
        return 'No messages to summarize.';
      }
  
      // Track statistics
      const stats = {
        damageDealt: 0,
        damageReceived: 0,
        victories: 0,
        defeats: 0,
        shotsHit: 0,
        shotsMissed: 0,
        enemyShotsHit: 0,
        enemyShotsMissed: 0,
        asteroidsCollected: 0,
        shipwrecksCollected: 0,
        escapePodsCollected: 0,
        totalIronCollected: 0,
        unknownMessages: [] as { text: string, timestamp: number }[]
      };

      // Check if there's a previous summary to accumulate
      // Mark all previous summaries as read and accumulate their values
      let previousSummaryCount = 0;
      const messagesToProcess: typeof unreadMessages = [];
      
      for (const msg of unreadMessages) {
        const previousStats = this.parsePreviousSummary(msg.message);
        if (previousStats) {
          // Accumulate values from previous summary
          stats.damageDealt += previousStats.damageDealt;
          stats.damageReceived += previousStats.damageReceived;
          stats.victories += previousStats.victories;
          stats.defeats += previousStats.defeats;
          stats.shotsHit += previousStats.shotsHit;
          stats.shotsMissed += previousStats.shotsMissed;
          stats.enemyShotsHit += previousStats.enemyShotsHit;
          stats.enemyShotsMissed += previousStats.enemyShotsMissed;
          stats.asteroidsCollected += previousStats.asteroidsCollected;
          stats.shipwrecksCollected += previousStats.shipwrecksCollected;
          stats.escapePodsCollected += previousStats.escapePodsCollected;
          stats.totalIronCollected += previousStats.totalIronCollected;
          previousSummaryCount++;
          
          // Mark the old summary as read (will be removed from cache)
          msg.is_read = true;
        } else {
          // This is not a summary, add it to processing list
          messagesToProcess.push(msg);
        }
      }

      if (previousSummaryCount > 0) {
        console.log(`📊 Accumulated statistics from ${previousSummaryCount} previous summar${previousSummaryCount === 1 ? 'y' : 'ies'}`);
      }
  
      // Process only non-summary unread messages
      for (const msg of messagesToProcess) {
        const text = msg.message;
        
        // Parse battle damage dealt (P: prefix, with "hit for X damage")
        if (text.startsWith('P:') && text.includes('hit') && text.includes('for') && text.includes('damage')) {
          const damageMatch = text.match(/\*\*(\d+)\s+hit\*\*\s+for\s+\*\*(\d+)\s+damage/);
          if (damageMatch) {
            const hits = parseInt(damageMatch[1]);
            const damage = parseInt(damageMatch[2]);
            stats.damageDealt += damage;
            stats.shotsHit += hits;
            
            // Count missed shots from this salvo
            const shotsMatch = text.match(/fired\s+(\d+)\s+shot\(s\)/);
            if (shotsMatch) {
              const totalShots = parseInt(shotsMatch[1]);
              stats.shotsMissed += (totalShots - hits);
            }
          }
        }
        // Parse battle damage received (N: prefix, with "hit you for X damage")
        else if (text.startsWith('N:') && text.includes('hit') && text.includes('you for') && text.includes('damage')) {
          const damageMatch = text.match(/\*\*(\d+)\s+hit\*\*\s+you\s+for\s+\*\*(\d+)\s+damage\*\*/);
          if (damageMatch) {
            const hits = parseInt(damageMatch[1]);
            const damage = parseInt(damageMatch[2]);
            stats.damageReceived += damage;
            stats.enemyShotsHit += hits;
            
            // Count missed shots from this salvo
            const shotsMatch = text.match(/fired\s+(\d+)\s+shot\(s\)/);
            if (shotsMatch) {
              const totalShots = parseInt(shotsMatch[1]);
              stats.enemyShotsMissed += (totalShots - hits);
            }
          }
        }
        // Parse missed shots (Your weapon)
        else if (text.includes('Your') && text.includes('but all missed!')) {
          const shotsMatch = text.match(/(\d+)\s+shot\(s\)/);
          if (shotsMatch) {
            stats.shotsMissed += parseInt(shotsMatch[1]);
          }
        }
        // Parse missed shots (Enemy weapon with A: prefix)
        else if (text.startsWith('A:') && text.includes('but all missed!')) {
          const shotsMatch = text.match(/(\d+)\s+shot\(s\)/);
          if (shotsMatch) {
            stats.enemyShotsMissed += parseInt(shotsMatch[1]);
          }
        }
        // Parse new-format escape pod commander messages:
        // "P: 🚀 Escape pod collected! Commander **X** rescued ..."
        else if (text.includes('Escape pod collected!')) {
          stats.escapePodsCollected++;
          // Commanders don't yield iron
        }
        // Parse collection messages (legacy format: "Successfully collected <type>")
        else if (text.includes('Successfully collected')) {
          const ironMatch = text.match(/received \*\*(\d+)\*\* iron/);
          const ironAmount = ironMatch ? parseInt(ironMatch[1]) : 0;
          
          // Parse asteroid collection
          if (text.includes('asteroid')) {
            stats.asteroidsCollected++;
            stats.totalIronCollected += ironAmount;
          }
          // Parse shipwreck collection
          else if (text.includes('shipwreck')) {
            stats.shipwrecksCollected++;
            stats.totalIronCollected += ironAmount;
          }
          // Parse escape pod collection (legacy: "Successfully collected escape pod.")
          else if (text.includes('escape pod')) {
            stats.escapePodsCollected++;
            // Escape pods don't give iron
          }
        }
        // Parse victory
        else if (text.includes('Victory!') || text.startsWith('P:') && text.includes('won the battle')) {
          stats.victories++;
        }
        // Parse defeat
        else if (text.includes('Defeat!') || text.startsWith('A:') && text.includes('lost the battle')) {
          stats.defeats++;
        }
        // Unknown message - preserve it
        else {
          stats.unknownMessages.push({ text, timestamp: msg.created_at });
        }
  
        // Mark as read
        msg.is_read = true;
      }
  
      // Persist read status updates to database BEFORE removing messages from cache
      // This ensures the read status is saved even though messages will be removed
      await context.useLockWithAcquire(LOCK_12, async (databaseContext) => {
        if (!this.messagesRepo) throw new Error('MessagesRepo not initialized');
        
        // Collect updates for all processed messages
        const updates: Array<{id: number, isRead: boolean}> = [];
        for (const msg of unreadMessages) {
          // Only update messages that have real IDs (not pending)
          if (!this.pendingMessageIds.has(msg.id)) {
            updates.push({
              id: msg.id,
              isRead: msg.is_read
            });
          }
        }
        
        if (updates.length > 0) {
          console.log(`📬 Persisting read status for ${updates.length} summarized message(s)`);
          await this.messagesRepo.updateMultipleReadStatuses(databaseContext, updates);
        }
      });
  
      // Remove all processed messages from cache (both summaries and regular messages)
      // All unread messages are now either: converted to summary, marked as read (summaries), or re-created as unread (unknown)
      const processedMessageIds = new Set(unreadMessages.map(m => m.id));
      this.userMessages.set(
        userId, 
        allMessages.filter(m => !processedMessageIds.has(m.id))
      );
  
      // Build summary
      const summaryParts: string[] = [];
      summaryParts.push('📊 **Message Summary**');
      
      if (stats.victories > 0 || stats.defeats > 0) {
        const battleResults: string[] = [];
        if (stats.victories > 0) battleResults.push(`${stats.victories} victory(ies)`);
        if (stats.defeats > 0) battleResults.push(`${stats.defeats} defeat(s)`);
        summaryParts.push(`⚔️ **Battles:** ${battleResults.join(', ')}`);
      }
  
      if (stats.damageDealt > 0 || stats.damageReceived > 0) {
        summaryParts.push(`💥 **Damage:** Dealt ${stats.damageDealt}, Received ${stats.damageReceived}`);
      }
  
      if (stats.shotsHit > 0 || stats.shotsMissed > 0) {
        const totalShots = stats.shotsHit + stats.shotsMissed;
        const accuracy = totalShots > 0 ? Math.round((stats.shotsHit / totalShots) * 100) : 0;
        summaryParts.push(`🎯 **Your Accuracy:** ${stats.shotsHit}/${totalShots} hits (${accuracy}%)`);
      }
  
      if (stats.enemyShotsHit > 0 || stats.enemyShotsMissed > 0) {
        const totalEnemyShots = stats.enemyShotsHit + stats.enemyShotsMissed;
        const enemyAccuracy = totalEnemyShots > 0 ? Math.round((stats.enemyShotsHit / totalEnemyShots) * 100) : 0;
        summaryParts.push(`🛡️ **Enemy Accuracy:** ${stats.enemyShotsHit}/${totalEnemyShots} hits (${enemyAccuracy}%)`);
      }
  
      if (stats.asteroidsCollected > 0 || stats.shipwrecksCollected > 0 || stats.escapePodsCollected > 0) {
        const collectionParts: string[] = [];
        if (stats.asteroidsCollected > 0) collectionParts.push(`${stats.asteroidsCollected} asteroid(s)`);
        if (stats.shipwrecksCollected > 0) collectionParts.push(`${stats.shipwrecksCollected} shipwreck(s)`);
        if (stats.escapePodsCollected > 0) collectionParts.push(`${stats.escapePodsCollected} escape pod(s)`);
        summaryParts.push(`⛏️ **Collections:** ${collectionParts.join(', ')}`);
        if (stats.totalIronCollected > 0) {
          summaryParts.push(`💎 **Iron Collected:** ${stats.totalIronCollected}`);
        }
      }
  
      const summary = summaryParts.join('\n');
  
      // Create summary as new message (using internal method that doesn't acquire lock)
      await this.createMessageInternal(messageContext, userId, summary);
  
      // Re-create unknown messages as unread with original timestamps
      for (const unknownMsg of stats.unknownMessages) {
        await this.createMessageInternal(messageContext, userId, unknownMsg.text, unknownMsg.timestamp);
      }
  
      console.log(`📊 Summarized ${unreadMessages.length} unread message(s) for user ${userId}`);
      return summary;
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(context: LockContext<LocksAtMost7>): Promise<MessageCacheStats> {
    return await context.useLockWithAcquire(MESSAGE_LOCK, async () => {
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
    await context.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (messageContext) => {
      return await this.flushToDatabaseWithLock(messageContext);
    });
  }

   /**
   * Manually flush all dirty messages to database
   */
  async flushToDatabaseWithLock<THeld extends IronLocks>(
    context:  HasLock12Context<THeld>
  ): Promise<void> {
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
  async shutdown<THeld extends IronLocks>(context:  HasLock12Context<THeld>): Promise<void> {
    console.log('📬 Shutting down message cache...');
    
    this.stopBackgroundPersistence();
    
    // Wait for pending message creations
    await this.waitForPendingWrites();
    
    // Final flush of read status updates
    if (this.dirtyUsers.size > 0) {
      console.log('📬 Final flush of dirty messages before shutdown');
      await this.flushToDatabaseWithLock(context);
    }
    
    console.log('✅ Message cache shutdown complete');

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
    userId: number, 
    messageText: string,
    createdAt?: number
  ): Promise<number> {
    return await context.useLockWithAcquire(LOCK_12, async (databaseContext) => {
      if (!this.messagesRepo) throw new Error('MessagesRepo not initialized')
      return await this.messagesRepo.createMessage(databaseContext, userId, messageText, createdAt);
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

  private async persistMessagesForUser<THeld extends IronLocks>(
    context:  HasLock12Context<THeld>,
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
    await this.messagesRepo!.updateMultipleReadStatuses(context, updates);
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

    // Insert into DB with the message's timestamp (preserves original timestamp for recreated messages)
    const realId = await this.createMessageInDb(context, userId, message.message, message.created_at);

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

  /**
   * Start background persistence timer (implements abstract method from Cache)
   */
  protected startBackgroundPersistence(): void {
    if (!this.shouldEnableBackgroundPersistence(this.config.enableAutoPersistence)) {
      console.log('📬 Message Cache background persistence disabled (test mode or config)');
      return;
    }

    console.log(`📬 Starting background persistence for Message Cache (interval: ${this.config.persistenceIntervalMs}ms)`);
    
    this.persistenceTimer = setInterval(async () => {
      try {
        const context = createLockContext();
        await context.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (messageContext) => {
          if (this.dirtyUsers.size > 0) {
            console.log(`📬 Background persisting messages for ${this.dirtyUsers.size} user(s) in Message Cache`);
            await this.flushToDatabaseWithLock(messageContext);
          }
        });
      } catch (error) {
        console.error('❌ Message persistence error:', error);
      }
    }, this.config.persistenceIntervalMs);
  }

  /**
   * Flush all dirty messages to database (implements abstract method from Cache)
   * Acquires MESSAGE_LOCK internally
   */
  protected async flushAllToDatabase(context: LockContext<LocksAtMostAndHas4>): Promise<void> {
    await context.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (messageContext) => {
      await this.flushToDatabaseWithLock(messageContext);
    });
  }
}

// Convenience function to get singleton instance (returns null if not initialized)
export function getMessageCache(): MessageCache | null {
  try {
    return MessageCache.getInstance();
  } catch {
    return null;
  }
}

// Re-export types from MessagesRepo for convenience
export type { Message, UnreadMessage } from './messagesRepo';

// Convenience functions for message operations
export async function sendMessageToUser(context: LockContext<LocksAtMost7>, userId: number, message: string): Promise<number> {
  const cache = getMessageCache();
  return await cache!.createMessage(context, userId, message);
}

export async function getUserMessages(context: LockContext<LocksAtMost7>, userId: number): Promise<UnreadMessage[]> {
  const cache = getMessageCache();
  return await cache!.getUnreadMessages(context, userId);
}

export async function markUserMessagesAsRead(context: LockContext<LocksAtMost7>, userId: number): Promise<number> {
  const cache = getMessageCache();
  return await cache!.markAllMessagesAsRead(context, userId);
}

export async function getUserMessageCount(context: LockContext<LocksAtMost7>, userId: number): Promise<number> {
  const cache = getMessageCache();
  return await cache!.getUnreadMessageCount(context, userId);
}
