import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../helpers/transactionHelper';

/**
 * Tests for summary accumulation - ensuring that multiple summarize calls
 * accumulate statistics instead of creating separate summaries
 */
describe('MessageCache - Summary Accumulation', () => {
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

  describe('Collection Summary Accumulation', () => {
    it('collectionAccumulation_twoSummarizations_combinedCounts', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('accum1');
        const ctx = createLockContext();

        // First batch of collections
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **150** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **300** iron.');

        await messageCache.waitForPendingWrites();

        // First summarization
        const summary1 = await messageCache.summarizeMessages(ctx, userId);
        console.log('First Summary:', summary1);

        expect(summary1).toContain('📊 **Message Summary**');
        expect(summary1).toContain('2 asteroid(s)');
        expect(summary1).toContain('1 shipwreck(s)');
        expect(summary1).toContain('550'); // 100 + 150 + 300

        await messageCache.waitForPendingWrites();

        // Second batch of collections
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **200** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **400** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');

        await messageCache.waitForPendingWrites();

        // Second summarization - should accumulate with first
        const summary2 = await messageCache.summarizeMessages(ctx, userId);
        console.log('Second Summary:', summary2);

        expect(summary2).toContain('📊 **Message Summary**');
        expect(summary2).toContain('3 asteroid(s)'); // 2 + 1
        expect(summary2).toContain('2 shipwreck(s)'); // 1 + 1
        expect(summary2).toContain('1 escape pod(s)'); // 0 + 1
        expect(summary2).toContain('1150'); // 550 + 600

        await messageCache.waitForPendingWrites();

        // Verify only one summary message remains
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
        expect(messagesAfter[0].message).toContain('📊 **Message Summary**');
        expect(messagesAfter[0].message).toContain('3 asteroid(s)');
      });
    });

    it('collectionAccumulation_threeSummarizations_allAccumulated', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('accum2');
        const ctx = createLockContext();

        // First batch
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **50** iron.');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Second batch
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **75** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Third batch
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **125** iron.');
        await messageCache.waitForPendingWrites();
        const summary3 = await messageCache.summarizeMessages(ctx, userId);

        console.log('Third Summary:', summary3);

        // Should accumulate all three batches: 1 + 2 + 1 = 4 asteroids
        expect(summary3).toContain('4 asteroid(s)');
        expect(summary3).toContain('350'); // 50 + 75 + 100 + 125

        await messageCache.waitForPendingWrites();

        // Verify only one summary message remains
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
      });
    });

    it('collectionAccumulation_mixedTypes_correctAccumulation', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('accum3');
        const ctx = createLockContext();

        // First batch: asteroids and shipwrecks
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Second batch: more asteroids and escape pods
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **200** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');
        await messageCache.waitForPendingWrites();
        const summary2 = await messageCache.summarizeMessages(ctx, userId);

        console.log('Accumulated Summary:', summary2);

        expect(summary2).toContain('2 asteroid(s)'); // 1 + 1
        expect(summary2).toContain('1 shipwreck(s)'); // 1 + 0
        expect(summary2).toContain('2 escape pod(s)'); // 0 + 2
        expect(summary2).toContain('800'); // 600 + 200
      });
    });
  });

  describe('Battle Summary Accumulation', () => {
    it('battleAccumulation_twoSummarizations_combinedStats', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('battle1');
        const ctx = createLockContext();

        // First battle
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 10 shot(s), **8 hit** for **64 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **pulse laser** fired 5 shot(s), **3 hit** you for **24 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Second battle
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **4 hit** for **32 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **pulse laser** fired 6 shot(s), **2 hit** you for **16 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
        await messageCache.waitForPendingWrites();
        const summary2 = await messageCache.summarizeMessages(ctx, userId);

        console.log('Accumulated Battle Summary:', summary2);

        expect(summary2).toContain('2 victory(ies)'); // 1 + 1
        expect(summary2).toContain('Dealt 96'); // 64 + 32
        expect(summary2).toContain('Received 40'); // 24 + 16
        expect(summary2).toContain('12/15 hits'); // (8+4)/(10+5)
        expect(summary2).toContain('5/11 hits'); // (3+2)/(5+6)
      });
    });

    it('battleAccumulation_victoriesAndDefeats_bothAccumulated', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('battle2');
        const ctx = createLockContext();

        // First battle - victory
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Second battle - defeat
        await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **pulse laser** fired 8 shot(s), **6 hit** you for **48 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
        await messageCache.createMessage(ctx, userId, 'A: 💀 **Defeat!** You lost the battle...');
        await messageCache.waitForPendingWrites();
        const summary2 = await messageCache.summarizeMessages(ctx, userId);

        console.log('Victory+Defeat Summary:', summary2);

        expect(summary2).toContain('1 victory(ies), 1 defeat(s)');
        expect(summary2).toContain('Dealt 24');
        expect(summary2).toContain('Received 48');
      });
    });

    it('battleAccumulation_multipleSummarizations_allAccumulated', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('battle3');
        const ctx = createLockContext();

        // Three separate battles with summarization after each
        for (let i = 0; i < 3; i++) {
          await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
          await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **pulse laser** fired 4 shot(s), **2 hit** you for **16 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
          await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
          await messageCache.waitForPendingWrites();
          await messageCache.summarizeMessages(ctx, userId);
          await messageCache.waitForPendingWrites();
        }

        // Verify final accumulated summary
        const messages = await messageCache.getMessagesForUser(ctx, userId);
        expect(messages.length).toBe(1);
        
        const finalSummary = messages[0].message;
        console.log('Final Accumulated Summary:', finalSummary);

        expect(finalSummary).toContain('3 victory(ies)'); // 1 + 1 + 1
        expect(finalSummary).toContain('Dealt 72'); // 24 * 3
        expect(finalSummary).toContain('Received 48'); // 16 * 3
      });
    });
  });

  describe('Mixed Summary Accumulation', () => {
    it('mixedAccumulation_battleAndCollection_bothAccumulated', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('mixed1');
        const ctx = createLockContext();

        // First batch: battle
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Second batch: collections
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.waitForPendingWrites();
        const summary2 = await messageCache.summarizeMessages(ctx, userId);

        console.log('Mixed Summary:', summary2);

        // Should have both battle and collection stats
        expect(summary2).toContain('1 victory(ies)');
        expect(summary2).toContain('Dealt 24');
        expect(summary2).toContain('1 asteroid(s)');
        expect(summary2).toContain('1 shipwreck(s)');
        expect(summary2).toContain('600');
      });
    });

    it('mixedAccumulation_alternatingTypes_allAccumulated', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('mixed2');
        const ctx = createLockContext();

        // Alternate between battles and collections
        // Battle 1
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Collection 1
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Battle 2
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 6 shot(s), **4 hit** for **32 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle!');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Collection 2
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.waitForPendingWrites();
        const finalSummary = await messageCache.summarizeMessages(ctx, userId);

        console.log('Final Alternating Summary:', finalSummary);

        expect(finalSummary).toContain('2 victory(ies)');
        expect(finalSummary).toContain('Dealt 56'); // 24 + 32
        expect(finalSummary).toContain('1 asteroid(s)');
        expect(finalSummary).toContain('1 shipwreck(s)');
        expect(finalSummary).toContain('600'); // 100 + 500

        // Verify only one summary exists
        const messages = await messageCache.getMessagesForUser(ctx, userId);
        expect(messages.length).toBe(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('edgeCase_emptySummary_noChange', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('edge1');
        const ctx = createLockContext();

        // Create a summary with some stats
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Mark the summary as read
        await messageCache.markAllMessagesAsRead(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Try to summarize again with no new unread messages
        const summary2 = await messageCache.summarizeMessages(ctx, userId);
        expect(summary2).toBe('No messages to summarize.');

        // Verify there are no unread messages
        const unreadMessages = await messageCache.getUnreadMessages(ctx, userId);
        expect(unreadMessages.length).toBe(0);
      });
    });

    it('edgeCase_unknownMessages_preservedWithAccumulation', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('edge2');
        const ctx = createLockContext();

        // First batch: collection + unknown
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.createMessage(ctx, userId, 'Unknown message 1');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Second batch: another collection + unknown
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.createMessage(ctx, userId, 'Unknown message 2');
        await messageCache.waitForPendingWrites();
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Should have: 1 summary + 2 unknown messages
        const messages = await messageCache.getMessagesForUser(ctx, userId);
        expect(messages.length).toBe(3);

        const summary = messages.find(m => m.message.includes('Message Summary'));
        const unknown1 = messages.find(m => m.message === 'Unknown message 1');
        const unknown2 = messages.find(m => m.message === 'Unknown message 2');

        expect(summary).toBeDefined();
        expect(unknown1).toBeDefined();
        expect(unknown2).toBeDefined();

        // Summary should have accumulated stats
        expect(summary!.message).toContain('1 asteroid(s)');
        expect(summary!.message).toContain('1 shipwreck(s)');
        expect(summary!.message).toContain('600');
      });
    });

    it('edgeCase_onlyUnknownMessages_noSummary', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('edge3');
        const ctx = createLockContext();

        // Only unknown messages
        await messageCache.createMessage(ctx, userId, 'Unknown message 1');
        await messageCache.createMessage(ctx, userId, 'Unknown message 2');
        await messageCache.waitForPendingWrites();
        const summary = await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Should create an empty summary (no stats) but preserve unknown messages
        const messages = await messageCache.getMessagesForUser(ctx, userId);
        
        // Should have summary + 2 unknown messages
        expect(messages.length).toBe(3);
        
        const summaryMsg = messages.find(m => m.message.includes('Message Summary'));
        expect(summaryMsg).toBeDefined();
        
        // Summary should only have the header
        expect(summaryMsg!.message).toBe('📊 **Message Summary**');
        expect(summary).toBe('📊 **Message Summary**');
      });
    });
  });
});
