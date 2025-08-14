import { describe, expect, test } from 'vitest';
import { NextRequest } from 'next/server';

// Import API routes
import { POST as collectPOST } from '@/app/api/collect/route';

// Helper function to create a Next.js request
function createRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('Collection API', () => {
  test('collect_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/collect', 'POST', {
      objectId: 1
    });

    const response = await collectPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('collect_invalidObjectId_returns400', async () => {
    const request = createRequest('http://localhost:3000/api/collect', 'POST', {
      objectId: 'invalid'
    });

    const response = await collectPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid object ID');
  });

  test('collect_missingObjectId_returns400', async () => {
    const request = createRequest('http://localhost:3000/api/collect', 'POST', {});

    const response = await collectPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid object ID');
  });
});
