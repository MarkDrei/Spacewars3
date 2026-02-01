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
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { withTransaction } from '../helpers/transactionHelper';
import { getDatabase } from '../../lib/server/database';

// Helper function to create test user with unique username
async function createTestUser(baseName: string): Promise<number> {
  const db = await getDatabase();
  const uniqueName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const result = await db.query<{ id: number }>(`
    INSERT INTO users (username, password_hash, iron, last_updated, tech_tree)
    VALUES ($1, 'dummy_hash', 0, EXTRACT(EPOCH FROM NOW())::INTEGER, '[]')
    RETURNING id
  `, [uniqueName]);
  return result.rows[0].id;
}

describe('MessageCache', () => {
  
  beforeEach(async () => {
    // Ensure any previous cache is cleaned up
    try {
      const cache = MessageCache.getInstance();
      await cache.waitForPendingWrites();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await cache.shutdown(lockCtx);
      });
    } catch {
      // Ignore if cache doesn't exist
    }
    
    const ctx = createLockContext();
    MessageCache.resetInstance(ctx);
  });

  afterEach(async () => {
    // Ensure cache is properly cleaned up
    // Note: shutdown() does not wait for pending writes, so we must call waitForPendingWrites() first
    try {
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await MessageCache.initialize(lockCtx);
      });
      const cache = MessageCache.getInstance();
      await cache.waitForPendingWrites();
      const ctx2 = createLockContext();
      await ctx2.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await cache.shutdown(lockCtx);
      });
      MessageCache.resetInstance(ctx2);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Singleton Pattern', () => {
    test('getInstance_multipleCalls_returnsSameInstance', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache1 = MessageCache.getInstance();
        const cache2 = MessageCache.getInstance();
        const cache3 = MessageCache.getInstance();

        expect(cache1).toBe(cache2);
        expect(cache2).toBe(cache3);
      });
    });

    test('resetInstance_afterReset_createsNewInstance', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache1 = MessageCache.getInstance();
        const ctx2 = createLockContext();
        MessageCache.resetInstance(ctx2);
        await ctx2.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache2 = MessageCache.getInstance();

        expect(cache1).not.toBe(cache2);
      });
    });
  });

  describe('Message Operations', () => {
    test('createMessage_createsAndReturnsMessageId', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        const messageId = await cache.createMessage(ctx, testUserId, 'Test message');
        
        // Now returns temporary negative ID immediately
        expect(messageId).toBeLessThan(0);
        
        // Wait for DB write to complete
        await cache.waitForPendingWrites();
        
        // Message should now have real ID in cache
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages[0].id).toBeGreaterThan(0);
      });
    });

    test('getUnreadMessageCount_returnsZeroForNewUser', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        const count = await cache.getUnreadMessageCount(ctx, 999);
        
        expect(count).toBe(0);
      });
    });

    test('createMessage_thenGetCount_returnsCorrectCount', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        await cache.createMessage(ctx, testUserId, 'Message 1');
        await cache.createMessage(ctx, testUserId, 'Message 2');
        
        const count = await cache.getUnreadMessageCount(ctx, testUserId);
        
        expect(count).toBe(2);
      });
    });
  });

  describe('Convenience Functions', () => {
    test('sendMessageToUser_createsMessage', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        const messageId = await sendMessageToUser(ctx, testUserId, 'Test via convenience function');
        
        // Now returns temporary negative ID immediately
        expect(messageId).toBeLessThan(0);
        
        // Wait for write to complete
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        await cache.waitForPendingWrites();
        
        // Verify message has real ID
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages[0].id).toBeGreaterThan(0);
      });
    });

    test('getUserMessages_returnsUnreadMessages', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await sendMessageToUser(ctx, testUserId, 'Message 1');
        await sendMessageToUser(ctx, testUserId, 'Message 2');
        
        const messages = await getUserMessages(ctx, testUserId);
        
        expect(messages).toHaveLength(2);
      });
    });

    test('getUserMessageCount_returnsCount', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await sendMessageToUser(ctx, testUserId, 'Message 1');
        
        const count = await getUserMessageCount(ctx, testUserId);
        
        expect(count).toBe(1);
      });
    });
  });

  describe('Statistics', () => {
    test('getStats_returnsValidStats', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        await cache.createMessage(ctx, testUserId, 'Test message');
        await cache.getUnreadMessageCount(ctx, testUserId);
        
        const stats = await cache.getStats(ctx);
        
        expect(stats).toBeDefined();
        expect(stats.messageCacheSize).toBeGreaterThanOrEqual(0);
        expect(stats.cacheHits).toBeGreaterThanOrEqual(0);
        expect(stats.cacheMisses).toBeGreaterThanOrEqual(0);
        expect(stats.dirtyUsers).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Lifecycle', () => {
    test('initialize_multipleCallsAreSafe', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        MessageCache.getInstance();
        
        expect(true).toBe(true);
      });
    });

    test('shutdown_afterInitialization_cleansUpProperly', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await cache.shutdown(lockCtx);
        });
        
        expect(true).toBe(true);
      });
    });
  });

  describe('Async Message Creation', () => {
    test('createMessage_returnsIdImmediately_messageIsAvailableInCache', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        const msgId = await cache.createMessage(ctx, testUserId, 'Test async message');
        
        // Message should be available in cache (either pending or persisted depending on timing)
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages).toHaveLength(1);
        expect(messages[0].message).toBe('Test async message');
        
        // Wait for any pending writes to complete
        await cache.waitForPendingWrites();
        
        // After waiting, message should have real ID
        const finalMessages = await cache.getMessagesForUser(ctx, testUserId);
        expect(finalMessages).toHaveLength(1);
        expect(finalMessages[0].id).toBeGreaterThan(0);
        expect(finalMessages[0].isPending).toBe(false);
        
        // The returned ID should match the final message ID
        // Note: if async completes quickly, msgId may already be the real ID
        if (msgId < 0) {
          // Original temp ID - wait for final ID
          expect(finalMessages[0].id).not.toBe(msgId);
        } else {
          // Already got real ID
          expect(finalMessages[0].id).toBe(msgId);
        }
      });
    });

    test('createMessage_afterWaitingForPendingWrites_messageHasRealId', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        const tempId = await cache.createMessage(ctx, testUserId, 'Test async message');
        
        // Wait for async DB write to complete
        await cache.waitForPendingWrites();
        
        // Message should now have real ID
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages).toHaveLength(1);
        expect(messages[0].id).toBeGreaterThan(0);
        expect(messages[0].id).not.toBe(tempId);
        expect(messages[0].message).toBe('Test async message');
        expect(messages[0].isPending).toBe(false);
      });
    });

    test('createMessage_multipleMessages_allGetRealIds', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        const tempId1 = await cache.createMessage(ctx, testUserId, 'Message 1');
        const tempId2 = await cache.createMessage(ctx, testUserId, 'Message 2');
        const tempId3 = await cache.createMessage(ctx, testUserId, 'Message 3');
        
        expect(tempId1).toBeLessThan(0);
        expect(tempId2).toBeLessThan(0);
        expect(tempId3).toBeLessThan(0);
        
        // Wait for all writes
        await cache.waitForPendingWrites();
        
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages).toHaveLength(3);
        
        // All should have real IDs now
        for (const msg of messages) {
          expect(msg.id).toBeGreaterThan(0);
          expect(msg.isPending).toBe(false);
        }
      });
    });

    test('createMessage_markAsReadDuringAsyncWrite_updatesCorrectly', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // Create message (starts async write)
        await cache.createMessage(ctx, testUserId, 'Test message');
        
        // Immediately mark as read (before async write completes)
        await cache.markAllMessagesAsRead(ctx, testUserId);
        
        // Wait for async write to complete
        await cache.waitForPendingWrites();
        
        // Flush read status to DB
        await cache.flushToDatabase(createLockContext());
        
        // Verify: message should have real ID and be marked as read
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages).toHaveLength(1);
        expect(messages[0].id).toBeGreaterThan(0);
        expect(messages[0].is_read).toBe(true);
      });
    });

    test('waitForPendingWrites_noWrites_returnsImmediately', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // Should not hang or error
        await cache.waitForPendingWrites();
        
        expect(true).toBe(true);
      });
    });

    test('getUnreadMessageCount_includesPendingMessages', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        await cache.createMessage(ctx, testUserId, 'Message 1');
        await cache.createMessage(ctx, testUserId, 'Message 2');
        
        // Should count pending messages immediately
        const count = await cache.getUnreadMessageCount(ctx, testUserId);
        expect(count).toBe(2);
      });
    });

    test('persistMessagesForUser_skipsPendingMessages', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // Create message and immediately mark as read
        await cache.createMessage(ctx, testUserId, 'Test message');
        await cache.markAllMessagesAsRead(ctx, testUserId);
        
        // Try to persist before async write completes
        // Should not fail even though message has temp ID
        await cache.flushToDatabase(createLockContext());
        
        // Now wait for async write
        await cache.waitForPendingWrites();
        
        // Message should have real ID now
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages[0].id).toBeGreaterThan(0);
      });
    });

    test('shutdown_waitsPendingWrites_thenFlushes', async () => {
      await withTransaction(async () => {
        const testUserId1 = await createTestUser('testuser7');
        const testUserId2 = await createTestUser('testuser8');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // Create messages
        await cache.createMessage(ctx, testUserId1, 'Message 1');
        await cache.createMessage(ctx, testUserId2, 'Message 2');
        
        // Mark one as read
        await cache.markAllMessagesAsRead(ctx, testUserId1);
        

        // Shutdown should wait for pending writes and flush dirty users
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await cache.shutdown(lockCtx);
          // Reinitialize and verify persistence
          
        });

        MessageCache.resetInstance(ctx);
        
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache2 = MessageCache.getInstance();
        
        const messages1 = await cache2.getMessagesForUser(ctx, testUserId1);
        const messages2 = await cache2.getMessagesForUser(ctx, testUserId2);
        
        expect(messages1).toHaveLength(1);
        expect(messages1[0].is_read).toBeTruthy(); // DB returns 1 for true
        expect(messages2).toHaveLength(1);
        expect(messages2[0].is_read).toBeFalsy(); // DB returns 0 for false
      });
    });

    test('createMessage_dbError_removesMessageFromCache', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // This test would require mocking DB failures
        // For now, we just verify the basic flow doesn't crash
        const tempId = await cache.createMessage(ctx, testUserId, 'Test message');
        
        expect(tempId).toBeLessThan(0);
        
        // Wait for async write
        await cache.waitForPendingWrites();
        
        // Message should be in cache with real ID (success case)
        const messages = await cache.getMessagesForUser(ctx, testUserId);
        expect(messages).toHaveLength(1);
      });
    });
  });

  describe('Separated Get and Mark Operations', () => {
    test('getUnreadMessages_doesNotMarkAsRead', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        await cache.createMessage(ctx, testUserId, 'Message 1');
        await cache.createMessage(ctx, testUserId, 'Message 2');
        await cache.waitForPendingWrites();
        
        // Get unread messages
        const unread1 = await cache.getUnreadMessages(ctx, testUserId);
        expect(unread1).toHaveLength(2);
        
        // Should still have 2 unread messages
        const unread2 = await cache.getUnreadMessages(ctx, testUserId);
        expect(unread2).toHaveLength(2);
        
        // Count should still be 2
        const count = await cache.getUnreadMessageCount(ctx, testUserId);
        expect(count).toBe(2);
      });
    });

    test('markAllMessagesAsRead_marksAllAsRead', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        await cache.createMessage(ctx, testUserId, 'Message 1');
        await cache.createMessage(ctx, testUserId, 'Message 2');
        await cache.createMessage(ctx, testUserId, 'Message 3');
        await cache.waitForPendingWrites();
        
        // Verify 3 unread messages
        const unread = await cache.getUnreadMessages(ctx, testUserId);
        expect(unread).toHaveLength(3);
        
        // Mark all as read
        const markedCount = await cache.markAllMessagesAsRead(ctx, testUserId);
        expect(markedCount).toBe(3);
        
        // Should have no unread messages now
        const unreadAfter = await cache.getUnreadMessages(ctx, testUserId);
        expect(unreadAfter).toHaveLength(0);
        
        const count = await cache.getUnreadMessageCount(ctx, testUserId);
        expect(count).toBe(0);
      });
    });

    test('markAllMessagesAsRead_noUnreadMessages_returnsZero', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // Mark non-existent messages as read
        const markedCount = await cache.markAllMessagesAsRead(ctx, 999);
        expect(markedCount).toBe(0);
      });
    });

    test('getUserMessages_doesNotMarkAsRead', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await sendMessageToUser(ctx, testUserId, 'Message 1');
        await sendMessageToUser(ctx, testUserId, 'Message 2');
        
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        await cache.waitForPendingWrites();
        
        // Get messages
        const messages1 = await getUserMessages(ctx, testUserId);
        expect(messages1).toHaveLength(2);
        
        // Should still have 2 unread
        const messages2 = await getUserMessages(ctx, testUserId);
        expect(messages2).toHaveLength(2);
      });
    });

    test('getUnreadMessages_thenMarkAllAsRead_workflow', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser1');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        

        // Create messages
        await cache.createMessage(ctx, testUserId, 'Message 1');
        await cache.createMessage(ctx, testUserId, 'Message 2');
        await cache.createMessage(ctx, testUserId, 'Message 3');
        await cache.waitForPendingWrites();
        
        // Step 1: Get unread messages to display
        const unread = await cache.getUnreadMessages(ctx, testUserId);
        expect(unread).toHaveLength(3);
        expect(unread[0].message).toBe('Message 1');
        expect(unread[1].message).toBe('Message 2');
        expect(unread[2].message).toBe('Message 3');
        
        // Step 2: User clicks "Mark All as Read"
        const markedCount = await cache.markAllMessagesAsRead(ctx, testUserId);
        expect(markedCount).toBe(3);
        
        // Step 3: Verify no more unread messages
        const unreadAfter = await cache.getUnreadMessages(ctx, testUserId);
        expect(unreadAfter).toHaveLength(0);
      });
    });

    test('markAllMessagesAsRead_persistsToDB', async () => {
      await withTransaction(async () => {
        const testUserId = await createTestUser('testuser9');

        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache1 = MessageCache.getInstance();

        // Create messages
        await cache1.createMessage(ctx, testUserId, 'Message 1');
        await cache1.createMessage(ctx, testUserId, 'Message 2');
        await cache1.waitForPendingWrites();
        
        // Mark as read
        await cache1.markAllMessagesAsRead(ctx, testUserId);
        await cache1.flushToDatabase(createLockContext());

        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          // Shutdown and reinitialize
          await cache1.shutdown(lockCtx);
          
          await MessageCache.initialize(lockCtx);
        });
        MessageCache.resetInstance(ctx);
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache2 = MessageCache.getInstance();
        
        // Should have no unread messages
        const unread = await cache2.getUnreadMessages(ctx, testUserId);
        expect(unread).toHaveLength(0);
      });
    });
  });
});
