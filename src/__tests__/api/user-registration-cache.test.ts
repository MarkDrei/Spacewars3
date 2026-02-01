import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { POST as registerPOST } from '@/app/api/register/route';
import { GET as shipStatsGET } from '@/app/api/ship-stats/route';
import { createRequest, randomUsername } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

describe('User Registration Cache Synchronization', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('register_newUser_userImmediatelyInCache', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      const request = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass'
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Check if user is in cache immediately after registration
      const userCache = UserCache.getInstance2();
      const ctx = createLockContext();
      const user = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return userCache.getUserByUsername(userContext, username);
      });

      expect(user).not.toBeNull();
      expect(user?.username).toBe(username);
      expect(user?.shipId).toBeDefined();
      expect(user?.shipId).not.toBeNull();
    });
  });

  test('register_newUserThenGetShipStats_shipStatsAvailable', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      const password = 'testpass';
      
      // Register a new user
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password
      });

      const registerResponse = await registerPOST(registerRequest);
      const registerData = await registerResponse.json();

      expect(registerResponse.status).toBe(200);
      expect(registerData.success).toBe(true);

      // Get the session cookie from the register response to use for authenticated request
      const setCookieHeader = registerResponse.headers.get('set-cookie');
      const sessionCookie = setCookieHeader?.match(/spacewars-session=([^;]+)/)?.[0] || '';
      
      // Immediately try to get ship stats (this should work without requiring a second login)
      const shipStatsRequest = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie
      );

      const shipStatsResponse = await shipStatsGET(shipStatsRequest);
      
      // This should succeed - the ship should be found
      expect(shipStatsResponse.status).toBe(200);
      
      const shipStatsData = await shipStatsResponse.json();
      expect(shipStatsData.x).toBeDefined();
      expect(shipStatsData.y).toBeDefined();
      expect(shipStatsData.defenseValues).toBeDefined();
    });
  });
});
