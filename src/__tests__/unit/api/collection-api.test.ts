import { describe, expect, test } from 'vitest';

// Import API routes
import { POST as collectPOST } from '@/app/api/harvest/route';

// Import shared test helpers
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';

// No DB or server initialisation needed:
// - 401 test sends no session at all
// - 400 tests hit input-validation BEFORE any cache/DB access
//   (harvest route validates objectId on line ~43, before UserCache is touched)

describe('Collection API', () => {
  test('collect_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/harvest', 'POST', {
      objectId: 1
    });

    const response = await collectPOST(request);

    if (!response) {
      throw new Error('No response from collection API');
    }

    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('collect_invalidObjectId_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();

    const request = createRequest('http://localhost:3000/api/harvest', 'POST', {
      objectId: 'invalid'
    }, sessionCookie);

    const response = await collectPOST(request);
    if (!response) {
      throw new Error('No response from collection API');
    }
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid object ID');
  });

  test('collect_missingObjectId_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();

    const request = createRequest('http://localhost:3000/api/harvest', 'POST', {}, sessionCookie);

    const response = await collectPOST(request);
    if (!response) {
      throw new Error('No response from collection API');
    }
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid object ID');
  });
});
