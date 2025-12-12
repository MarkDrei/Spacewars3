import { describe, expect, test } from 'vitest';
import { NextRequest } from 'next/server';

// Import API routes
import { GET as worldGET } from '@/app/api/world/route';

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

describe('World API', () => {
  test('world_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/world', 'GET');

    const response = await worldGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
