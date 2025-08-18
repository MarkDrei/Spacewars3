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
  });
});
