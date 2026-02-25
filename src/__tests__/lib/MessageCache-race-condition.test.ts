// ---
// Test for race condition fix: summarizing twice should not re-process already-read messages
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../helpers/transactionHelper';

describe('MessageCache - Race Condition Fix', () => {
  let messageCache: MessageCache;
  const testUserIds: number[] = [];

  beforeEach(async () => {
    // Clear messages from previous tests
    const { clearTestDatabase } = await import('../helpers/testDatabase');
    await clearTestDatabase();
    
    const ctx = createLockContext();
    MessageCache.resetInstance(ctx);
    await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
      await MessageCache.initialize(lockCtx, {
        persistenceIntervalMs: 30000,
        enableAutoPersistence: false
      });
    });
    messageCache = MessageCache.getInstance();
  });

  afterEach(async () => {
    try {
      await messageCache.waitForPendingWrites();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await messageCache.shutdown(lockCtx);
      });
      
      // Clean up test users
      if (testUserIds.length > 0) {
        const { getDatabase } = await import('@/lib/server/database');
        const db = await getDatabase();
        for (const userId of testUserIds) {
          await db.query('DELETE FROM messages WHERE recipient_id = $1', [userId]);
          await db.query('DELETE FROM users WHERE id = $1', [userId]);
        }
        testUserIds.length = 0;
      }
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
    const userId = result.rows[0].id;
    testUserIds.push(userId);
    return userId;
  }

  describe('Multiple summarizations', () => {
    it('doubleSummarization_afterMarkingAsRead_onlyProcessesNewMessages', async () => {
      await withTransaction(async () => {
        // Create test user
        const userId = await createTestUser('msgtest1');

      // Step 1: Create initial messages
      await messageCache.createMessage(createLockContext(), userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
      await messageCache.createMessage(createLockContext(), userId, 'N: 🛡️ Enemy **pulse laser** fired 1 shot(s), **1 hit** you for **8 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
      await messageCache.createMessage(createLockContext(), userId, 'P: 🎉 **Victory!** You won the battle! You gained 0 iron.');
      await messageCache.waitForPendingWrites();

      // Verify initial state
      const ctx = createLockContext();
      let messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(3);
      expect(messages.every(m => !m.is_read)).toBe(true);

      // Step 2: First summarization
      const summary1 = await messageCache.summarizeMessages(ctx, userId);
      await messageCache.waitForPendingWrites();
      await messageCache.flushToDatabase(ctx);

      // Verify summary contains battle stats
      expect(summary1).toContain('Message Summary');
      expect(summary1).toContain('1 victory(ies)');
      expect(summary1).toContain('Dealt 24');
      expect(summary1).toContain('Received 8');

      // Verify only summary message remains (unread)
      messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(1);
      expect(messages[0].message).toBe(summary1);
      expect(messages[0].is_read).toBe(false);

      // Step 3: Manually mark summary as read (simulating user action)
      await messageCache.markAllMessagesAsRead(ctx, userId);
      await messageCache.flushToDatabase(ctx);

      // Verify summary is now marked as read
      messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(1);
      expect(messages[0].is_read).toBe(true);

      // Step 4: Create new messages
      await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **auto turret** fired 3 shot(s), **2 hit** for **20 damage**! Enemy: Hull: 180, Armor: 0, Shield: 0');
      await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **auto turret** fired 2 shot(s), **1 hit** you for **10 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 268');
      await messageCache.waitForPendingWrites();

      // Verify we have 3 messages (1 read summary + 2 new unread)
      messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(3);
      const unreadMessages = messages.filter(m => !m.is_read);
      expect(unreadMessages.length).toBe(2);

      // Step 5: Second summarization - SHOULD ONLY PROCESS NEW UNREAD MESSAGES
      const summary2 = await messageCache.summarizeMessages(ctx, userId);
      await messageCache.waitForPendingWrites();

      // Verify second summary only contains stats from new messages
      expect(summary2).toContain('Message Summary');
      expect(summary2).toContain('Dealt 20'); // Only from new message
      expect(summary2).toContain('Received 10'); // Only from new message
      expect(summary2).not.toContain('1 victory(ies)'); // Not from old messages
      expect(summary2).not.toContain('Dealt 24'); // Not from old messages
      expect(summary2).not.toContain('Received 8'); // Not from old messages

      // Verify final state: old read summary + new summary (unread)
      messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(2);
      
      const readMessages = messages.filter(m => m.is_read);
      expect(readMessages.length).toBe(1);
      expect(readMessages[0].message).toBe(summary1); // Old summary still there as read
      
      const newUnreadMessages = messages.filter(m => !m.is_read);
      expect(newUnreadMessages.length).toBe(1);
      expect(newUnreadMessages[0].message).toBe(summary2); // New summary
      });
    });

    it('tripleeSummarization_afterMarkingAsRead_neverReprocessesOldMessages', async () => {
      await withTransaction(async () => {
        // Create test user
        const userId = await createTestUser('msgtest2');

      const ctx = createLockContext();
      // Create and summarize messages 3 times, marking as read each time
      for (let i = 1; i <= 3; i++) {
        // Create new messages
        await messageCache.createMessage(createLockContext(), userId, `P: ⚔️ Your **weapon** fired 1 shot(s), **1 hit** for **${i}0 damage**! Enemy: Hull: 100, Armor: 0, Shield: 0`);
        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();
        await messageCache.flushToDatabase(ctx);

        // Verify summary only contains current iteration's damage
        expect(summary).toContain(`Dealt ${i}0`);
        if (i > 1) {
          // Should NOT contain damage from previous iterations
          for (let j = 1; j < i; j++) {
            expect(summary).not.toContain(`Dealt ${j}0`);
          }
        }

        // Mark as read before next iteration
        await messageCache.markAllMessagesAsRead(createLockContext(), userId);
        await messageCache.flushToDatabase(createLockContext());
      }

        // Final verification: should have 3 read summaries
        const messages = await messageCache.getMessagesForUser(ctx, userId);
        expect(messages.length).toBe(3);
        expect(messages.every(m => m.is_read)).toBe(true);
      });
    });

    it('summarization_withNoUnreadMessages_returnsNoMessages', async () => {
      await withTransaction(async () => {
        // Create test user
        const userId = await createTestUser('msgtest3');

      // Create and mark messages as read
      await messageCache.createMessage(createLockContext(), userId, 'Message 1');
      await messageCache.createMessage(createLockContext(), userId, 'Message 2');
      await messageCache.waitForPendingWrites();
      await messageCache.markAllMessagesAsRead(createLockContext(), userId);
      await messageCache.flushToDatabase(createLockContext());

      const ctx = createLockContext();
      // Try to summarize with no unread messages
      const summary = await messageCache.summarizeMessages(ctx, userId);
      expect(summary).toBe('No messages to summarize.');

        // Verify no new messages created
        const messages = await messageCache.getMessagesForUser(ctx, userId);
        expect(messages.length).toBe(2); // Still just the 2 original (read) messages
        expect(messages.every(m => m.is_read)).toBe(true);
      });
    });

    it('summarization_mixedReadAndUnread_onlyProcessesUnread', async () => {
      await withTransaction(async () => {
        // Create test user
        const userId = await createTestUser('msgtest4');

      const ctx = createLockContext();

      // Create some messages and mark as read
      await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **old weapon** fired 5 shot(s), **5 hit** for **100 damage**! Enemy: Hull: 0, Armor: 0, Shield: 0');
      await messageCache.createMessage(ctx, userId, 'Already read message');
      await messageCache.waitForPendingWrites();
      await messageCache.markAllMessagesAsRead(ctx, userId);
      await messageCache.flushToDatabase(ctx);

      // Create new unread messages
      await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **new weapon** fired 1 shot(s), **1 hit** for **10 damage**! Enemy: Hull: 90, Armor: 0, Shield: 0');
      await messageCache.waitForPendingWrites();

      
      // Verify state: 2 read, 1 unread
      let messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(3);
      expect(messages.filter(m => m.is_read).length).toBe(2);
      expect(messages.filter(m => !m.is_read).length).toBe(1);

      // Summarize - should only process the 1 unread message
      const summary = await messageCache.summarizeMessages(ctx, userId);
      await messageCache.waitForPendingWrites();

      // Verify summary only contains stats from new message
      expect(summary).toContain('Dealt 10'); // Only from new message
      expect(summary).not.toContain('Dealt 100'); // Not from old message

      // Verify final state: 2 old read + 1 new unread summary
      messages = await messageCache.getMessagesForUser(ctx, userId);
      expect(messages.length).toBe(3);
      expect(messages.filter(m => m.is_read).length).toBe(2);
      expect(messages.filter(m => !m.is_read).length).toBe(1);
      });
    });
  });
});
