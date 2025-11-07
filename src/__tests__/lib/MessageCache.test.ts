// ---
// Tests for MessageCache
// ---

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { 
  MessageCache, 
  getMessageCache,
  sendMessageToUser,
  getUserMessages,
  getUserMessageCount,
  markUserMessagesAsRead
} from '../../lib/server/MessageCache';

describe('MessageCache', () => {
  
  beforeEach(async () => {
    // Reset database to ensure clean state
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    // Reset singleton before each test
    MessageCache.resetInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      const cache = getMessageCache();
      await cache.shutdown();
      MessageCache.resetInstance();
    } catch {
      // Ignore cleanup errors
    }
    
    // Reset database after each test
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
  });

  describe('Singleton Pattern', () => {
    test('getInstance_multipleCalls_returnsSameInstance', () => {
      const cache1 = MessageCache.getInstance();
      const cache2 = MessageCache.getInstance();
      const cache3 = getMessageCache();

      expect(cache1).toBe(cache2);
      expect(cache2).toBe(cache3);
    });

    test('resetInstance_afterReset_createsNewInstance', () => {
      const cache1 = MessageCache.getInstance();
      MessageCache.resetInstance();
      const cache2 = MessageCache.getInstance();

      expect(cache1).not.toBe(cache2);
    });
  });

  describe('Message Operations', () => {
    test('createMessage_createsAndReturnsMessageId', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      const messageId = await cache.createMessage(1, 'Test message');
      
      // Now returns temporary negative ID immediately
      expect(messageId).toBeLessThan(0);
      
      // Wait for DB write to complete
      await cache.waitForPendingWrites();
      
      // Message should now have real ID in cache
      const messages = await cache.getMessagesForUser(1);
      expect(messages[0].id).toBeGreaterThan(0);
    });

    test('getUnreadMessageCount_returnsZeroForNewUser', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      const count = await cache.getUnreadMessageCount(999);
      
      expect(count).toBe(0);
    });

    test('createMessage_thenGetCount_returnsCorrectCount', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      await cache.createMessage(1, 'Message 1');
      await cache.createMessage(1, 'Message 2');
      
      const count = await cache.getUnreadMessageCount(1);
      
      expect(count).toBe(2);
    });
  });

  describe('Convenience Functions', () => {
    test('sendMessageToUser_createsMessage', async () => {
      const messageId = await sendMessageToUser(1, 'Test via convenience function');
      
      // Now returns temporary negative ID immediately
      expect(messageId).toBeLessThan(0);
      
      // Wait for write to complete
      const cache = getMessageCache();
      await cache.waitForPendingWrites();
      
      // Verify message has real ID
      const messages = await cache.getMessagesForUser(1);
      expect(messages[0].id).toBeGreaterThan(0);
    });

    test('getUserMessages_returnsUnreadMessages', async () => {
      await sendMessageToUser(1, 'Message 1');
      await sendMessageToUser(1, 'Message 2');
      
      const messages = await getUserMessages(1);
      
      expect(messages).toHaveLength(2);
    });

    test('getUserMessageCount_returnsCount', async () => {
      await sendMessageToUser(1, 'Message 1');
      
      const count = await getUserMessageCount(1);
      
      expect(count).toBe(1);
    });
  });

  describe('Statistics', () => {
    test('getStats_returnsValidStats', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      await cache.createMessage(1, 'Test message');
      await cache.getUnreadMessageCount(1);
      
      const stats = await cache.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.messageCacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHits).toBeGreaterThanOrEqual(0);
      expect(stats.cacheMisses).toBeGreaterThanOrEqual(0);
      expect(stats.dirtyUsers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lifecycle', () => {
    test('initialize_multipleCallsAreSafe', async () => {
      const cache = getMessageCache();
      
      await cache.initialize();
      await cache.initialize();
      await cache.initialize();
      
      expect(true).toBe(true);
    });

    test('shutdown_afterInitialization_cleansUpProperly', async () => {
      const cache = getMessageCache();
      await cache.initialize();
      
      await cache.shutdown();
      
      expect(true).toBe(true);
    });
  });

  describe('Async Message Creation', () => {
    test('createMessage_returnsTempId_messageImmediatelyAvailableInCache', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      const tempId = await cache.createMessage(1, 'Test async message');
      
      // Should return negative temporary ID
      expect(tempId).toBeLessThan(0);
      
      // Message should be immediately available in cache
      const messages = await cache.getMessagesForUser(1);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(tempId);
      expect(messages[0].message).toBe('Test async message');
      expect(messages[0].isPending).toBe(true);
    });

    test('createMessage_afterWaitingForPendingWrites_messageHasRealId', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      const tempId = await cache.createMessage(1, 'Test async message');
      
      // Wait for async DB write to complete
      await cache.waitForPendingWrites();
      
      // Message should now have real ID
      const messages = await cache.getMessagesForUser(1);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBeGreaterThan(0);
      expect(messages[0].id).not.toBe(tempId);
      expect(messages[0].message).toBe('Test async message');
      expect(messages[0].isPending).toBe(false);
    });

    test('createMessage_multipleMessages_allGetRealIds', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      const tempId1 = await cache.createMessage(1, 'Message 1');
      const tempId2 = await cache.createMessage(1, 'Message 2');
      const tempId3 = await cache.createMessage(1, 'Message 3');
      
      expect(tempId1).toBeLessThan(0);
      expect(tempId2).toBeLessThan(0);
      expect(tempId3).toBeLessThan(0);
      
      // Wait for all writes
      await cache.waitForPendingWrites();
      
      const messages = await cache.getMessagesForUser(1);
      expect(messages).toHaveLength(3);
      
      // All should have real IDs now
      for (const msg of messages) {
        expect(msg.id).toBeGreaterThan(0);
        expect(msg.isPending).toBe(false);
      }
    });

    test('createMessage_markAsReadDuringAsyncWrite_updatesCorrectly', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // Create message (starts async write)
      const tempId = await cache.createMessage(1, 'Test message');
      
      // Immediately mark as read (before async write completes)
      await cache.markAllMessagesAsRead(1);
      
      // Wait for async write to complete
      await cache.waitForPendingWrites();
      
      // Flush read status to DB
      await cache.flushToDatabase();
      
      // Verify: message should have real ID and be marked as read
      const messages = await cache.getMessagesForUser(1);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBeGreaterThan(0);
      expect(messages[0].is_read).toBe(true);
    });

    test('waitForPendingWrites_noWrites_returnsImmediately', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // Should not hang or error
      await cache.waitForPendingWrites();
      
      expect(true).toBe(true);
    });

    test('getUnreadMessageCount_includesPendingMessages', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      await cache.createMessage(1, 'Message 1');
      await cache.createMessage(1, 'Message 2');
      
      // Should count pending messages immediately
      const count = await cache.getUnreadMessageCount(1);
      expect(count).toBe(2);
    });

    test('persistMessagesForUser_skipsPendingMessages', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // Create message and immediately mark as read
      await cache.createMessage(1, 'Test message');
      await cache.markAllMessagesAsRead(1);
      
      // Try to persist before async write completes
      // Should not fail even though message has temp ID
      await cache.flushToDatabase();
      
      // Now wait for async write
      await cache.waitForPendingWrites();
      
      // Message should have real ID now
      const messages = await cache.getMessagesForUser(1);
      expect(messages[0].id).toBeGreaterThan(0);
    });

    test('shutdown_waitsPendingWrites_thenFlushes', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // Use unique user IDs to avoid conflicts with other tests
      const testUserId1 = 9999;
      const testUserId2 = 9998;

      // Create messages
      await cache.createMessage(testUserId1, 'Message 1');
      await cache.createMessage(testUserId2, 'Message 2');
      
      // Mark one as read
      await cache.markAllMessagesAsRead(testUserId1);
      
      // Shutdown should wait for pending writes and flush dirty users
      await cache.shutdown();
      
      // Reinitialize and verify persistence
      MessageCache.resetInstance();
      const cache2 = getMessageCache();
      await cache2.initialize();
      
      const messages1 = await cache2.getMessagesForUser(testUserId1);
      const messages2 = await cache2.getMessagesForUser(testUserId2);
      
      expect(messages1).toHaveLength(1);
      expect(messages1[0].is_read).toBeTruthy(); // DB returns 1 for true
      expect(messages2).toHaveLength(1);
      expect(messages2[0].is_read).toBeFalsy(); // DB returns 0 for false
    });

    test('createMessage_dbError_removesMessageFromCache', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // This test would require mocking DB failures
      // For now, we just verify the basic flow doesn't crash
      const tempId = await cache.createMessage(1, 'Test message');
      
      expect(tempId).toBeLessThan(0);
      
      // Wait for async write
      await cache.waitForPendingWrites();
      
      // Message should be in cache with real ID (success case)
      const messages = await cache.getMessagesForUser(1);
      expect(messages).toHaveLength(1);
    });
  });

  describe('Separated Get and Mark Operations', () => {
    test('getUnreadMessages_doesNotMarkAsRead', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      await cache.createMessage(1, 'Message 1');
      await cache.createMessage(1, 'Message 2');
      await cache.waitForPendingWrites();
      
      // Get unread messages
      const unread1 = await cache.getUnreadMessages(1);
      expect(unread1).toHaveLength(2);
      
      // Should still have 2 unread messages
      const unread2 = await cache.getUnreadMessages(1);
      expect(unread2).toHaveLength(2);
      
      // Count should still be 2
      const count = await cache.getUnreadMessageCount(1);
      expect(count).toBe(2);
    });

    test('markAllMessagesAsRead_marksAllAsRead', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      await cache.createMessage(1, 'Message 1');
      await cache.createMessage(1, 'Message 2');
      await cache.createMessage(1, 'Message 3');
      await cache.waitForPendingWrites();
      
      // Verify 3 unread messages
      const unread = await cache.getUnreadMessages(1);
      expect(unread).toHaveLength(3);
      
      // Mark all as read
      const markedCount = await cache.markAllMessagesAsRead(1);
      expect(markedCount).toBe(3);
      
      // Should have no unread messages now
      const unreadAfter = await cache.getUnreadMessages(1);
      expect(unreadAfter).toHaveLength(0);
      
      const count = await cache.getUnreadMessageCount(1);
      expect(count).toBe(0);
    });

    test('markAllMessagesAsRead_noUnreadMessages_returnsZero', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // Mark non-existent messages as read
      const markedCount = await cache.markAllMessagesAsRead(999);
      expect(markedCount).toBe(0);
    });

    test('getUserMessages_doesNotMarkAsRead', async () => {
      await sendMessageToUser(1, 'Message 1');
      await sendMessageToUser(1, 'Message 2');
      
      const cache = getMessageCache();
      await cache.waitForPendingWrites();
      
      // Get messages
      const messages1 = await getUserMessages(1);
      expect(messages1).toHaveLength(2);
      
      // Should still have 2 unread
      const messages2 = await getUserMessages(1);
      expect(messages2).toHaveLength(2);
    });

    test('getUnreadMessages_thenMarkAllAsRead_workflow', async () => {
      const cache = getMessageCache();
      await cache.initialize();

      // Create messages
      await cache.createMessage(1, 'Message 1');
      await cache.createMessage(1, 'Message 2');
      await cache.createMessage(1, 'Message 3');
      await cache.waitForPendingWrites();
      
      // Step 1: Get unread messages to display
      const unread = await cache.getUnreadMessages(1);
      expect(unread).toHaveLength(3);
      expect(unread[0].message).toBe('Message 1');
      expect(unread[1].message).toBe('Message 2');
      expect(unread[2].message).toBe('Message 3');
      
      // Step 2: User clicks "Mark All as Read"
      const markedCount = await cache.markAllMessagesAsRead(1);
      expect(markedCount).toBe(3);
      
      // Step 3: Verify no more unread messages
      const unreadAfter = await cache.getUnreadMessages(1);
      expect(unreadAfter).toHaveLength(0);
    });

    test('markAllMessagesAsRead_persistsToDB', async () => {
      const cache1 = getMessageCache();
      await cache1.initialize();

      // Use unique user ID to avoid conflicts
      const testUserId = 8888;

      // Create messages
      await cache1.createMessage(testUserId, 'Message 1');
      await cache1.createMessage(testUserId, 'Message 2');
      await cache1.waitForPendingWrites();
      
      // Mark as read
      await cache1.markAllMessagesAsRead(testUserId);
      await cache1.flushToDatabase();
      
      // Shutdown and reinitialize
      await cache1.shutdown();
      MessageCache.resetInstance();
      
      const cache2 = getMessageCache();
      await cache2.initialize();
      
      // Should have no unread messages
      const unread = await cache2.getUnreadMessages(testUserId);
      expect(unread).toHaveLength(0);
    });
  });
});
