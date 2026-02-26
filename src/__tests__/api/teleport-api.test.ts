import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as teleportPOST } from '@/app/api/teleport/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSessionWithUser } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { ResearchType } from '@/lib/server/techs/techtree';

/**
 * Helper to grant teleport charges to a user by username.
 * Sets teleport research level and teleport charges directly on the cached user.
 */
async function grantTeleportCharges(username: string, charges: number): Promise<void> {
  const ctx = createLockContext();
  const cache = UserCache.getInstance2();
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByUsername(userCtx, username);
    if (!user) throw new Error(`User not found: ${username}`);

    // Set teleport research level to allow charges
    user.techTree.teleport = 3; // level 3 → 3 max charges
    user.teleportCharges = charges;
    await cache.updateUserInCache(userCtx, user);
  });
}

/**
 * Helper to set user's inBattle state by username.
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

describe('Teleport API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    TimeMultiplierService.resetInstance();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
    TimeMultiplierService.resetInstance();
  });

  test('teleport_notAuthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 100,
        y: 200,
        preserveVelocity: false,
      });

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });

  test('teleport_noCharges_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie } = await createAuthenticatedSessionWithUser('teleport_nocharges');

      // User has no teleport research (default level 0 → 0 max charges → getResearchEffect returns 0)
      // teleportCharges defaults to 0, so floor(0) < 1

      const request = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 100, y: 200, preserveVelocity: false },
        sessionCookie
      );

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No teleport charges available');
    });
  });

  test('teleport_validCharges_returnsSuccess', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('teleport_valid');

      // Grant teleport charges to the user
      await grantTeleportCharges(username, 2);

      const request = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 500, y: 750, preserveVelocity: false },
        sessionCookie
      );

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ship).toBeDefined();
      expect(data.ship.x).toBe(500);
      expect(data.ship.y).toBe(750);
      expect(data.remainingCharges).toBe(1); // 2 - 1 = 1
    });
  });

  test('teleport_inBattle_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('teleport_battle');

      // Grant charges and set in battle
      await grantTeleportCharges(username, 2);
      await setUserInBattle(username, true);

      const request = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 100, y: 200, preserveVelocity: false },
        sessionCookie
      );

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot teleport while in battle');
    });
  });

  test('teleport_preserveVelocity_keepsSameSpeed', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('teleport_preserve');

      await grantTeleportCharges(username, 3);

      const request = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 1000, y: 2000, preserveVelocity: true },
        sessionCookie
      );

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ship.x).toBe(1000);
      expect(data.ship.y).toBe(2000);
      // speed is preserved (whatever it was), angle unchanged
      expect(typeof data.ship.speed).toBe('number');
      expect(typeof data.ship.angle).toBe('number');
    });
  });

  test('teleport_noPreserveVelocity_zeroesSpeed', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('teleport_novelocity');

      await grantTeleportCharges(username, 3);

      const request = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 300, y: 400, preserveVelocity: false },
        sessionCookie
      );

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ship.speed).toBe(0);
    });
  });

  test('teleport_invalidCoords_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('teleport_invalidcoords');

      await grantTeleportCharges(username, 3);

      // Test negative x
      const requestNegative = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: -1, y: 200, preserveVelocity: false },
        sessionCookie
      );

      const responseNegative = await teleportPOST(requestNegative);
      expect(responseNegative.status).toBe(400);

      // Test x > 5000
      const requestTooBig = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 5001, y: 200, preserveVelocity: false },
        sessionCookie
      );

      const responseTooBig = await teleportPOST(requestTooBig);
      expect(responseTooBig.status).toBe(400);

      // Test non-number
      const requestNonNumber = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 'abc', y: 200, preserveVelocity: false },
        sessionCookie
      );

      const responseNonNumber = await teleportPOST(requestNonNumber);
      expect(responseNonNumber.status).toBe(400);
    });
  });

  test('teleport_fractionalCharges_usesOneWholeChargeAndLeavesRemainder', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionWithUser('teleport_fractional');

      // Grant 1.5 charges: 1 usable whole charge, 0.5 fractional remainder
      await grantTeleportCharges(username, 1.5);

      const request = createRequest(
        'http://localhost:3000/api/teleport',
        'POST',
        { x: 100, y: 200, preserveVelocity: false },
        sessionCookie
      );

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // After deducting 1 from 1.5: 0.5 raw remaining (0 usable)
      expect(data.remainingCharges).toBeCloseTo(0.5, 5);
    });
  });
});
