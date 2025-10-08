import { describe, expect, test } from 'vitest';

// Import API routes
import { POST as collectPOST } from '@/app/api/harvest/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';

describe('Collection API', () => {
  test('collect_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/harvest', 'POST', {
      objectId: 1
    });

    const response = await collectPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('collect_invalidObjectId_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('collectuser');
    
    const request = createRequest('http://localhost:3000/api/harvest', 'POST', {
      objectId: 'invalid'
    }, sessionCookie);

    const response = await collectPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid object ID');
  });

  test('collect_missingObjectId_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('collectuser');
    
    const request = createRequest('http://localhost:3000/api/harvest', 'POST', {}, sessionCookie);

    const response = await collectPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid object ID');
  });
});
