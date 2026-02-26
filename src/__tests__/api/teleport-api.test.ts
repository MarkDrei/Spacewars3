import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as teleportPOST } from '@/app/api/teleport/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * Helper to give a user teleport charges for testing.
 * Sets teleport research level and teleport charges in the user cache.
 */
async function giveUserTeleportCharges(
  username: string,
  teleportLevel: number,
  charges: number
): Promise<number> {
  const cache = UserCache.getInstance2();
  const ctx = createLockContext();
  let userId = -1;

  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByUsername(userCtx, username);
    if (user) {
      user.techTree.teleport = teleportLevel;
      user.teleportCharges = charges;
      user.teleportLastRegen = Math.floor(Date.now() / 1000);
      userId = user.id;
      await cache.updateUserInCache(userCtx, user);
    }
  });

  return userId;
}

/**
 * Helper to get user teleport charges from cache
 */
async function getUserTeleportCharges(username: string): Promise<number> {
  const cache = UserCache.getInstance2();
  const ctx = createLockContext();
  let charges = -1;

  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByUsername(userCtx, username);
    if (user) {
      charges = user.teleportCharges;
    }
  });

  return charges;
}

describe('Teleport API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('teleport_notAuthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 1000,
        y: 1000,
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
      const sessionCookie = await createAuthenticatedSession('teleportnocharges');

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 1000,
        y: 1000,
        preserveVelocity: false,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No teleport charges available');
    });
  });

  test('teleport_missingCoordinates_returns400', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('teleportnoxy');

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {}, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Must provide x and y coordinates');
    });
  });

  test('teleport_validCharges_movesShipAndDecrementsCharge', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionAndGetUsername('teleportwithcharge');

      // Give user 1 teleport charge
      await giveUserTeleportCharges(username, 1, 1.0);

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 1500,
        y: 2000,
        preserveVelocity: false,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ship.x).toBe(1500);
      expect(data.ship.y).toBe(2000);
      expect(data.remainingCharges).toBe(0);
    });
  });

  test('teleport_fractionalCharges_onlyUsesWholeCharge', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionAndGetUsername('teleportfrac');

      // Give user 1.5 charges - should allow teleport, leaving 0.5
      await giveUserTeleportCharges(username, 2, 1.5);

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 2500,
        y: 2500,
        preserveVelocity: false,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.remainingCharges).toBe(0); // Math.floor(0.5) = 0

      // Actual charges should be 0.5 (fractional preserved)
      const actualCharges = await getUserTeleportCharges(username);
      expect(actualCharges).toBeCloseTo(0.5);
    });
  });

  test('teleport_zeroVelocity_setsSpeedToZero', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionAndGetUsername('teleportzero');

      await giveUserTeleportCharges(username, 1, 1.0);

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 1000,
        y: 1000,
        preserveVelocity: false,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ship.speed).toBe(0);
    });
  });

  test('teleport_preserveVelocity_keepsSpeed', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionAndGetUsername('teleportpreserve');

      await giveUserTeleportCharges(username, 1, 2.0);

      // First set a speed using navigate API
      const { POST: navigatePOST } = await import('@/app/api/navigate/route');
      const navRequest = createRequest('http://localhost:3000/api/navigate', 'POST', {
        speed: 10,
        angle: 45,
      }, sessionCookie);
      await navigatePOST(navRequest);

      // Now teleport with preserveVelocity
      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 3000,
        y: 3000,
        preserveVelocity: true,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ship.speed).toBe(10); // Speed preserved
      expect(data.ship.x).toBe(3000);
      expect(data.ship.y).toBe(3000);
    });
  });

  test('teleport_invalidCoordinates_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionAndGetUsername('teleportinvalid');

      await giveUserTeleportCharges(username, 1, 1.0);

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: -100, // Negative coordinate
        y: 1000,
        preserveVelocity: false,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Coordinates must be within world bounds');
    });
  });

  test('teleport_inBattle_returns400', async () => {
    await withTransaction(async () => {
      const { sessionCookie, username } = await createAuthenticatedSessionAndGetUsername('teleportbattle');

      // Give user teleport charges
      const cache = UserCache.getInstance2();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await cache.getUserByUsername(userCtx, username);
        if (user) {
          user.techTree.teleport = 1;
          user.teleportCharges = 1.0;
          user.inBattle = true; // Put user in battle
          await cache.updateUserInCache(userCtx, user);
        }
      });

      const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
        x: 1000,
        y: 1000,
        preserveVelocity: false,
      }, sessionCookie);

      const response = await teleportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot teleport while in battle');
    });
  });
});

/**
 * Helper to create authenticated session and return both cookie and username
 */
async function createAuthenticatedSessionAndGetUsername(prefix: string): Promise<{ sessionCookie: string; username: string }> {
  const { createAuthenticatedSessionWithUser } = await import('../helpers/apiTestHelpers');
  return await createAuthenticatedSessionWithUser(prefix);
}
