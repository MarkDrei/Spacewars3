import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { withTransaction } from '../helpers/transactionHelper';

describe('MessageCache - Summarization', () => {
  let messageCache: MessageCache;

  beforeEach(async () => {
    // Clear messages from previous tests
    const { clearTestDatabase } = await import('../helpers/testDatabase');
    await clearTestDatabase();
    
    MessageCache.resetInstance();
    messageCache = MessageCache.getInstance({
      persistenceIntervalMs: 30000,
      enableAutoPersistence: false // Disable auto-persistence to avoid background timers
    });
    await messageCache.initialize();
  });

  afterEach(async () => {
    try {
      // Ensure all pending writes complete before shutdown
      await messageCache.waitForPendingWrites();
      await messageCache.shutdown();
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

  describe('summarizeMessages', () => {
    it('messageSummarization_battleMessages_correctSummary', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest1');

      // Create typical battle messages
      await messageCache.createMessage(userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
      await messageCache.createMessage(userId, 'P: ⚔️ Your **auto turret** fired 5 shot(s), **4 hit** for **40 damage**! Enemy: Hull: 222, Armor: 0, Shield: 0');
      await messageCache.createMessage(userId, 'N: 🛡️ Enemy **pulse laser** fired 1 shot(s), **1 hit** you for **8 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
      await messageCache.createMessage(userId, 'N: 🛡️ Enemy **auto turret** fired 2 shot(s), **1 hit** you for **10 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 278');
      await messageCache.createMessage(userId, 'Your pulse laser fired 5 shot(s) but all missed!');
      await messageCache.createMessage(userId, 'A: Enemy pulse laser fired 1 shot(s) but all missed!');
      await messageCache.createMessage(userId, 'P: 🎉 **Victory!** You won the battle!');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Get messages before summarization
      const messagesBefore = await messageCache.getMessagesForUser(userId);
      expect(messagesBefore.length).toBe(7);

      // Summarize
      const summary = await messageCache.summarizeMessages(userId);

      console.log('Summary:', summary);

      // Verify summary content
      expect(summary).toContain('Message Summary');
      expect(summary).toContain('Battles:');
      expect(summary).toContain('1 victory(ies)');
      expect(summary).toContain('Damage:');
      expect(summary).toContain('Dealt 64'); // 24 + 40
      expect(summary).toContain('Received 18'); // 8 + 10
      expect(summary).toContain('Your Accuracy:');
      expect(summary).toContain('7/15 hits'); // 3+4 hits out of 5+5+5 = 15 total shots (5+3 = 8 missed)
      expect(summary).toContain('Enemy Accuracy:');
      expect(summary).toContain('2/4 hits'); // 1+1 hits out of 1+2+1 = 4 total shots (1+1 = 2 missed)

      // Wait for summary message to be persisted
      await messageCache.waitForPendingWrites();

      // Verify messages after summarization
      const messagesAfter = await messageCache.getMessagesForUser(userId);
      
      // Should have exactly 1 message (the summary)
      expect(messagesAfter.length).toBe(1);
      expect(messagesAfter[0].message).toBe(summary);
      expect(messagesAfter[0].is_read).toBe(false);

      // All original messages should be marked as read in DB
      await messageCache.flushToDatabase(createLockContext());
      });
    });

    it('messageSummarization_mixedMessages_preservesUnknown', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest2');

      // Create battle messages and unknown messages
      await messageCache.createMessage(userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
      await messageCache.createMessage(userId, 'This is a custom message that cannot be parsed');
      await messageCache.createMessage(userId, 'N: 🛡️ Enemy **pulse laser** fired 1 shot(s), **1 hit** you for **8 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
      await messageCache.createMessage(userId, 'Another unknown message type');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Summarize
      const summary = await messageCache.summarizeMessages(userId);

      console.log('Summary:', summary);

      // Wait for new messages to be created
      await messageCache.waitForPendingWrites();

      // Verify messages after summarization
      const messagesAfter = await messageCache.getMessagesForUser(userId);
      
      // Should have 3 messages: summary + 2 unknown messages
      expect(messagesAfter.length).toBe(3);
      
      const summaryMessage = messagesAfter.find(m => m.message.includes('Message Summary'));
      expect(summaryMessage).toBeDefined();
      expect(summaryMessage!.is_read).toBe(false);

      const unknownMessages = messagesAfter.filter(m => !m.message.includes('Message Summary'));
      expect(unknownMessages.length).toBe(2);
      expect(unknownMessages.some(m => m.message.includes('custom message'))).toBe(true);
      expect(unknownMessages.some(m => m.message.includes('Another unknown'))).toBe(true);
      
      // All unknown messages should be unread
      unknownMessages.forEach(msg => {
        expect(msg.is_read).toBe(false);
      });
      });
    });

    it('messageSummarization_multipleDefeatsBattles_correctCounts', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest3');

      // Create messages for multiple battles
      await messageCache.createMessage(userId, 'P: 🎉 **Victory!** You won the battle!');
      await messageCache.createMessage(userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **5 hit** for **40 damage**! Enemy: Hull: 100, Armor: 0, Shield: 0');
      await messageCache.createMessage(userId, 'A: 💀 **Defeat!** You lost the battle and have been teleported away.');
      await messageCache.createMessage(userId, 'N: 🛡️ Enemy **auto turret** fired 5 shot(s), **5 hit** you for **50 damage**! Your defenses: Hull: 0, Armor: 0, Shield: 0');
      await messageCache.createMessage(userId, 'P: 🎉 **Victory!** You won the battle!');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Summarize
      const summary = await messageCache.summarizeMessages(userId);

      console.log('Summary:', summary);

      // Verify summary content
      expect(summary).toContain('2 victory(ies)');
      expect(summary).toContain('1 defeat(s)');
      expect(summary).toContain('Dealt 40');
      expect(summary).toContain('Received 50');
      });
    });

    it('messageSummarization_noMessages_returnsEmptyMessage', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest4');

      // Summarize with no messages
      const summary = await messageCache.summarizeMessages(userId);

      expect(summary).toBe('No messages to summarize.');

      // Verify no messages created
      const messages = await messageCache.getMessagesForUser(userId);
      expect(messages.length).toBe(0);
      });
    });

    it('messageSummarization_onlyUnknownMessages_preservesAll', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest5');

      // Create only unknown messages
      await messageCache.createMessage(userId, 'Custom notification 1');
      await messageCache.createMessage(userId, 'Custom notification 2');
      await messageCache.createMessage(userId, 'Custom notification 3');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Summarize
      const summary = await messageCache.summarizeMessages(userId);

      console.log('Summary:', summary);

      // Wait for new messages to be created
      await messageCache.waitForPendingWrites();

      // Verify messages after summarization
      const messagesAfter = await messageCache.getMessagesForUser(userId);
      
      // Should have 4 messages: summary + 3 unknown messages
      expect(messagesAfter.length).toBe(4);
      
      // All 3 original messages should be preserved as unread
      const unknownMessages = messagesAfter.filter(m => !m.message.includes('Message Summary'));
      expect(unknownMessages.length).toBe(3);
      });
    });

    it('messageSummarization_collectionMessages_correctSummary', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest6');

        // Create collection messages
        await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **150** iron.');
        await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **200** iron.');
        await messageCache.createMessage(userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.createMessage(userId, 'P: Successfully collected escape pod and received **1000** iron.');

        // Wait for async message creation to complete
        await messageCache.waitForPendingWrites();

        // Get messages before summarization
        const messagesBefore = await messageCache.getMessagesForUser(userId);
        expect(messagesBefore.length).toBe(4);

        // Summarize
        const summary = await messageCache.summarizeMessages(userId);

        console.log('Summary:', summary);

        // Verify summary content
        expect(summary).toContain('Message Summary');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('Asteroids: 2 (350 iron)');
        expect(summary).toContain('Shipwrecks: 1 (500 iron)');
        expect(summary).toContain('Escape Pods: 1 (1000 iron)');

        // Wait for summary message to be persisted
        await messageCache.waitForPendingWrites();

        // Verify messages after summarization
        const messagesAfter = await messageCache.getMessagesForUser(userId);
        
        // Should have exactly 1 message (the summary)
        expect(messagesAfter.length).toBe(1);
        expect(messagesAfter[0].message).toBe(summary);
        expect(messagesAfter[0].is_read).toBe(false);
      });
    });

    it('messageSummarization_mixedBattleAndCollection_separateSummaries', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest7');

        // Create mixed messages
        await messageCache.createMessage(userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
        await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **150** iron.');
        await messageCache.createMessage(userId, 'N: 🛡️ Enemy **pulse laser** fired 1 shot(s), **1 hit** you for **8 damage**! Your defenses: Hull: 600, Armor: 600, Shield: 288');
        await messageCache.createMessage(userId, 'P: Successfully collected shipwreck and received **500** iron.');
        await messageCache.createMessage(userId, 'P: 🎉 **Victory!** You won the battle!');

        // Wait for async message creation to complete
        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(userId);

        console.log('Summary:', summary);

        // Verify summary contains both battle and collection info
        expect(summary).toContain('Message Summary');
        expect(summary).toContain('Battles:');
        expect(summary).toContain('1 victory(ies)');
        expect(summary).toContain('Damage:');
        expect(summary).toContain('Dealt 24');
        expect(summary).toContain('Received 8');
        expect(summary).toContain('Collections:');
        expect(summary).toContain('Asteroids: 1 (150 iron)');
        expect(summary).toContain('Shipwrecks: 1 (500 iron)');

        // Wait for summary message to be persisted
        await messageCache.waitForPendingWrites();

        // Verify messages after summarization
        const messagesAfter = await messageCache.getMessagesForUser(userId);
        
        // Should have exactly 1 message (the summary)
        expect(messagesAfter.length).toBe(1);
        expect(messagesAfter[0].message).toBe(summary);
        expect(messagesAfter[0].is_read).toBe(false);
      });
    });

    it('messageSummarization_collectionWithoutIron_countsCorrectly', async () => {
      await withTransaction(async () => {
        const userId = await createTestUser('sumtest8');

        // Create collection messages without iron
        await messageCache.createMessage(userId, 'P: Successfully collected escape pod.');
        await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **100** iron.');

        // Wait for async message creation to complete
        await messageCache.waitForPendingWrites();

        // Summarize
        const summary = await messageCache.summarizeMessages(userId);

        console.log('Summary:', summary);

        // Verify summary content
        expect(summary).toContain('Collections:');
        expect(summary).toContain('Asteroids: 1 (100 iron)');
        expect(summary).toContain('Escape Pods: 1 (0 iron)');
      });
    });
  });
});
