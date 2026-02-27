import { describe, expect, test } from 'vitest';
import { GET as userStatsGET } from '@/app/api/user-stats/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('User stats API', () => {
  test('userStats_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
