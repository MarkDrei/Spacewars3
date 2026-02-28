import { describe, expect, test } from 'vitest';
import { GET as userBattlesGET } from '@/app/api/user-battles/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('User battles API', () => {
  test('userBattles_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/user-battles', 'GET');
    const response = await userBattlesGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
