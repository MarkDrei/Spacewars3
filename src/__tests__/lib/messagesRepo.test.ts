// ---
// Tests for MessagesRepo
// ---

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MessagesRepo } from '@/lib/server/messagesRepo';
import { getTestDatabase, closeTestDatabase, clearTestDatabase } from '../helpers/testDatabase';

describe('MessagesRepo', () => {
  let messagesRepo: MessagesRepo;

  beforeEach(async () => {
    const testDb = await getTestDatabase();
    await clearTestDatabase(); // Clear data between tests
    messagesRepo = new MessagesRepo(testDb);
  });

  afterEach(async () => {
    await closeTestDatabase();
  });

  describe('createMessage', () => {
    test('createMessage_validData_createsMessageSuccessfully', async () => {
      const messageId = await messagesRepo.createMessage(1, 'Welcome to the game!');
      
      expect(messageId).toBeGreaterThan(0);
    });

    test('createMessage_multipleMessages_createsAllSuccessfully', async () => {
      const messageId1 = await messagesRepo.createMessage(1, 'First message');
      const messageId2 = await messagesRepo.createMessage(1, 'Second message');
      const messageId3 = await messagesRepo.createMessage(2, 'Message for different user');
      
      expect(messageId1).toBeGreaterThan(0);
      expect(messageId2).toBeGreaterThan(messageId1);
      expect(messageId3).toBeGreaterThan(messageId2);
    });
  });

  describe('getAndMarkUnreadMessages', () => {
    test('getAndMarkUnreadMessages_noMessages_returnsEmptyArray', async () => {
      const messages = await messagesRepo.getAndMarkUnreadMessages(1);
      
      expect(messages).toEqual([]);
    });

    test('getAndMarkUnreadMessages_hasUnreadMessages_returnsAndMarksAsRead', async () => {
      // Create some messages
      await messagesRepo.createMessage(1, 'First message');
      await messagesRepo.createMessage(1, 'Second message');
      await messagesRepo.createMessage(2, 'Message for different user');
      
      // Get unread messages for user 1
      const messages = await messagesRepo.getAndMarkUnreadMessages(1);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].message).toBe('First message');
      expect(messages[1].message).toBe('Second message');
      
      // Verify messages are marked as read by trying to get them again
      const messagesSecondCall = await messagesRepo.getAndMarkUnreadMessages(1);
      expect(messagesSecondCall).toHaveLength(0);
    });

    test('getAndMarkUnreadMessages_multipleUsers_onlyReturnsForSpecificUser', async () => {
      // Create messages for different users
      await messagesRepo.createMessage(1, 'Message for user 1');
      await messagesRepo.createMessage(2, 'Message for user 2');
      await messagesRepo.createMessage(1, 'Another message for user 1');
      
      // Get messages for user 1
      const user1Messages = await messagesRepo.getAndMarkUnreadMessages(1);
      expect(user1Messages).toHaveLength(2);
      
      // Get messages for user 2
      const user2Messages = await messagesRepo.getAndMarkUnreadMessages(2);
      expect(user2Messages).toHaveLength(1);
      expect(user2Messages[0].message).toBe('Message for user 2');
    });

    test('getAndMarkUnreadMessages_messagesInOrder_returnsChronologicalOrder', async () => {
      // Create messages with slight delays to ensure different timestamps
      await messagesRepo.createMessage(1, 'First message');
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      await messagesRepo.createMessage(1, 'Second message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      await messagesRepo.createMessage(1, 'Third message');
      
      const messages = await messagesRepo.getAndMarkUnreadMessages(1);
      
      expect(messages).toHaveLength(3);
      expect(messages[0].message).toBe('First message');
      expect(messages[1].message).toBe('Second message');
      expect(messages[2].message).toBe('Third message');
      
      // Verify timestamps are in ascending order
      expect(messages[0].created_at).toBeLessThanOrEqual(messages[1].created_at);
      expect(messages[1].created_at).toBeLessThanOrEqual(messages[2].created_at);
    });
  });

  describe('getUnreadMessageCount', () => {
    test('getUnreadMessageCount_noMessages_returnsZero', async () => {
      const count = await messagesRepo.getUnreadMessageCount(1);
      
      expect(count).toBe(0);
    });

    test('getUnreadMessageCount_hasUnreadMessages_returnsCorrectCount', async () => {
      await messagesRepo.createMessage(1, 'Message 1');
      await messagesRepo.createMessage(1, 'Message 2');
      await messagesRepo.createMessage(2, 'Message for different user');
      
      const count = await messagesRepo.getUnreadMessageCount(1);
      
      expect(count).toBe(2);
    });

    test('getUnreadMessageCount_afterMarkingAsRead_returnsZero', async () => {
      await messagesRepo.createMessage(1, 'Message 1');
      await messagesRepo.createMessage(1, 'Message 2');
      
      // Initially should have 2 unread messages
      const countBefore = await messagesRepo.getUnreadMessageCount(1);
      expect(countBefore).toBe(2);
      
      // Mark as read
      await messagesRepo.getAndMarkUnreadMessages(1);
      
      // Should now have 0 unread messages
      const countAfter = await messagesRepo.getUnreadMessageCount(1);
      expect(countAfter).toBe(0);
    });
  });

  describe('getAllMessages', () => {
    test('getAllMessages_noMessages_returnsEmptyArray', async () => {
      const messages = await messagesRepo.getAllMessages(1);
      
      expect(messages).toEqual([]);
    });

    test('getAllMessages_hasMessages_returnsAllInDescendingOrder', async () => {
      await messagesRepo.createMessage(1, 'First message');
      await messagesRepo.createMessage(1, 'Second message');
      await messagesRepo.createMessage(1, 'Third message');
      
      const messages = await messagesRepo.getAllMessages(1);
      
      expect(messages).toHaveLength(3);
      // Verify all messages are present
      const messageTexts = messages.map(m => m.message);
      expect(messageTexts).toContain('First message');
      expect(messageTexts).toContain('Second message');
      expect(messageTexts).toContain('Third message');
      
      // Verify timestamps are properly set and in descending order
      expect(messages[0].created_at).toBeGreaterThanOrEqual(messages[1].created_at);
      expect(messages[1].created_at).toBeGreaterThanOrEqual(messages[2].created_at);
    });

    test('getAllMessages_withLimit_respectsLimit', async () => {
      // Create 5 messages
      for (let i = 1; i <= 5; i++) {
        await messagesRepo.createMessage(1, `Message ${i}`);
      }
      
      const messages = await messagesRepo.getAllMessages(1, 3);
      
      expect(messages).toHaveLength(3);
      // Verify we get exactly 3 messages and they're all valid
      messages.forEach(message => {
        expect(message.message).toMatch(/^Message \d$/);
        expect(message.recipient_id).toBe(1);
      });
    });

    test('getAllMessages_includesBothReadAndUnread_returnsAll', async () => {
      await messagesRepo.createMessage(1, 'Unread message 1');
      await messagesRepo.createMessage(1, 'Unread message 2');
      
      // Mark some as read by calling getAndMarkUnreadMessages
      await messagesRepo.getAndMarkUnreadMessages(1);
      
      // Add more messages
      await messagesRepo.createMessage(1, 'New unread message');
      
      const allMessages = await messagesRepo.getAllMessages(1);
      
      expect(allMessages).toHaveLength(3);
      
      // Check that we have both read and unread messages
      // SQLite stores booleans as 0/1, so we need to check for truthy/falsy values
      const hasReadMessages = allMessages.some(m => !!m.is_read);
      const hasUnreadMessages = allMessages.some(m => !m.is_read);
      
      expect(hasReadMessages).toBe(true);
      expect(hasUnreadMessages).toBe(true);
    });
  });

  describe('deleteOldReadMessages', () => {
    test('deleteOldReadMessages_noOldMessages_returnsZero', async () => {
      await messagesRepo.createMessage(1, 'Recent message');
      await messagesRepo.getAndMarkUnreadMessages(1); // Mark as read
      
      const deletedCount = await messagesRepo.deleteOldReadMessages(30);
      
      expect(deletedCount).toBe(0);
    });

    test('deleteOldReadMessages_onlyDeletesReadMessages_preservesUnread', async () => {
      await messagesRepo.createMessage(1, 'Read message');
      await messagesRepo.createMessage(1, 'Unread message');
      
      // Mark first message as read
      await messagesRepo.getAndMarkUnreadMessages(1);
      await messagesRepo.createMessage(1, 'New unread message');
      
      // Get initial count
      const allMessagesBefore = await messagesRepo.getAllMessages(1);
      expect(allMessagesBefore).toHaveLength(3);
      
      // Delete read messages older than a very large number of days ago (should delete all read messages)
      const deletedCount = await messagesRepo.deleteOldReadMessages(-1); // Negative days to ensure deletion
      
      const allMessagesAfter = await messagesRepo.getAllMessages(1);
      // Should only have the unread messages remaining (2 unread messages)
      expect(allMessagesAfter.length).toBeLessThan(allMessagesBefore.length);
      expect(allMessagesAfter.every(m => !m.is_read)).toBe(true);
    });
  });
});
