import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../helpers/transactionHelper';
import { MessagesRepo } from '@/lib/server/messages/messagesRepo';

describe('MessageCache - Persistence After Summarization', () => {
  let messageCache: MessageCache;

  beforeEach(async () => {
    // Clear messages from previous tests
    const { clearTestDatabase } = await import('../helpers/testDatabase');
    await clearTestDatabase();
    
    const ctx = createLockContext();
    MessageCache.resetInstance(ctx);
    await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
      await MessageCache.initialize(lockCtx, {
        persistenceIntervalMs: 30000,
        enableAutoPersistence: false // Disable auto-persistence to avoid background timers
      });
    });
    messageCache = MessageCache.getInstance();
  });

  afterEach(async () => {
    try {
      // Ensure all pending writes complete before shutdown
      await messageCache.waitForPendingWrites();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await messageCache.shutdown(lockCtx);
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

  async function createTestUser(username: string): Promise<number> {
    const { getDatabase } = await import('@/lib/server/database');
    const db = await getDatabase();
    const result = await db.query(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, 'hash', 0, Math.floor(Date.now() / 1000), '{}']
    );
    return result.rows[0].id;
  }

  it('messageSummarization_afterRestart_summarizedMessagesStayRead', async () => {
    await withTransaction(async () => {
      const userId = await createTestUser('persist_test');
      const ctx = createLockContext();

      // Create some battle messages
      await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
      await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **pulse laser** fired 1 shot(s), **1 hit** you for **8 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
      await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Verify we have 3 unread messages
      const messagesBefore = await messageCache.getMessagesForUser(ctx, userId);
      expect(messagesBefore.length).toBe(3);
      expect(messagesBefore.filter(m => !m.is_read).length).toBe(3);

      // Summarize messages
      const summary = await messageCache.summarizeMessages(ctx, userId);
      expect(summary).toContain('Message Summary');

      // Wait for summary message to be created
      await messageCache.waitForPendingWrites();

      // Verify we now have 1 unread message (the summary)
      const messagesAfterSummary = await messageCache.getMessagesForUser(ctx, userId);
      expect(messagesAfterSummary.length).toBe(1);
      expect(messagesAfterSummary[0].message).toBe(summary);
      expect(messagesAfterSummary[0].is_read).toBe(false);

      // Simulate app restart: shutdown cache and reinitialize
      await messageCache.shutdown(ctx);
      
      // Clear the singleton to force reinitialization
      MessageCache.resetInstance(ctx);
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await MessageCache.initialize(lockCtx, {
          persistenceIntervalMs: 30000,
          enableAutoPersistence: false
        });
      });
      messageCache = MessageCache.getInstance();

      // Load messages from database (simulating fresh start)
      // Use getAllMessages directly from repo to check database state
      const messagesRepo = new MessagesRepo();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        const allDbMessages = await messagesRepo.getAllMessages(lockCtx, userId);
        
        // Should have 4 messages total in DB: 3 original (read) + 1 summary (unread)
        expect(allDbMessages.length).toBe(4);
        
        // Check that the 3 original messages are marked as read in DB
        const originalMessages = allDbMessages.filter(m => !m.message.includes('Message Summary'));
        expect(originalMessages.length).toBe(3);
        originalMessages.forEach(msg => {
          expect(msg.is_read).toBe(true); // This is the critical assertion - they should be read!
        });
        
        // Check that the summary is unread
        const summaryMessage = allDbMessages.find(m => m.message.includes('Message Summary'));
        expect(summaryMessage).toBeDefined();
        expect(summaryMessage!.is_read).toBe(false);
      });

      // Get unread messages through cache (which filters by is_read = false)
      const unreadAfterRestart = await messageCache.getUnreadMessages(ctx, userId);
      
      // Should only have 1 unread message (the summary)
      // The 3 original messages should NOT reappear because they're marked as read in DB
      expect(unreadAfterRestart.length).toBe(1);
      expect(unreadAfterRestart[0].message).toBe(summary);
    });
  });

  it('messageSummarization_withUnknownMessages_persistsReadStatusCorrectly', async () => {
    await withTransaction(async () => {
      const userId = await createTestUser('persist_test2');
      const ctx = createLockContext();

      // Create battle messages and unknown messages
      await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
      await messageCache.createMessage(ctx, userId, 'This is a custom message');
      await messageCache.createMessage(ctx, userId, 'Another custom message');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Summarize messages
      await messageCache.summarizeMessages(ctx, userId);
      await messageCache.waitForPendingWrites();

      // Simulate app restart
      await messageCache.shutdown(ctx);
      MessageCache.resetInstance(ctx);
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await MessageCache.initialize(lockCtx, {
          persistenceIntervalMs: 30000,
          enableAutoPersistence: false
        });
      });
      messageCache = MessageCache.getInstance();

      // Check database state
      const messagesRepo = new MessagesRepo();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        const allDbMessages = await messagesRepo.getAllMessages(lockCtx, userId);
        
        // Should have 5 messages: 3 original (1 battle read, 2 unknown read) + 1 summary (unread) + 2 unknown re-created (unread)
        expect(allDbMessages.length).toBe(5);
        
        // The original battle message should be marked as read
        const originalBattleMsg = allDbMessages.find(m => 
          m.message.includes('pulse laser') && 
          !m.message.includes('Message Summary')
        );
        expect(originalBattleMsg).toBeDefined();
        expect(originalBattleMsg!.is_read).toBe(true);
      });

      // Get unread messages
      const unreadAfterRestart = await messageCache.getUnreadMessages(ctx, userId);
      
      // Should have 3 unread: 1 summary + 2 unknown messages
      expect(unreadAfterRestart.length).toBe(3);
      expect(unreadAfterRestart.some(m => m.message.includes('Message Summary'))).toBe(true);
      expect(unreadAfterRestart.some(m => m.message.includes('custom message'))).toBe(true);
    });
  });

  it('markAllAsRead_afterRestart_messagesStayRead', async () => {
    await withTransaction(async () => {
      const userId = await createTestUser('mark_read_test');
      const ctx = createLockContext();

      // Create some messages
      await messageCache.createMessage(ctx, userId, 'Test message 1');
      await messageCache.createMessage(ctx, userId, 'Test message 2');
      await messageCache.createMessage(ctx, userId, 'Test message 3');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Mark all as read
      const markedCount = await messageCache.markAllMessagesAsRead(ctx, userId);
      expect(markedCount).toBe(3);

      // Flush to database
      await messageCache.flushToDatabase(ctx);

      // Simulate app restart
      await messageCache.shutdown(ctx);
      MessageCache.resetInstance(ctx);
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await MessageCache.initialize(lockCtx, {
          persistenceIntervalMs: 30000,
          enableAutoPersistence: false
        });
      });
      messageCache = MessageCache.getInstance();

      // Check that messages are still read after restart
      const unreadAfterRestart = await messageCache.getUnreadMessages(ctx, userId);
      expect(unreadAfterRestart.length).toBe(0); // All messages should be read
    });
  });
});
