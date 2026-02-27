import { describe, expect, test } from 'vitest';
import { POST as teleportPOST } from '@/app/api/teleport/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('Teleport API', () => {
  test('teleport_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/teleport', 'POST', {
      x: 100,
      y: 200,
      preserveVelocity: false,
    });

    const response = await teleportPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
