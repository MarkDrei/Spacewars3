import { describe, expect, test, beforeEach, afterEach } from 'vitest';

import { POST as afterburnerPOST } from '@/app/api/afterburner/route';
import { GET as shipStatsGET } from '@/app/api/ship-stats/route';

import { createRequest, createAuthenticatedSessionWithUser } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

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
      const { sessionCookie } = await createAuthenticatedSessionWithUser('ab_noresearch');

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
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
      await grantAfterburnerResearch(username, 1, 1, 1);

      const request = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );

      const response = await afterburnerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.action).toBe('activated');
      expect(data.boostedSpeed).toBeGreaterThan(data.maxSpeed);
      expect(data.fuelCapacityMs).toBeGreaterThan(0);
      expect(data.fuelRemainingMs).toBe(data.fuelCapacityMs);
      expect(data.fuelPercent).toBe(100);
    });
  });

  test('afterburner_activateWhileActive_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_active');
      await grantAfterburnerResearch(username, 1, 1, 1);

      const request1 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );
      const response1 = await afterburnerPOST(request1);
      expect(response1.status).toBe(200);

      const request2 = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );
      const response2 = await afterburnerPOST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(data2.error).toBe('Afterburner already active');
    });
  });

  test('afterburner_activateBelowFuelThreshold_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_threshold');
      await grantAfterburnerResearch(username, 1, 1, 1);

      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      expect(activateResponse.status).toBe(200);

      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();
      Object.assign(state!, {
        isActive: false,
        fuelRatio: 0.2,
        updatedAtMs: Date.now(),
      });

      const response = await afterburnerPOST(activateRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Afterburner requires at least 33% fuel');
    });
  });

  test('afterburner_deactivate_preservesFuelAndCapsSpeed', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_deactivate');
      await grantAfterburnerResearch(username, 1, 1, 1);

      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      const activateData = await activateResponse.json();
      expect(activateResponse.status).toBe(200);

      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();
      Object.assign(state!, {
        updatedAtMs: Date.now() - activateData.durationMs / 2,
      });

      const deactivateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'deactivate' },
        sessionCookie,
      );
      const deactivateResponse = await afterburnerPOST(deactivateRequest);
      const deactivateData = await deactivateResponse.json();

      expect(deactivateResponse.status).toBe(200);
      expect(deactivateData.action).toBe('deactivated');
      expect(deactivateData.fuelPercent).toBeCloseTo(50, 0);

      const statsRequest = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse = await shipStatsGET(statsRequest);
      const stats = await statsResponse.json();

      expect(stats.afterburner.isActive).toBe(false);
      expect(stats.afterburner.canActivate).toBe(true);
      expect(stats.speed).toBeLessThanOrEqual(stats.maxSpeed + 0.01);
      expect(stats.afterburner.fuelPercent).toBeCloseTo(50, 0);
    });
  });

  test('afterburner_activateAndExpire_speedRestoredOnShipStats', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_expire');
      await grantAfterburnerResearch(username, 1, 1, 1);

      const statsRequest1 = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse1 = await shipStatsGET(statsRequest1);
      const stats1 = await statsResponse1.json();
      const normalMaxSpeed = stats1.maxSpeed;

      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      const activateData = await activateResponse.json();
      expect(activateResponse.status).toBe(200);
      expect(activateData.boostedSpeed).toBeGreaterThan(normalMaxSpeed);

      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();
      Object.assign(state!, { updatedAtMs: Date.now() - activateData.durationMs - 1_000 });

      const statsRequest2 = createRequest(
        'http://localhost:3000/api/ship-stats',
        'GET',
        undefined,
        sessionCookie,
      );
      const statsResponse2 = await shipStatsGET(statsRequest2);
      const stats2 = await statsResponse2.json();

      expect(stats2.speed).toBeLessThanOrEqual(normalMaxSpeed + 0.01);
      expect(stats2.afterburner.isActive).toBe(false);
      expect(stats2.afterburner.canActivate).toBe(false);
      expect(stats2.afterburner.cooldownRemainingMs).toBeGreaterThan(0);
      expect(stats2.afterburner.fuelPercent).toBeLessThan(stats2.afterburner.activationThresholdPercent);
    });
  });

  test('afterburner_shipStatsShowsAfterburnerStatus', async () => {
    await withTransaction(async () => {
      const { sessionCookie } = await createAuthenticatedSessionWithUser('ab_stats');

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
      expect(data.afterburner.canActivate).toBe(false);
      expect(data.afterburner.durationResearchLevel).toBe(0);
      expect(data.afterburner.boostedSpeed).toBe(0);
      expect(data.afterburner.boostRemainingMs).toBe(0);
      expect(data.afterburner.cooldownRemainingMs).toBe(0);
      expect(data.afterburner.fuelPercent).toBe(100);
    });
  });

  test('afterburner_withTimeMultiplier_durationExpiresEarlier', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('ab_timemult');
      await grantAfterburnerResearch(username, 1, 1, 1);

      TimeMultiplierService.getInstance().setMultiplier(2, 60);

      const activateRequest = createRequest(
        'http://localhost:3000/api/afterburner',
        'POST',
        { action: 'activate' },
        sessionCookie,
      );
      const activateResponse = await afterburnerPOST(activateRequest);
      const activateData = await activateResponse.json();
      expect(activateResponse.status).toBe(200);

      const afterburnerService = AfterburnerService.getInstance();
      const userId = afterburnerService.getActiveUserIds()[0]!;
      const state = afterburnerService.getState(userId);
      expect(state).not.toBeNull();

      Object.assign(state!, { updatedAtMs: Date.now() - activateData.durationMs / 2 - 1 });

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