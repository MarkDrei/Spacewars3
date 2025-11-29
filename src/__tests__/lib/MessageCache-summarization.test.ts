import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '@/lib/server/database';

describe('MessageCache - Summarization', () => {
  let messageCache: MessageCache;

  beforeEach(async () => {
    // Reset database to ensure clean state
    const { resetTestDatabase } = await import('@/lib/server/database');
    resetTestDatabase();
    
    await MessageCache.initialize(await getDatabase(), {
      persistenceIntervalMs: 30000,
      enableAutoPersistence: false
    });
    messageCache = MessageCache.getInstance();
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

  describe('summarizeMessages', () => {
    it('messageSummarization_battleMessages_correctSummary', async () => {
      const userId = 1;

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

      // Verify summary content - now uses "Battle Summary" for battle-only messages
      expect(summary).toContain('Battle Summary');
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

    it('messageSummarization_mixedMessages_preservesUnknown', async () => {
      const userId = 2;

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
      
      // Should have 3 messages: battle summary + 2 unknown messages
      expect(messagesAfter.length).toBe(3);
      
      // Now uses "Battle Summary" for battle messages
      const summaryMessage = messagesAfter.find(m => m.message.includes('Battle Summary'));
      expect(summaryMessage).toBeDefined();
      expect(summaryMessage!.is_read).toBe(false);

      const unknownMessages = messagesAfter.filter(m => !m.message.includes('Battle Summary'));
      expect(unknownMessages.length).toBe(2);
      expect(unknownMessages.some(m => m.message.includes('custom message'))).toBe(true);
      expect(unknownMessages.some(m => m.message.includes('Another unknown'))).toBe(true);
      
      // All unknown messages should be unread
      unknownMessages.forEach(msg => {
        expect(msg.is_read).toBe(false);
      });
    });

    it('messageSummarization_multipleDefeatsBattles_correctCounts', async () => {
      const userId = 3;

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

    it('messageSummarization_noMessages_returnsEmptyMessage', async () => {
      const userId = 4;

      // Summarize with no messages
      const summary = await messageCache.summarizeMessages(userId);

      expect(summary).toBe('No messages to summarize.');

      // Verify no messages created
      const messages = await messageCache.getMessagesForUser(userId);
      expect(messages.length).toBe(0);
    });

    it('messageSummarization_onlyUnknownMessages_preservesAll', async () => {
      const userId = 5;

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
      
      // Should have 4 messages: generic summary + 3 unknown messages
      expect(messagesAfter.length).toBe(4);
      
      // All 3 original messages should be preserved as unread
      // Generic summary uses "Message Summary" when there's no battle/collection data
      const unknownMessages = messagesAfter.filter(m => !m.message.includes('**Message Summary**'));
      expect(unknownMessages.length).toBe(3);
    });

    it('messageSummarization_collectionMessages_correctSummary', async () => {
      const userId = 6;

      // Create collection messages (as produced by the harvest API)
      await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **69** iron.');
      await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **158** iron.');
      await messageCache.createMessage(userId, 'P: Successfully collected shipwreck and received **199** iron.');
      await messageCache.createMessage(userId, 'P: Successfully collected shipwreck and received **700** iron.');
      await messageCache.createMessage(userId, 'P: Successfully collected shipwreck and received **95** iron.');
      await messageCache.createMessage(userId, 'P: Successfully collected escape pod.'); // No iron for escape pods

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Summarize
      const summary = await messageCache.summarizeMessages(userId);

      console.log('Summary:', summary);

      // Verify summary content - should have Collection Summary
      expect(summary).toContain('Collection Summary');
      expect(summary).toContain('Collected:');
      expect(summary).toContain('2 asteroid(s)');
      expect(summary).toContain('3 shipwreck(s)');
      expect(summary).toContain('1 escape pod(s)');
      expect(summary).toContain('Iron Received:');
      expect(summary).toContain('1221'); // 69 + 158 + 199 + 700 + 95

      // Wait for summary message to be persisted
      await messageCache.waitForPendingWrites();

      // Verify messages after summarization
      const messagesAfter = await messageCache.getMessagesForUser(userId);
      
      // Should have exactly 1 message (the collection summary)
      expect(messagesAfter.length).toBe(1);
      expect(messagesAfter[0].message).toBe(summary);
      expect(messagesAfter[0].is_read).toBe(false);
    });

    it('messageSummarization_mixedBattleAndCollection_separateSummaries', async () => {
      const userId = 7;

      // Create battle messages
      await messageCache.createMessage(userId, 'P: ⚔️ Your **pulse laser** fired 5 shot(s), **3 hit** for **24 damage**! Enemy: Hull: 262, Armor: 0, Shield: 0');
      await messageCache.createMessage(userId, 'P: 🎉 **Victory!** You won the battle!');
      
      // Create collection messages
      await messageCache.createMessage(userId, 'P: Successfully collected asteroid and received **100** iron.');
      await messageCache.createMessage(userId, 'P: Successfully collected shipwreck and received **200** iron.');

      // Wait for async message creation to complete
      await messageCache.waitForPendingWrites();

      // Summarize
      const summary = await messageCache.summarizeMessages(userId);

      console.log('Summary:', summary);

      // Verify summary contains BOTH battle and collection summaries (separate)
      expect(summary).toContain('Battle Summary');
      expect(summary).toContain('Collection Summary');
      
      // Verify battle content
      expect(summary).toContain('1 victory(ies)');
      expect(summary).toContain('Dealt 24');
      
      // Verify collection content
      expect(summary).toContain('1 asteroid(s)');
      expect(summary).toContain('1 shipwreck(s)');
      expect(summary).toContain('Iron Received:');
      expect(summary).toContain('300'); // 100 + 200

      // Wait for summary messages to be persisted
      await messageCache.waitForPendingWrites();

      // Verify messages after summarization - should have 2 messages (battle + collection)
      const messagesAfter = await messageCache.getMessagesForUser(userId);
      expect(messagesAfter.length).toBe(2);
      
      const battleSummary = messagesAfter.find(m => m.message.includes('Battle Summary'));
      const collectionSummary = messagesAfter.find(m => m.message.includes('Collection Summary'));
      
      expect(battleSummary).toBeDefined();
      expect(collectionSummary).toBeDefined();
    });

    it('messageSummarization_preservesUnknownMessageTimestamps', async () => {
      const userId = 8;

      // Create an unknown message and capture its timestamp
      await messageCache.createMessage(userId, 'Custom message to preserve');
      await messageCache.waitForPendingWrites();
      
      // Get the original message to capture its timestamp
      const originalMessages = await messageCache.getMessagesForUser(userId);
      const originalTimestamp = originalMessages[0].created_at;
      
      // Add a small delay to ensure new messages would have different timestamps
      await new Promise(resolve => setTimeout(resolve, 50));

      // Summarize
      await messageCache.summarizeMessages(userId);
      await messageCache.waitForPendingWrites();

      // Get messages after summarization
      const messagesAfter = await messageCache.getMessagesForUser(userId);
      
      // Find the preserved unknown message
      const preservedMessage = messagesAfter.find(m => m.message === 'Custom message to preserve');
      expect(preservedMessage).toBeDefined();
      
      // Verify the timestamp was preserved
      expect(preservedMessage!.created_at).toBe(originalTimestamp);
    });
  });
});
