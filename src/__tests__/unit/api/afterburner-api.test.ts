import { describe, expect, test } from 'vitest';
import { POST as afterburnerPOST } from '@/app/api/afterburner/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('Afterburner API', () => {
  test('afterburner_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/afterburner', 'POST');

    const response = await afterburnerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
