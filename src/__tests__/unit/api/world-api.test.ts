import { describe, expect, test } from 'vitest';
import { GET as worldGET } from '@/app/api/world/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('World API', () => {
  test('world_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/world', 'GET');

    const response = await worldGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
