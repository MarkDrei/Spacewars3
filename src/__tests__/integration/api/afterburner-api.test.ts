import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as afterburnerPOST } from '@/app/api/afterburner/route';
import { GET as shipStatsGET } from '@/app/api/ship-stats/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSessionWithUser } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * Helper to grant afterburner research to a user by username.
 * Sets afterburnerDuration, afterburnerCooldown, and afterburnerSpeedIncrease levels.
 */
async function grantAfterburnerResearch(
  username: string,
  durationLevel: number = 1,
  cooldownLevel: number = 1,
  speedIncreaseLevel: number = 1,
): Promise<void> {
  const ctx = createLockContext();
  const cache = UserCache.getInstance2();
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByUsername(userCtx, username);
    if (!user) throw new Error(`User not found: ${username}`);

    user.techTree.afterburnerDuration = durationLevel;
    user.techTree.afterburnerCooldown = cooldownLevel;
    user.techTree.afterburnerSpeedIncrease = speedIncreaseLevel;
    await cache.updateUserInCache(userCtx, user);
  });
}

describe('Afterburner API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    TimeMultiplierService.resetInstance();
    AfterburnerService.resetInstance();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
    TimeMultiplierService.resetInstance();
    AfterburnerService.resetInstance();
  });

  test('afterburner_durationResearchLevel0_cannotActivate', async () => {
    await withTransaction(async () => {
      // Default user has afterburnerDuration=0 (not researched)
      const { sessionCookie } = await createAuthenticatedSessionWithUser('ab_noresearch');

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );

      const response = await afterburnerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Afterburner not researched');
    });
  });

  test('afterburner_withDurationResearch_activatesSuccessfully', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_activate');

      // Grant afterburner research
      await grantAfterburnerResearch(username, 1, 1, 1);

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );

      const response = await afterburnerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.boostedSpeed).toBeGreaterThan(0);
      expect(data.previousSpeed).toBeDefined();
      expect(data.durationMs).toBeGreaterThan(0);
      expect(data.cooldownMs).toBeGreaterThan(0);
      expect(data.maxSpeed).toBeGreaterThan(0);
      // boostedSpeed should be > maxSpeed (speed boost applied)
      expect(data.boostedSpeed).toBeGreaterThan(data.maxSpeed);
    });
  });

  test('afterburner_activateWhileActive_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_active');

      await grantAfterburnerResearch(username, 1, 1, 1);

      // First activation should succeed
      const request1 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );
      const response1 = await afterburnerPOST(request1);
      expect(response1.status).toBe(200);

      // Second activation should fail (still active)
      const request2 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );
      const response2 = await afterburnerPOST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(data2.error).toBe('Afterburner already active');
    });
  });

  test('afterburner_activateWhileOnCooldown_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_cooldown');

      await grantAfterburnerResearch(username, 1, 1, 1);

      // Activate afterburner
      const request1 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );
      const response1 = await afterburnerPOST(request1);
      expect(response1.status).toBe(200);

      // Manually advance past the boost duration by manipulating state
      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();

      // Set activatedAt to far in the past (past duration but within cooldown)
      // Duration is 30s (30000ms), cooldown is 3600s (3600000ms)
      // Setting activatedAt to 60 seconds ago — past boost, in cooldown
      Object.assign(state!, { activatedAtMs: Date.now() - 60_000 });

      // Try to activate again — should fail with "on cooldown"
      const request2 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );
      const response2 = await afterburnerPOST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(data2.error).toBe('Afterburner on cooldown');
    });
  });

  test('afterburner_activateAndExpire_speedRestoredOnShipStats', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_expire');

      await grantAfterburnerResearch(username, 1, 1, 1);

      // Get initial ship stats to know maxSpeed
      const statsRequest1 = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse1 = await shipStatsGET(statsRequest1);
      const stats1 = await statsResponse1.json();
      expect(statsResponse1.status).toBe(200);
      const normalMaxSpeed = stats1.maxSpeed;

      // Activate afterburner
      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      const activateData = await activateResponse.json();
      expect(activateResponse.status).toBe(200);
      expect(activateData.boostedSpeed).toBeGreaterThan(normalMaxSpeed);

      // Verify ship speed is boosted via ship-stats
      const statsRequest2 = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse2 = await shipStatsGET(statsRequest2);
      const stats2 = await statsResponse2.json();
      expect(stats2.speed).toBeCloseTo(activateData.boostedSpeed, 1);
      expect(stats2.afterburner.isActive).toBe(true);

      // Simulate time passing: advance activation timestamp past boost duration
      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();
      // Move activatedAt far enough back that boost has expired
      Object.assign(state!, { activatedAtMs: Date.now() - state!.durationMs - 1000 });

      // Get ship-stats again — expiration should trigger speed capping
      const statsRequest3 = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse3 = await shipStatsGET(statsRequest3);
      const stats3 = await statsResponse3.json();

      // Speed should be capped at normalMaxSpeed (not boosted anymore)
      expect(stats3.speed).toBeLessThanOrEqual(normalMaxSpeed + 0.01);
      expect(stats3.afterburner.isActive).toBe(false);
      expect(stats3.afterburner.cooldownRemainingMs).toBeGreaterThan(0);
    });
  });

  test('afterburner_shipStatsShowsAfterburnerStatus', async () => {
    await withTransaction(async () => {
      const { sessionCookie } = await createAuthenticatedSessionWithUser('ab_stats');

      // Get ship-stats for a user with no afterburner research
      const request = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const response = await shipStatsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.afterburner).toBeDefined();
      expect(data.afterburner.isActive).toBe(false);
      expect(data.afterburner.canActivate).toBe(true); // No state → can activate
      expect(data.afterburner.durationResearchLevel).toBe(0);
      expect(data.afterburner.boostedSpeed).toBe(0);
      expect(data.afterburner.boostRemainingMs).toBe(0);
      expect(data.afterburner.cooldownRemainingMs).toBe(0);
    });
  });

  test('afterburner_withTimeMultiplier_durationExpiresEarlier', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_timemult');

      await grantAfterburnerResearch(username, 1, 1, 1);

      // Set time multiplier to 2x (everything happens twice as fast)
      TimeMultiplierService.getInstance().setMultiplier(2, 60);

      // Activate afterburner
      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        {},
        sessionCookie,
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      expect(activateResponse.status).toBe(200);

      // With 2x multiplier, advance half the raw duration → should be expired
      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();

      // Raw duration is 30000ms. With 2x multiplier, effective after 15001ms real time:
      // effective = 15001 * 2 = 30002ms > 30000ms → expired
      Object.assign(state!, { activatedAtMs: Date.now() - 15_001 });

      // Ship-stats should show afterburner as expired (not active)
      const statsRequest = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse = await shipStatsGET(statsRequest);
      const stats = await statsResponse.json();

      expect(stats.afterburner.isActive).toBe(false);
    });
  });
});
