import { describe, expect, test, beforeEach } from 'vitest';
import { POST } from '@/app/api/afterburner/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { createRequest, extractSessionCookie } from '../helpers/apiTestHelpers';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { resetTestDatabase } from '@/lib/server/database';
import { createEmptyContext } from '@/lib/server/typedLocks';

describe('Afterburner API', () => {
  beforeEach(async () => {
    // Reset test database to clean state
    resetTestDatabase();
    
    // Reset cache manager
    const cacheManager = getTypedCacheManager();
    await cacheManager.shutdown();
  });

  test('triggerAfterburner_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/afterburner', 'POST', {});
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  test('triggerAfterburner_afterburnerNotResearched_returns400', async () => {
    // Create a test user with default tech tree (afterburner level 0)
    const username = `afterburner_user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password: 'testpass'
    });
    await registerPOST(registerRequest);

    // Login to get session
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username,
      password: 'testpass'
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);

    // Extract session cookie
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Try to trigger afterburner with session
    const afterburnerRequest = createRequest('http://localhost:3000/api/afterburner', 'POST', {}, sessionCookie!);
    const response = await POST(afterburnerRequest);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Afterburner not researched');
  });

  test('triggerAfterburner_validRequest_activatesAfterburner', async () => {
    // Initialize cache manager
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Use default user 'a' which has afterburner researched (need to check test setup)
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username: 'a',
      password: 'a'
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);

    // Extract session cookie
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Manually set afterburner level for test user
    const emptyCtx = createEmptyContext();
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      const user = cacheManager.getUserUnsafe(1, userCtx);
      if (user) {
        user.techTree.afterburner = 1; // Enable afterburner
        cacheManager.setUserUnsafe(user, userCtx);
      }
    });

    // Try to trigger afterburner with session
    const afterburnerRequest = createRequest('http://localhost:3000/api/afterburner', 'POST', {}, sessionCookie!);
    const response = await POST(afterburnerRequest);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.afterburner).toBeDefined();
    expect(data.afterburner.boostedSpeed).toBeGreaterThan(data.afterburner.baseSpeed);
    expect(data.afterburner.duration).toBeGreaterThan(0);
    expect(data.ship).toBeDefined();
    expect(data.ship.speed).toBe(data.afterburner.boostedSpeed);
  });

  test('triggerAfterburner_alreadyActive_returns400', async () => {
    // Initialize cache manager
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Use default user 'a'
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username: 'a',
      password: 'a'
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);

    // Extract session cookie
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Enable afterburner for test user
    const emptyCtx = createEmptyContext();
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      const user = cacheManager.getUserUnsafe(1, userCtx);
      if (user) {
        user.techTree.afterburner = 1;
        cacheManager.setUserUnsafe(user, userCtx);
      }
    });

    // Trigger afterburner first time with session
    const firstRequest = createRequest('http://localhost:3000/api/afterburner', 'POST', {}, sessionCookie!);
    const firstResponse = await POST(firstRequest);
    expect(firstResponse.status).toBe(200);

    // Try to trigger again immediately with session
    const secondRequest = createRequest('http://localhost:3000/api/afterburner', 'POST', {}, sessionCookie!);
    const secondResponse = await POST(secondRequest);
    
    expect(secondResponse.status).toBe(400);
    const data = await secondResponse.json();
    expect(data.error).toContain('on cooldown');
  });

  test('triggerAfterburner_afterCooldownExpires_canActivateAgain', async () => {
    // Initialize cache manager
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Use default user 'a'
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username: 'a',
      password: 'a'
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);

    // Extract session cookie
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Enable afterburner for test user
    const emptyCtx = createEmptyContext();
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      const user = cacheManager.getUserUnsafe(1, userCtx);
      if (user) {
        user.techTree.afterburner = 1;
        cacheManager.setUserUnsafe(user, userCtx);
      }
    });

    // Trigger afterburner with session
    const firstRequest = createRequest('http://localhost:3000/api/afterburner', 'POST', {}, sessionCookie!);
    const firstResponse = await POST(firstRequest);
    expect(firstResponse.status).toBe(200);

    // Manually expire the cooldown
    await cacheManager.withWorldWrite(emptyCtx, async (worldCtx) => {
      const world = cacheManager.getWorldUnsafe(worldCtx);
      const playerShips = world.getSpaceObjectsByType('player_ship');
      const playerShip = playerShips.find(ship => ship.id === 1);
      if (playerShip) {
        // Set cooldown to a past time
        playerShip.afterburner_cooldown_end_ms = Date.now() - 1000;
      }
      cacheManager.updateWorldUnsafe(world, worldCtx);
    });

    // Try to trigger again after cooldown expires with session
    const secondRequest = createRequest('http://localhost:3000/api/afterburner', 'POST', {}, sessionCookie!);
    const secondResponse = await POST(secondRequest);
    
    expect(secondResponse.status).toBe(200);
    const data = await secondResponse.json();
    expect(data.success).toBe(true);
  });
});
