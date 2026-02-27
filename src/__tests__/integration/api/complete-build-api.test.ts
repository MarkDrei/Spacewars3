import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as completeBuildPOST } from '@/app/api/complete-build/route';
import { POST as buildItemPOST } from '@/app/api/build-item/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';

// Import shared test helpers
import { createRequest, extractSessionCookie } from '../../helpers/apiTestHelpers';
import { withTransaction } from '../../helpers/transactionHelper';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';

describe('Complete Build API (Cheat Mode)', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('completeBuild_userA_canUseCheatMode', async () => {
    await withTransaction(async () => {
      // Use seeded user 'a' from test database (password 'a')
      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', { 
        username: 'a', 
        password: 'a'  // Seeded test user credentials
      });
      const loginResponse = await loginPOST(loginRequest);
      const sessionCookie = extractSessionCookie(loginResponse);
      
      if (!sessionCookie) {
        throw new Error('Failed to get session cookie for user a');
      }

      // First, build an item to have something in the queue
      const buildRequest = createRequest(
        'http://localhost:3000/api/build-item',
        'POST',
        { itemKey: 'pulse_laser', itemType: 'weapon' },
        sessionCookie
      );
      const buildResponse = await buildItemPOST(buildRequest);
      expect(buildResponse.status).toBe(200);

      // Now complete the build using cheat mode
      const completeRequest = createRequest(
        'http://localhost:3000/api/complete-build',
        'POST',
        {},
        sessionCookie
      );
      const completeResponse = await completeBuildPOST(completeRequest);
      const data = await completeResponse.json();

      expect(completeResponse.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Completed');
      expect(data.completedItem).toBeDefined();
      expect(data.completedItem.itemKey).toBe('pulse_laser');
      expect(data.completedItem.itemType).toBe('weapon');
    });
  });

  test('completeBuild_regularUser_returns403', async () => {
    await withTransaction(async () => {
      // Create a regular user (not 'a' or 'q')
      const username = `regularuser_${Date.now()}`;
      const password = 'testpass123';
      
      // Register the user
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', { 
        username, 
        password 
      });
      const registerResponse = await registerPOST(registerRequest);
      expect(registerResponse.status).toBe(200);
      
      // Login
      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', { 
        username, 
        password 
      });
      const loginResponse = await loginPOST(loginRequest);
      const sessionCookie = extractSessionCookie(loginResponse);
      
      if (!sessionCookie) {
        throw new Error('Failed to get session cookie for regular user');
      }

      // Try to complete the build using cheat mode (should fail with 403)
      // Even without a build in queue, the auth check should happen first
      const completeRequest = createRequest(
        'http://localhost:3000/api/complete-build',
        'POST',
        {},
        sessionCookie
      );
      const completeResponse = await completeBuildPOST(completeRequest);
      const data = await completeResponse.json();

      expect(completeResponse.status).toBe(403);
      expect(data.error).toBe('Cheat mode only available for developers');
    });
  });

  test('completeBuild_emptyQueue_returnsAppropriateMessage', async () => {
    await withTransaction(async () => {
      // Use seeded user 'a' from test database (password 'a')
      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', { 
        username: 'a', 
        password: 'a'
      });
      const loginResponse = await loginPOST(loginRequest);
      const sessionCookie = extractSessionCookie(loginResponse);
      
      if (!sessionCookie) {
        throw new Error('Failed to get session cookie');
      }

      // Try to complete build when queue is empty
      const completeRequest = createRequest(
        'http://localhost:3000/api/complete-build',
        'POST',
        {},
        sessionCookie
      );
      const completeResponse = await completeBuildPOST(completeRequest);
      const data = await completeResponse.json();

      expect(completeResponse.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toBe('No builds in queue to complete');
    });
  });
});