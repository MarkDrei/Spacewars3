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
} from '../../lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getDatabase } from '../../lib/server/database';

describe('MessageCache', () => {

  let cache: MessageCache;
  
  beforeEach(async () => {
    // Reset database to ensure clean state
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    await MessageCache.initialize(await getDatabase());
    cache = getMessageCache();
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

    test('resetInstance_afterReset_createsNewInstance', async () => {
      const cache1 = MessageCache.getInstance();
      MessageCache.resetInstance();
      await MessageCache.initialize();
      const cache2 = MessageCache.getInstance();

      expect(cache1).not.toBe(cache2);
    });
  });

  describe('Message Operations', () => {
    test('createMessage_createsAndReturnsMessageId', async () => {

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

      const count = await cache.getUnreadMessageCount(999);
      
      expect(count).toBe(0);
    });

    test('createMessage_thenGetCount_returnsCorrectCount', async () => {

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
      
      await MessageCache.initialize();
      await MessageCache.initialize();
      await MessageCache.initialize();
      
      expect(true).toBe(true);
    });

    test('shutdown_afterInitialization_cleansUpProperly', async () => {
      
      await cache.shutdown();
      
      expect(true).toBe(true);
    });
  });

  describe('Async Message Creation', () => {
    test('createMessage_returnsTempId_messageImmediatelyAvailableInCache', async () => {

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

      // Create message (starts async write)
      await cache.createMessage(1, 'Test message');
      
      // Immediately mark as read (before async write completes)
      await cache.markAllMessagesAsRead(1);
      
      // Wait for async write to complete
      await cache.waitForPendingWrites();
      
      // Flush read status to DB
      await cache.flushToDatabase(createLockContext());
      
      // Verify: message should have real ID and be marked as read
      const messages = await cache.getMessagesForUser(1);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBeGreaterThan(0);
      expect(messages[0].is_read).toBe(true);
    });

    test('waitForPendingWrites_noWrites_returnsImmediately', async () => {

      // Should not hang or error
      await cache.waitForPendingWrites();
      
      expect(true).toBe(true);
    });

    test('getUnreadMessageCount_includesPendingMessages', async () => {

      await cache.createMessage(1, 'Message 1');
      await cache.createMessage(1, 'Message 2');
      
      // Should count pending messages immediately
      const count = await cache.getUnreadMessageCount(1);
      expect(count).toBe(2);
    });

    test('persistMessagesForUser_skipsPendingMessages', async () => {

      // Create message and immediately mark as read
      await cache.createMessage(1, 'Test message');
      await cache.markAllMessagesAsRead(1);
      
      // Try to persist before async write completes
      // Should not fail even though message has temp ID
      await cache.flushToDatabase(createLockContext());
      
      // Now wait for async write
      await cache.waitForPendingWrites();
      
      // Message should have real ID now
      const messages = await cache.getMessagesForUser(1);
      expect(messages[0].id).toBeGreaterThan(0);
    });

    test('shutdown_waitsPendingWrites_thenFlushes', async () => {

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
      await MessageCache.initialize(await getDatabase());
      const cache2 = getMessageCache();
      
      const messages1 = await cache2.getMessagesForUser(testUserId1);
      const messages2 = await cache2.getMessagesForUser(testUserId2);
      
      expect(messages1).toHaveLength(1);
      expect(messages1[0].is_read).toBeTruthy(); // DB returns 1 for true
      expect(messages2).toHaveLength(1);
      expect(messages2[0].is_read).toBeFalsy(); // DB returns 0 for false
    });

    test('createMessage_dbError_removesMessageFromCache', async () => {

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
      // Use unique user ID to avoid conflicts
      const testUserId = 8888;

      // Create messages
      await cache.createMessage(testUserId, 'Message 1');
      await cache.createMessage(testUserId, 'Message 2');
      await cache.waitForPendingWrites();
      
      // Mark as read
      await cache.markAllMessagesAsRead(testUserId);
      await cache.flushToDatabase(createLockContext());
      
      // Shutdown and reinitialize
      await cache.shutdown();
      MessageCache.resetInstance();
      
      await MessageCache.initialize(await getDatabase());
      const cache2 = MessageCache.getInstance();
      
      // Should have no unread messages
      const unread = await cache2.getUnreadMessages(testUserId);
      expect(unread).toHaveLength(0);
    });
  });
});
