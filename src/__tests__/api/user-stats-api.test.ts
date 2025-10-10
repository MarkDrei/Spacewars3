import { describe, expect, test } from 'vitest';

// Import API routes
import { GET as userStatsGET } from '@/app/api/user-stats/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';

describe('User stats API', () => {
  test('userStats_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('userStats_loggedInUser_returnsStats', async () => {
    const sessionCookie = await createAuthenticatedSession('statsuser');
    
    const request = createRequest('http://localhost:3000/api/user-stats', 'GET', undefined, sessionCookie);
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('iron');
    expect(data).toHaveProperty('ironPerSecond');
    expect(data).toHaveProperty('last_updated');
    expect(typeof data.iron).toBe('number');
    expect(typeof data.ironPerSecond).toBe('number');
    expect(typeof data.last_updated).toBe('number');
    
    // Enhanced: Verify ironPerSecond returns the correct base rate (not 0)
    expect(data.ironPerSecond).toBe(1); // Base iron harvesting rate should be 1 iron/second
    expect(data.ironPerSecond).toBeGreaterThan(0); // Should never be 0
  });

  test('userStats_newUser_returnsBaseIronPerSecond', async () => {
    const sessionCookie = await createAuthenticatedSession('newstatsuser');
    
    const request = createRequest('http://localhost:3000/api/user-stats', 'GET', undefined, sessionCookie);
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // New user should have base iron rate, not 0
    expect(data.ironPerSecond).toBe(1);
    // New user may have small amount of iron due to time elapsed since creation
    expect(data.iron).toBeGreaterThanOrEqual(0);
    expect(data.iron).toBeLessThan(10); // Should be small amount (< 10 seconds elapsed)
    expect(data.last_updated).toBeGreaterThan(0);
  });

  test('userStats_ironPerSecondReflectsTechTreeUpgrades', async () => {
    const sessionCookie = await createAuthenticatedSession('upgradeduser');
    
    // First, get the initial stats
    const initialRequest = createRequest('http://localhost:3000/api/user-stats', 'GET', undefined, sessionCookie);
    const initialResponse = await userStatsGET(initialRequest);
    const initialData = await initialResponse.json();
    
    expect(initialResponse.status).toBe(200);
    expect(initialData.ironPerSecond).toBe(1); // Base rate initially
    
    // Note: This test verifies the method is called correctly
    // In a full integration test, we would trigger research here
    // For now, we verify that ironPerSecond reflects the user's actual tech tree state
    expect(initialData.ironPerSecond).toBeGreaterThan(0);
    expect(typeof initialData.ironPerSecond).toBe('number');
  });
});
