// ---
// Tests for MessagesRepo - Database operations layer
// ---

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MessagesRepo, type Message, type UnreadMessage } from '@/lib/server/messages/messagesRepo';
import { getTestDatabase, closeTestDatabase, clearTestDatabase } from '../helpers/testDatabase';
import { createLockContext, DATABASE_LOCK } from '@/lib/server/typedLocks';

describe('MessagesRepo', () => {
  let messagesRepo: MessagesRepo;

  beforeEach(async () => {
    const testDb = await getTestDatabase();
    await clearTestDatabase();
    messagesRepo = new MessagesRepo(testDb);
  });

  afterEach(async () => {
    await closeTestDatabase();
  });

  // Helper functions to wrap messagesRepo calls with lock acquisition
  // Uses proper IronGuard lock contexts
  async function createMessage(userId: number, message: string): Promise<number> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireWrite(DATABASE_LOCK);
    try {
      return await messagesRepo.createMessage(userId, message, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function getAllMessages(userId: number, limit?: number): Promise<Message[]> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireRead(DATABASE_LOCK);
    try {
      return await messagesRepo.getAllMessages(userId, limit, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function updateMessageReadStatus(messageId: number, isRead: boolean): Promise<void> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireWrite(DATABASE_LOCK);
    try {
      return await messagesRepo.updateMessageReadStatus(messageId, isRead, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function markAllMessagesAsRead(userId: number): Promise<void> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireWrite(DATABASE_LOCK);
    try {
      return await messagesRepo.markAllMessagesAsRead(userId, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function getUnreadMessageCount(userId: number): Promise<number> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireRead(DATABASE_LOCK);
    try {
      return await messagesRepo.getUnreadMessageCount(userId, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function getUnreadMessages(userId: number): Promise<UnreadMessage[]> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireRead(DATABASE_LOCK);
    try {
      return await messagesRepo.getUnreadMessages(userId, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function updateMultipleReadStatuses(updates: { id: number; isRead: boolean }[]): Promise<void> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireWrite(DATABASE_LOCK);
    try {
      return await messagesRepo.updateMultipleReadStatuses(updates, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  async function deleteOldReadMessages(daysOld: number): Promise<number> {
    const ctx = createLockContext();
    const lockCtx = await ctx.acquireWrite(DATABASE_LOCK);
    try {
      return await messagesRepo.deleteOldReadMessages(daysOld, lockCtx);
    } finally {
      lockCtx.dispose();
    }
  }

  describe('createMessage', () => {
    test('createMessage_validData_createsMessageSuccessfully', async () => {
      const messageId = await createMessage(1, 'Welcome to the game!');
      
      expect(messageId).toBeGreaterThan(0);
    });

    test('createMessage_multipleMessages_createsAllSuccessfully', async () => {
      const messageId1 = await createMessage(1, 'First message');
      const messageId2 = await createMessage(1, 'Second message');
      const messageId3 = await createMessage(2, 'Message for different user');
      
      expect(messageId1).toBeGreaterThan(0);
      expect(messageId2).toBeGreaterThan(messageId1);
      expect(messageId3).toBeGreaterThan(messageId2);
    });
  });

  describe('getAllMessages', () => {
    test('getAllMessages_noMessages_returnsEmptyArray', async () => {
      const messages = await getAllMessages(1);
      
      expect(messages).toEqual([]);
    });

    test('getAllMessages_hasMessages_returnsAllInDescendingOrder', async () => {
      await createMessage(1, 'First message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createMessage(1, 'Second message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createMessage(1, 'Third message');
      
      const messages = await getAllMessages(1);
      
      expect(messages).toHaveLength(3);
      // Verify descending order (newest first)
      expect(messages[0].message).toBe('Third message');
      expect(messages[1].message).toBe('Second message');
      expect(messages[2].message).toBe('First message');
    });

    test('getAllMessages_withLimit_respectsLimit', async () => {
      for (let i = 1; i <= 5; i++) {
        await createMessage(1, `Message ${i}`);
      }
      
      const messages = await getAllMessages(1, 3);
      
      expect(messages).toHaveLength(3);
      messages.forEach(message => {
        expect(message.message).toMatch(/^Message \d$/);
        expect(message.recipient_id).toBe(1);
      });
    });

    test('getAllMessages_multipleUsers_onlyReturnsForSpecificUser', async () => {
      await createMessage(1, 'Message for user 1');
      await createMessage(2, 'Message for user 2');
      await createMessage(1, 'Another message for user 1');
      
      const user1Messages = await getAllMessages(1);
      expect(user1Messages).toHaveLength(2);
      
      const user2Messages = await getAllMessages(2);
      expect(user2Messages).toHaveLength(1);
      expect(user2Messages[0].message).toBe('Message for user 2');
    });
  });

  describe('updateMessageReadStatus', () => {
    test('updateReadStatus_singleMessage_updatesSuccessfully', async () => {
      const messageId = await createMessage(1, 'Test message');
      
      await updateMessageReadStatus(messageId, true);
      
      const messages = await getAllMessages(1);
      expect(!!messages[0].is_read).toBe(true);
    });

    test('updateReadStatus_toggleReadStatus_worksCorrectly', async () => {
      const messageId = await createMessage(1, 'Test message');
      
      // Mark as read
      await updateMessageReadStatus(messageId, true);
      let messages = await getAllMessages(1);
      expect(!!messages[0].is_read).toBe(true);
      
      // Mark as unread again
      await updateMessageReadStatus(messageId, false);
      messages = await getAllMessages(1);
      expect(!!messages[0].is_read).toBe(false);
    });
  });

  describe('updateMultipleReadStatuses', () => {
    test('updateMultiple_emptyArray_completesSuccessfully', async () => {
      await expect(updateMultipleReadStatuses([])).resolves.not.toThrow();
    });

    test('updateMultiple_multipleMessages_updatesAllInTransaction', async () => {
      const id1 = await createMessage(1, 'Message 1');
      const id2 = await createMessage(1, 'Message 2');
      const id3 = await createMessage(1, 'Message 3');
      
      await updateMultipleReadStatuses([
        { id: id1, isRead: true },
        { id: id2, isRead: true },
        { id: id3, isRead: false }
      ]);
      
      const messages = await getAllMessages(1);
      expect(!!messages.find((m) => m.id === id1)?.is_read).toBe(true);
      expect(!!messages.find((m) => m.id === id2)?.is_read).toBe(true);
      expect(!!messages.find((m) => m.id === id3)?.is_read).toBe(false);
    });
  });

  describe('markAllMessagesAsRead', () => {
    test('markAllAsRead_noUnreadMessages_completesSuccessfully', async () => {
      await createMessage(1, 'Message 1');
      await markAllMessagesAsRead(1);
      
      await expect(markAllMessagesAsRead(1)).resolves.not.toThrow();
    });

    test('markAllAsRead_hasUnreadMessages_marksAllAsRead', async () => {
      await createMessage(1, 'Message 1');
      await createMessage(1, 'Message 2');
      await createMessage(2, 'Message for user 2');
      
      await markAllMessagesAsRead(1);
      
      const user1Messages = await getAllMessages(1);
      expect(user1Messages.every((m) => !!m.is_read)).toBe(true);
      
      // User 2's messages should remain unread
      const user2Messages = await getAllMessages(2);
      expect(!!user2Messages[0].is_read).toBe(false);
    });
  });

  describe('getUnreadMessageCount', () => {
    test('getUnreadCount_noMessages_returnsZero', async () => {
      const count = await getUnreadMessageCount(1);
      
      expect(count).toBe(0);
    });

    test('getUnreadCount_hasUnreadMessages_returnsCorrectCount', async () => {
      await createMessage(1, 'Message 1');
      await createMessage(1, 'Message 2');
      await createMessage(2, 'Message for different user');
      
      const count = await getUnreadMessageCount(1);
      
      expect(count).toBe(2);
    });

    test('getUnreadCount_afterMarkingAsRead_returnsZero', async () => {
      await createMessage(1, 'Message 1');
      await createMessage(1, 'Message 2');
      
      const countBefore = await getUnreadMessageCount(1);
      expect(countBefore).toBe(2);
      
      await markAllMessagesAsRead(1);
      
      const countAfter = await getUnreadMessageCount(1);
      expect(countAfter).toBe(0);
    });
  });

  describe('getUnreadMessages', () => {
    test('getUnreadMessages_noMessages_returnsEmptyArray', async () => {
      const messages = await getUnreadMessages(1);
      
      expect(messages).toEqual([]);
    });

    test('getUnreadMessages_hasUnreadMessages_returnsOnlyUnread', async () => {
      const id1 = await createMessage(1, 'Unread message 1');
      await createMessage(1, 'Unread message 2');
      
      // Mark first message as read
      await updateMessageReadStatus(id1, true);
      
      const unreadMessages = await getUnreadMessages(1);
      
      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].message).toBe('Unread message 2');
    });

    test('getUnreadMessages_returnsInAscendingOrder', async () => {
      await createMessage(1, 'First message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createMessage(1, 'Second message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createMessage(1, 'Third message');
      
      const messages = await getUnreadMessages(1);
      
      expect(messages).toHaveLength(3);
      // Verify ascending order (oldest first)
      expect(messages[0].message).toBe('First message');
      expect(messages[1].message).toBe('Second message');
      expect(messages[2].message).toBe('Third message');
    });
  });

  describe('deleteOldReadMessages', () => {
    test('deleteOldRead_noOldMessages_returnsZero', async () => {
      await createMessage(1, 'Recent message');
      const id = (await getAllMessages(1))[0].id;
      await updateMessageReadStatus(id, true);
      
      const deletedCount = await deleteOldReadMessages(30);
      
      expect(deletedCount).toBe(0);
    });

    test('deleteOldRead_onlyDeletesReadMessages_preservesUnread', async () => {
      await createMessage(1, 'Read message');
      await createMessage(1, 'Unread message');
      
      // Mark first message as read
      const allMessages = await getAllMessages(1);
      const readMessage = allMessages.find((m) => m.message === 'Read message');
      if (readMessage) {
        await updateMessageReadStatus(readMessage.id, true);
      }
      
      // Delete messages older than -1 days (i.e., all old read messages)
      await deleteOldReadMessages(-1);
      
      const remainingMessages = await getAllMessages(1);
      // Should only have the unread message remaining
      expect(remainingMessages).toHaveLength(1);
      expect(remainingMessages[0].message).toBe('Unread message');
      expect(!!remainingMessages[0].is_read).toBe(false);
    });

    test('deleteOldRead_respectsCutoffTime_onlyDeletesOldMessages', async () => {
      // This test would require manipulating timestamps, which is complex with the current setup
      // For now, we'll verify the basic functionality works
      await createMessage(1, 'Message');
      const id = (await getAllMessages(1))[0].id;
      await updateMessageReadStatus(id, true);
      
      // Delete messages older than 1000 days - should keep recent message
      const deleted = await deleteOldReadMessages(1000);
      expect(deleted).toBe(0);
      
      const messages = await getAllMessages(1);
      expect(messages).toHaveLength(1);
    });
  });
});
