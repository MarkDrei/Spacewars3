// ---
// Tests for Messages API route handler (not HTTP requests)
// ---

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/messages/route';
import { POST } from '@/app/api/messages/mark-read/route';
import { createTestDatabase } from '../../helpers/testDatabase';
import { createRequest } from '../../helpers/apiTestHelpers';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { withTransaction } from '../../helpers/transactionHelper';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';

import { getDatabase } from '@/lib/server/database';

describe('Messages API Route Handler', () => {
  // Helper to get user ID by username
  async function getUserId(username: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!result.rows[0]) throw new Error(`User ${username} not found`);
    return result.rows[0].id;
  }

  beforeEach(async () => {
    // Ensure previous test's cache is fully shut down
    try {
      const cache = MessageCache.getInstance();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await cache.shutdown(lockCtx);
      });
    } catch {
      // Ignore if cache doesn't exist
    }
    
    // Reset message cache before each test
    const ctx = createLockContext();
    MessageCache.resetInstance(ctx);
    
    // Create fresh test database (this also creates test users 3-10)
    await createTestDatabase();
    
    // Clear messages from previous tests
    const { clearTestDatabase } = await import('../../helpers/testDatabase');
    await clearTestDatabase();
  });

  afterEach(async () => {
    // Ensure cache is shut down after each test
    try {
      const cache = MessageCache.getInstance();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await cache.shutdown(lockCtx);
      });
      MessageCache.resetInstance(ctx);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('messages_authenticatedUserNoMessages_returnsEmptyArray', async () => {
    await withTransaction(async () => {
      // Test using MessageCache (single source of truth)
      // Use test user 3 for isolation from other tests
      const userId = await getUserId('testuser3');
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await MessageCache.initialize(lockCtx);
      });
      const cache = MessageCache.getInstance();
      
      const ctx2 = createLockContext();
      const messages = await cache.getUnreadMessages(ctx2, userId);
      
      expect(messages).toEqual([]);
    });
  });

  test('messages_cacheIntegration_worksWithDatabase', async () => {
    await withTransaction(async () => {
      // Test the MessageCache integration with database
      // Use test user 3 for isolation from other tests
      const userId = await getUserId('testuser3');
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
        await MessageCache.initialize(lockCtx);
      });
      const cache = MessageCache.getInstance();
      
      // Create a message
      const ctx2 = createLockContext();
      await cache.createMessage(ctx2, userId, 'Test message');
      await cache.waitForPendingWrites();
      
      // Retrieve it
      const ctx3 = createLockContext();
      const messages = await cache.getUnreadMessages(ctx3, userId);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Test message');
      // UnreadMessage type doesn't include recipient_id, which is correct for the API response
    });
  });

  describe('Mark Messages as Read', () => {
    test('markRead_noMessages_returnsZero', async () => {
      await withTransaction(async () => {
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        
        const ctx2 = createLockContext();
        const markedCount = await cache.markAllMessagesAsRead(ctx2, 999);
        
        expect(markedCount).toBe(0);
      });
    });

    test('markRead_withMessages_marksThemAsRead', async () => {
      await withTransaction(async () => {
        // Use test user 3 for isolation from other tests
        const userId = await getUserId('testuser3');
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        
        // Create messages
        const ctx2 = createLockContext();
        await cache.createMessage(ctx2, userId, 'Message 1');
        const ctx3 = createLockContext();
        await cache.createMessage(ctx3, userId, 'Message 2');
        await cache.waitForPendingWrites();
        
        // Verify messages are unread
        const ctx4 = createLockContext();
        const unread = await cache.getUnreadMessages(ctx4, userId);
        expect(unread).toHaveLength(2);
        
        // Mark as read
        const ctx5 = createLockContext();
        const markedCount = await cache.markAllMessagesAsRead(ctx5, userId);
        expect(markedCount).toBe(2);
        
        // Verify no more unread messages
        const ctx6 = createLockContext();
        const unreadAfter = await cache.getUnreadMessages(ctx6, userId);
        expect(unreadAfter).toHaveLength(0);
      });
    });

    test('getMessages_doesNotMarkAsRead_thenMarkReadWorks', async () => {
      await withTransaction(async () => {
        // Use test user 3 for isolation from other tests
        const userId = await getUserId('testuser3');
        const ctx = createLockContext();
        await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (lockCtx) => {
          await MessageCache.initialize(lockCtx);
        });
        const cache = MessageCache.getInstance();
        
        // Create messages
        const ctx2 = createLockContext();
        await cache.createMessage(ctx2, userId, 'Message 1');
        const ctx3 = createLockContext();
        await cache.createMessage(ctx3, userId, 'Message 2');
        await cache.waitForPendingWrites();
        
        // Get messages - should NOT mark as read
        const ctx4 = createLockContext();
        const messages1 = await cache.getUnreadMessages(ctx4, userId);
        expect(messages1).toHaveLength(2);
        
        // Messages should still be unread
        const ctx5 = createLockContext();
        const messages2 = await cache.getUnreadMessages(ctx5, userId);
        expect(messages2).toHaveLength(2);
        
        // Now mark as read
        const ctx6 = createLockContext();
        const markedCount = await cache.markAllMessagesAsRead(ctx6, userId);
        expect(markedCount).toBe(2);
        
        // Should have no unread messages
        const ctx7 = createLockContext();
        const messages3 = await cache.getUnreadMessages(ctx7, userId);
        expect(messages3).toHaveLength(0);
      });
    });
  });
});