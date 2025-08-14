import { describe, expect, test } from 'vitest';
import { NextRequest } from 'next/server';

// Import API routes
import { POST as triggerResearchPOST } from '@/app/api/trigger-research/route';

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

describe('Trigger Research API', () => {
  test('triggerResearch_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {
      type: 'IronHarvesting'
    });

    const response = await triggerResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('triggerResearch_invalidType_returns400', async () => {
    const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {
      type: 'InvalidResearch'
    });

    const response = await triggerResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid research type');
  });

  test('triggerResearch_missingType_returns400', async () => {
    const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {});

    const response = await triggerResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid research type');
  });
});
