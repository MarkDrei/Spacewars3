import { describe, expect, test, beforeEach } from 'vitest';

// Import API routes
import { POST as teleportPOST } from '@/app/api/teleport/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';

// Import server modules for setting up test scenarios
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';

describe('Teleport API', () => {
  beforeEach(async () => {
    // Initialize cache manager for each test
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
  });

  test('teleport_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
      targetX: 100,
      targetY: 100
    });

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('teleport_missingCoordinates_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('teleportuser');
    
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {}, sessionCookie);

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Must provide targetX and targetY coordinates');
  });

  test('teleport_missingTargetX_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('teleportuser');
    
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
      targetY: 100
    }, sessionCookie);

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Must provide targetX and targetY coordinates');
  });

  test('teleport_invalidCoordinateType_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('teleportuser');
    
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
      targetX: 'invalid',
      targetY: 100
    }, sessionCookie);

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Coordinates must be numbers');
  });

  test('teleport_nullCoordinates_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('teleportuser');
    
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
      targetX: null,
      targetY: 100
    }, sessionCookie);

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    // null is not a number type
    expect(data.error).toBe('Coordinates must be numbers');
  });

  test('teleport_notResearched_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('teleportuser');
    
    // Make teleport request with level 0 (default - teleport not researched)
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
      targetX: 100,
      targetY: 100
    }, sessionCookie);

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Teleportation not researched');
  });
});
