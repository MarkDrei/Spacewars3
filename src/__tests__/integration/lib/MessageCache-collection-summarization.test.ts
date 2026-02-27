import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../../helpers/transactionHelper';

describe('MessageCache - Collection Summarization', () => {
  let messageCache: MessageCache;

  beforeEach(async () => {
    // Clear messages from previous tests
    const { clearTestDatabase } = await import('../../helpers/testDatabase');
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

  describe('Collection Messages', () => {
    it('collectionSummarization_asteroidMessages_correctTotal', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('collection1');
        const ctx = createLockContext();

        // Create asteroid collection messages
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **173** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **172** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **52** iron.');

        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(ctx, userId);

        console.log('Summary:', summary);

        // Verify summary content
        expect(summary).toContain('Message Summary');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('3 asteroid(s)');
        expect(summary).toContain('Iron Collected:');
        expect(summary).toContain('397'); // 173 + 172 + 52

        await messageCache.waitForPendingWrites();

        // Verify only summary message remains
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
        expect(messagesAfter[0].message).toBe(summary);
      });
    });

    it('collectionSummarization_mixedCollectionTypes_correctCounts', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('collection2');
        const ctx = createLockContext();

        // Create mixed collection messages
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **156** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **202** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **325** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **564** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **935** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **236** iron.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **976** iron.');

        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(ctx, userId);

        console.log('Summary:', summary);

        // Verify summary content
        expect(summary).toContain('Message Summary');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('3 asteroid(s)');
        expect(summary).toContain('4 shipwreck(s)');
        expect(summary).toContain('1 escape pod(s)');
        expect(summary).toContain('Iron Collected:');
        expect(summary).toContain('3394'); // 156+202+325+564+935+236+976 = 3394

        await messageCache.waitForPendingWrites();

        // Verify only summary message remains
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
      });
    });

    it('collectionSummarization_onlyEscapePods_noIronTotal', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('collection3');
        const ctx = createLockContext();

        // Create only escape pod messages (no iron)
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');

        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(ctx, userId);

        console.log('Summary:', summary);

        // Verify summary content
        expect(summary).toContain('Message Summary');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('2 escape pod(s)');
        // Should not contain iron collected line
        expect(summary).not.toContain('Iron Collected:');
      });
    });

    it('collectionSummarization_commanderEscapePodMessage_countedAsEscapePod', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('collection3b');
        const ctx = createLockContext();

        // New-format messages produced when a commander is found in an escape pod
        await messageCache.createMessage(ctx, userId, 'P: 🚀 Escape pod collected! Commander **Zara** rescued and added to inventory. Bonuses: shipSpeed +0.3%.');
        await messageCache.createMessage(ctx, userId, 'P: 🚀 Escape pod collected! Commander **Rex** rescued but inventory is full — commander lost! Bonuses would have been: projectileWeaponDamage +0.7%.');

        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).toContain('Collections:');
        expect(summary).toContain('2 escape pod(s)');
        expect(summary).not.toContain('Iron Collected:');

        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);
        expect(messagesAfter.length).toBe(1);
        expect(messagesAfter[0].message).toBe(summary);
      });
    });

    it('collectionSummarization_mixedOldAndNewEscapePodFormats_correctCount', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('collection3c');
        const ctx = createLockContext();

        // One old-format, one new commander format
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected escape pod.');
        await messageCache.createMessage(ctx, userId, 'P: 🚀 Escape pod collected! Commander **Nova** rescued and added to inventory. Bonuses: energyWeaponDamage +0.5%.');

        await messageCache.waitForPendingWrites();

        const summary = await messageCache.summarizeMessages(ctx, userId);

        expect(summary).toContain('Collections:');
        expect(summary).toContain('2 escape pod(s)');
        expect(summary).not.toContain('Iron Collected:');
      });
    });

    it('collectionSummarization_mixedWithBattles_bothSummarized', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('collection4');
        const ctx = createLockContext();

        // Create mixed battle and collection messages
        await messageCache.createMessage(ctx, userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.createMessage(ctx, userId, 'N: 🛡️ Enemy **pulse laser** fired 1 shot(s), **1 hit** you for **8 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.createMessage(ctx, userId, 'P: 🎉 **Victory!** You won the battle! You gained 0 iron.');

        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(ctx, userId);

        console.log('Summary:', summary);

        // Verify both battle and collection stats
        expect(summary).toContain('Battles:');
        expect(summary).toContain('1 victory(ies)');
        expect(summary).toContain('Damage:');
        expect(summary).toContain('Dealt 24');
        expect(summary).toContain('Received 8');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('1 asteroid(s)');
        expect(summary).toContain('1 shipwreck(s)');
        expect(summary).toContain('Iron Collected:');
        expect(summary).toContain('600'); // 100 + 500
      });
    });
  });

  describe('Timestamp Preservation', () => {
    it('timestampPreservation_unknownMessages_keepsOriginalTimestamp', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('timestamp1');
        const ctx = createLockContext();

        // Create messages with delays to ensure different timestamps
        // const timestamp1 = Date.now() - 10000; // 10 seconds ago
        // const timestamp2 = Date.now() - 5000;  // 5 seconds ago
        
        // Manually create messages with specific timestamps by using internal method
        // We need to create a known message first, then modify it for testing
        await messageCache.createMessage(ctx, userId, 'Unknown message 1');
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await messageCache.createMessage(ctx, userId, 'Unknown message 2');

        await messageCache.waitForPendingWrites();

        // Get messages and manually set timestamps for testing
        const messagesBefore = await messageCache.getUnreadMessages(ctx, userId);
        expect(messagesBefore.length).toBe(3);

        // Record the original timestamps
        const originalTimestamps = messagesBefore.map(m => m.created_at);

        // Summarize - this should preserve unknown message timestamps
        /* const summary = */ await messageCache.summarizeMessages(ctx, userId);

        await messageCache.waitForPendingWrites();

        // Get messages after summarization
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);

        // Find the recreated unknown messages
        const unknownMessages = messagesAfter.filter(m => 
          m.message === 'Unknown message 1' || m.message === 'Unknown message 2'
        );

        expect(unknownMessages.length).toBe(2);

        // Verify timestamps are preserved
        const unknownMsg1 = unknownMessages.find(m => m.message === 'Unknown message 1');
        const unknownMsg2 = unknownMessages.find(m => m.message === 'Unknown message 2');

        expect(unknownMsg1).toBeDefined();
        expect(unknownMsg2).toBeDefined();

        // The timestamps should match the original timestamps
        expect(unknownMsg1!.created_at).toBe(originalTimestamps[0]);
        expect(unknownMsg2!.created_at).toBe(originalTimestamps[2]);
      });
    });

    it('timestampPreservation_unknownMessagesOrder_maintainedAfterSummarization', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('timestamp2');
        const ctx = createLockContext();

        // Create messages in specific order
        await messageCache.createMessage(ctx, userId, 'First unknown message');
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        await messageCache.createMessage(ctx, userId, 'P: Successfully collected asteroid and received **100** iron.');
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        await messageCache.createMessage(ctx, userId, 'Second unknown message');

        await messageCache.waitForPendingWrites();

        // Get original order
        const messagesBefore = await messageCache.getMessagesForUser(ctx, userId);
        const timestampsBefore = messagesBefore.map(m => m.created_at);

        // Summarize
        await messageCache.summarizeMessages(ctx, userId);
        await messageCache.waitForPendingWrites();

        // Get messages after
        const messagesAfter = await messageCache.getMessagesForUser(ctx, userId);

        // Find unknown messages
        const firstMsg = messagesAfter.find(m => m.message === 'First unknown message');
        const secondMsg = messagesAfter.find(m => m.message === 'Second unknown message');

        expect(firstMsg).toBeDefined();
        expect(secondMsg).toBeDefined();

        // First message should have earlier timestamp than second
        expect(firstMsg!.created_at).toBeLessThan(secondMsg!.created_at);

        // Timestamps should match originals
        expect(firstMsg!.created_at).toBe(timestampsBefore[0]);
        expect(secondMsg!.created_at).toBe(timestampsBefore[2]);
      });
    });
  });
});
