import { describe, expect, test } from 'vitest';
import { GET as techtreeGET } from '@/app/api/techtree/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('Techtree API', () => {
  test('techtree_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/techtree', 'GET');

    const response = await techtreeGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
