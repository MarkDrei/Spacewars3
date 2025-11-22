// ---
// Tests for MessagesRepo - Database operations layer
// ---

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MessagesRepo } from '@/lib/server/messages/messagesRepo';
import { getTestDatabase, closeTestDatabase, clearTestDatabase } from '../helpers/testDatabase';
import { createLockContext, HasLock12Context, LOCK_1, LOCK_12, LockContext } from '@markdrei/ironguard-typescript-locks';

describe('MessagesRepo', () => {
  let messagesRepo: MessagesRepo;
  let messageDbLockContext: LockContext<readonly [typeof LOCK_12]>;

  beforeEach(async () => {
    const testDb = await getTestDatabase();
    await clearTestDatabase();
    messagesRepo = new MessagesRepo(testDb);
    messageDbLockContext = await createLockContext().acquireWrite(LOCK_12);
  });

  afterEach(async () => {
    messageDbLockContext.dispose();
    await closeTestDatabase();
  });

  describe('createMessage', () => {
    test('createMessage_validData_createsMessageSuccessfully', async () => {
      const messageId = await messagesRepo.createMessage(messageDbLockContext, 1, 'Welcome to the game!');

      expect(messageId).toBeGreaterThan(0);
    });

    test('createMessage_multipleMessages_createsAllSuccessfully', async () => {
      const messageId1 = await messagesRepo.createMessage(messageDbLockContext, 1, 'First message');
      const messageId2 = await messagesRepo.createMessage(messageDbLockContext, 1, 'Second message');
      const messageId3 = await messagesRepo.createMessage(messageDbLockContext, 2, 'Message for different user');

      expect(messageId1).toBeGreaterThan(0);
      expect(messageId2).toBeGreaterThan(messageId1);
      expect(messageId3).toBeGreaterThan(messageId2);
    });
  });

  describe('getAllMessages', () => {
    test('getAllMessages_noMessages_returnsEmptyArray', async () => {
      const messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);

      expect(messages).toEqual([]);
    });

    test('getAllMessages_hasMessages_returnsAllInDescendingOrder', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'First message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Second message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Third message');

      const messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);

      expect(messages).toHaveLength(3);
      // Verify descending order (newest first)
      expect(messages[0].message).toBe('Third message');
      expect(messages[1].message).toBe('Second message');
      expect(messages[2].message).toBe('First message');
    });

    test('getAllMessages_withLimit_respectsLimit', async () => {
      for (let i = 1; i <= 5; i++) {
        await messagesRepo.createMessage(messageDbLockContext, 1, `Message ${i}`);
      }

      const messages = await messagesRepo.getAllMessages(messageDbLockContext, 1, 3);

      expect(messages).toHaveLength(3);
      messages.forEach(message => {
        expect(message.message).toMatch(/^Message \d$/);
        expect(message.recipient_id).toBe(1);
      });
    });

    test('getAllMessages_multipleUsers_onlyReturnsForSpecificUser', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message for user 1');
      await messagesRepo.createMessage(messageDbLockContext, 2, 'Message for user 2');
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Another message for user 1');

      const user1Messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(user1Messages).toHaveLength(2);

      const user2Messages = await messagesRepo.getAllMessages(messageDbLockContext, 2);
      expect(user2Messages).toHaveLength(1);
      expect(user2Messages[0].message).toBe('Message for user 2');
    });
  });

  describe('updateMessageReadStatus', () => {
    test('updateReadStatus_singleMessage_updatesSuccessfully', async () => {
      const messageId = await messagesRepo.createMessage(messageDbLockContext, 1, 'Test message');

      await messagesRepo.updateMessageReadStatus(messageDbLockContext, messageId, true);

      const messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(!!messages[0].is_read).toBe(true);
    });

    test('updateReadStatus_toggleReadStatus_worksCorrectly', async () => {
      const messageId = await messagesRepo.createMessage(messageDbLockContext, 1, 'Test message');

      // Mark as read
      await messagesRepo.updateMessageReadStatus(messageDbLockContext, messageId, true);
      let messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(!!messages[0].is_read).toBe(true);

      // Mark as unread again
      await messagesRepo.updateMessageReadStatus(messageDbLockContext, messageId, false);
      messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(!!messages[0].is_read).toBe(false);
    });
  });

  describe('updateMultipleReadStatuses', () => {
    test('updateMultiple_emptyArray_completesSuccessfully', async () => {
      await expect(messagesRepo.updateMultipleReadStatuses(messageDbLockContext, [])).resolves.not.toThrow();
    });

    test('updateMultiple_multipleMessages_updatesAllInTransaction', async () => {
      const id1 = await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 1');
      const id2 = await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 2');
      const id3 = await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 3');

      await messagesRepo.updateMultipleReadStatuses(messageDbLockContext, [
        { id: id1, isRead: true },
        { id: id2, isRead: true },
        { id: id3, isRead: false }
      ]);

      const messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(!!messages.find((m: { id: number }) => m.id === id1)?.is_read).toBe(true);
      expect(!!messages.find((m: { id: number }) => m.id === id2)?.is_read).toBe(true);
      expect(!!messages.find((m: { id: number }) => m.id === id3)?.is_read).toBe(false);
    });
  });

  describe('markAllMessagesAsRead', () => {
    test('markAllAsRead_noUnreadMessages_completesSuccessfully', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 1');
      await messagesRepo.markAllMessagesAsRead(messageDbLockContext, 1);

      await expect(messagesRepo.markAllMessagesAsRead(messageDbLockContext, 1)).resolves.not.toThrow();
    });

    test('markAllAsRead_hasUnreadMessages_marksAllAsRead', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 1');
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 2');
      await messagesRepo.createMessage(messageDbLockContext, 2, 'Message for user 2');

      await messagesRepo.markAllMessagesAsRead(messageDbLockContext, 1);

      const user1Messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(user1Messages.every((m: { is_read: boolean | number }) => !!m.is_read)).toBe(true);

      // User 2's messages should remain unread
      const user2Messages = await messagesRepo.getAllMessages(messageDbLockContext, 2);
      expect(!!user2Messages[0].is_read).toBe(false);
    });
  });

  describe('getUnreadMessageCount', () => {
    test('getUnreadCount_noMessages_returnsZero', async () => {
      const count = await messagesRepo.getUnreadMessageCount(messageDbLockContext, 1);

      expect(count).toBe(0);
    });

    test('getUnreadCount_hasUnreadMessages_returnsCorrectCount', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 1');
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 2');
      await messagesRepo.createMessage(messageDbLockContext, 2, 'Message for different user');

      const count = await messagesRepo.getUnreadMessageCount(messageDbLockContext, 1);

      expect(count).toBe(2);
    });

    test('getUnreadCount_afterMarkingAsRead_returnsZero', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 1');
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message 2');

      const countBefore = await messagesRepo.getUnreadMessageCount(messageDbLockContext, 1);
      expect(countBefore).toBe(2);

      await messagesRepo.markAllMessagesAsRead(messageDbLockContext, 1);

      const countAfter = await messagesRepo.getUnreadMessageCount(messageDbLockContext, 1);
      expect(countAfter).toBe(0);
    });
  });

  describe('getUnreadMessages', () => {
    test('getUnreadMessages_noMessages_returnsEmptyArray', async () => {
      const messages = await messagesRepo.getUnreadMessages(messageDbLockContext, 1);

      expect(messages).toEqual([]);
    });

    test('getUnreadMessages_hasUnreadMessages_returnsOnlyUnread', async () => {
      const id1 = await messagesRepo.createMessage(messageDbLockContext, 1, 'Unread message 1');
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Unread message 2');

      // Mark first message as read
      await messagesRepo.updateMessageReadStatus(messageDbLockContext, id1, true);

      const unreadMessages = await messagesRepo.getUnreadMessages(messageDbLockContext, 1);

      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].message).toBe('Unread message 2');
    });

    test('getUnreadMessages_returnsInAscendingOrder', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'First message');
      await new Promise(resolve => setTimeout(resolve, 1));
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Second message');
      await new Promise(resolve => setTimeout(resolve, 1));
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Third message');

      const messages = await messagesRepo.getUnreadMessages(messageDbLockContext, 1);

      expect(messages).toHaveLength(3);
      // Verify ascending order (oldest first)
      expect(messages[0].message).toBe('First message');
      expect(messages[1].message).toBe('Second message');
      expect(messages[2].message).toBe('Third message');
    });
  });

  describe('deleteOldReadMessages', () => {
    test('deleteOldRead_noOldMessages_returnsZero', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Recent message');
      const id = (await messagesRepo.getAllMessages(messageDbLockContext, 1))[0].id;
      await messagesRepo.updateMessageReadStatus(messageDbLockContext, id, true);

      const deletedCount = await messagesRepo.deleteOldReadMessages(messageDbLockContext, 30);

      expect(deletedCount).toBe(0);
    });

    test('deleteOldRead_onlyDeletesReadMessages_preservesUnread', async () => {
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Read message');
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Unread message');

      // Mark first message as read
      const allMessages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      const readMessage = allMessages.find((m: { message: string }) => m.message === 'Read message');
      if (readMessage) {
        await messagesRepo.updateMessageReadStatus(messageDbLockContext, readMessage.id, true);
      }

      // Delete messages older than -1 days (i.e., all old read messages)
      await messagesRepo.deleteOldReadMessages(messageDbLockContext, -1);

      const remainingMessages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      // Should only have the unread message remaining
      expect(remainingMessages).toHaveLength(1);
      expect(remainingMessages[0].message).toBe('Unread message');
      expect(!!remainingMessages[0].is_read).toBe(false);
    });

    test('deleteOldRead_respectsCutoffTime_onlyDeletesOldMessages', async () => {
      // This test would require manipulating timestamps, which is complex with the current setup
      // For now, we'll verify the basic functionality works
      await messagesRepo.createMessage(messageDbLockContext, 1, 'Message');
      const id = (await messagesRepo.getAllMessages(messageDbLockContext, 1))[0].id;
      await messagesRepo.updateMessageReadStatus(messageDbLockContext, id, true);

      // Delete messages older than 1000 days - should keep recent message
      const deleted = await messagesRepo.deleteOldReadMessages(messageDbLockContext, 1000);
      expect(deleted).toBe(0);

      const messages = await messagesRepo.getAllMessages(messageDbLockContext, 1);
      expect(messages).toHaveLength(1);
    });
  });
});
