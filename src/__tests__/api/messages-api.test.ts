// ---
// Tests for Messages API route handler (not HTTP requests)
// ---

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/messages/route';
import { POST } from '@/app/api/messages/mark-read/route';
import { createTestDatabase } from '../helpers/testDatabase';
import { createRequest } from '../helpers/apiTestHelpers';
import { getMessageCache, MessageCache } from '@/lib/server/messages/MessageCache';
import { withTransaction } from '../helpers/transactionHelper';

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
      await MessageCache.initialize();
      const cache = getMessageCache();
      await cache.shutdown();
    } catch {
      // Ignore if cache doesn't exist
    }
    
    // Reset message cache before each test
    MessageCache.resetInstance();
    
    // Create fresh test database (this also creates test users 3-10)
    await createTestDatabase();
    
    // Clear messages from previous tests
    const { clearTestDatabase } = await import('../helpers/testDatabase');
    await clearTestDatabase();
  });

  afterEach(async () => {
    // Ensure cache is shut down after each test
    try {
      await MessageCache.initialize();
      const cache = getMessageCache();
      await cache.shutdown();
      MessageCache.resetInstance();
    } catch {
      // Ignore cleanup errors
    }
  });

  test('messages_notAuthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/messages', 'GET');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Not authenticated');
    });
  });

  test('messages_authenticatedUserNoMessages_returnsEmptyArray', async () => {
    await withTransaction(async () => {
      // Test using MessageCache (single source of truth)
      // Use test user 3 for isolation from other tests
      const userId = await getUserId('testuser3');
      await MessageCache.initialize();
      const cache = getMessageCache();
      
      
      const messages = await cache.getUnreadMessages(userId);
      
      expect(messages).toEqual([]);
    });
  });

  test('messages_cacheIntegration_worksWithDatabase', async () => {
    await withTransaction(async () => {
      // Test the MessageCache integration with database
      // Use test user 3 for isolation from other tests
      const userId = await getUserId('testuser3');
      await MessageCache.initialize();
      const cache = getMessageCache();
      
      
      // Create a message
      await cache.createMessage(userId, 'Test message');
      await cache.waitForPendingWrites();
      
      // Retrieve it
      const messages = await cache.getUnreadMessages(userId);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Test message');
      // UnreadMessage type doesn't include recipient_id, which is correct for the API response
    });
  });

  describe('Mark Messages as Read', () => {
    test('markRead_notAuthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/messages/mark-read', 'POST');
        const response = await POST(request);
        
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Not authenticated');
      });
    });

    test('markRead_noMessages_returnsZero', async () => {
      await withTransaction(async () => {
        await MessageCache.initialize();
      const cache = getMessageCache();
        
        
        const markedCount = await cache.markAllMessagesAsRead(999);
        
        expect(markedCount).toBe(0);
      });
    });

    test('markRead_withMessages_marksThemAsRead', async () => {
      await withTransaction(async () => {
        // Use test user 3 for isolation from other tests
        const userId = await getUserId('testuser3');
        await MessageCache.initialize();
      const cache = getMessageCache();
        
        
        // Create messages
        await cache.createMessage(userId, 'Message 1');
        await cache.createMessage(userId, 'Message 2');
        await cache.waitForPendingWrites();
        
        // Verify messages are unread
        const unread = await cache.getUnreadMessages(userId);
        expect(unread).toHaveLength(2);
        
        // Mark as read
        const markedCount = await cache.markAllMessagesAsRead(userId);
        expect(markedCount).toBe(2);
        
        // Verify no more unread messages
        const unreadAfter = await cache.getUnreadMessages(userId);
        expect(unreadAfter).toHaveLength(0);
      });
    });

    test('getMessages_doesNotMarkAsRead_thenMarkReadWorks', async () => {
      await withTransaction(async () => {
        // Use test user 3 for isolation from other tests
        const userId = await getUserId('testuser3');
        await MessageCache.initialize();
      const cache = getMessageCache();
        
        
        // Create messages
        await cache.createMessage(userId, 'Message 1');
        await cache.createMessage(userId, 'Message 2');
        await cache.waitForPendingWrites();
        
        // Get messages - should NOT mark as read
        const messages1 = await cache.getUnreadMessages(userId);
        expect(messages1).toHaveLength(2);
        
        // Messages should still be unread
        const messages2 = await cache.getUnreadMessages(userId);
        expect(messages2).toHaveLength(2);
        
        // Now mark as read
        const markedCount = await cache.markAllMessagesAsRead(userId);
        expect(markedCount).toBe(2);
        
        // Should have no unread messages
        const messages3 = await cache.getUnreadMessages(userId);
        expect(messages3).toHaveLength(0);
      });
    });
  });
});