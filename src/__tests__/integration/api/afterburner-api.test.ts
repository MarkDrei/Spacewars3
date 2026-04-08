import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as afterburnerPOST } from '@/app/api/afterburner/route';
import { GET as shipStatsGET } from '@/app/api/ship-stats/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSessionWithUser } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * Helper to set afterburner research levels for a user
 */
async function setAfterburnerResearch(
  username: string,
  durationLevel: number,
  speedIncreaseLevel: number
): Promise<void> {
  const ctx = createLockContext();
  const cache = UserCache.getInstance2();
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByUsername(userCtx, username);
    if (!user) throw new Error(`User not found: ${username}`);

    user.techTree.afterburnerDuration = durationLevel;
    user.techTree.afterburnerSpeedIncrease = speedIncreaseLevel;
    await cache.updateUserInCache(userCtx, user);
  });
}

/**
 * Helper to set user's inBattle state
 */
async function setUserInBattle(username: string, inBattle: boolean): Promise<void> {
  const ctx = createLockContext();
  const cache = UserCache.getInstance2();
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByUsername(userCtx, username);
    if (!user) throw new Error(`User not found: ${username}`);
    user.inBattle = inBattle;
    user.currentBattleId = inBattle ? 999 : null;
    await cache.updateUserInCache(userCtx, user);
  });
}

describe('Afterburner API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    TimeMultiplierService.resetInstance();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
    TimeMultiplierService.resetInstance();
  });

  test('afterburner_noResearch_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_noresearch');

      // Default afterburnerDuration is already 1, so set it to 0
      await setAfterburnerResearch(username, 0, 1);

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie
      );

      const response = await afterburnerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not researched');
    });
  });

  test('afterburner_hasResearch_activatesSuccessfully', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_activate');

      // Set afterburner research levels
      await setAfterburnerResearch(username, 1, 1);

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie
      );

      const response = await afterburnerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.afterburner).toBeDefined();
      expect(data.afterburner.isActive).toBe(true);
      expect(data.afterburner.boostedSpeed).toBeGreaterThan(data.afterburner.oldMaxSpeed);
      expect(data.afterburner.durationSeconds).toBe(60); // Level 1 = 60 seconds
      expect(data.afterburner.speedBoostPercent).toBe(50); // Level 1 = 50%
      expect(data.ship).toBeDefined();
      expect(data.ship.speed).toBe(data.afterburner.boostedSpeed);
    });
  });

  test('afterburner_alreadyActive_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_already');

      await setAfterburnerResearch(username, 1, 1);

      // First activation
      const request1 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie
      );
      const response1 = await afterburnerPOST(request1);
      expect(response1.status).toBe(200);

      // Second activation while first is still active
      const request2 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie
      );
      const response2 = await afterburnerPOST(request2);
      const data = await response2.json();

      expect(response2.status).toBe(400);
      expect(data.error).toContain('already active');
    });
  });

  test('afterburner_inBattle_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_battle');

      await setAfterburnerResearch(username, 1, 1);
      await setUserInBattle(username, true);

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie
      );

      const response = await afterburnerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('battle');
    });
  });

  test('shipStats_afterAfterburnerActivation_showsActiveStatus', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_stats');

      await setAfterburnerResearch(username, 1, 1);

      // Activate afterburner
      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      expect(activateResponse.status).toBe(200);

      // Check ship stats
      const statsRequest = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie
      );
      const statsResponse = await shipStatsGET(statsRequest);
      const statsData = await statsResponse.json();

      expect(statsResponse.status).toBe(200);
      expect(statsData.afterburner).toBeDefined();
      expect(statsData.afterburner.isActive).toBe(true);
      expect(statsData.afterburner.cooldownRemainingMs).toBeGreaterThan(0);
      expect(statsData.afterburner.canActivate).toBe(false);
      expect(statsData.afterburner.researchLevel).toBe(1);
    });
  });
});
