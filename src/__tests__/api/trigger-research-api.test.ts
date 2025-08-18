import { describe, expect, test } from 'vitest';

// Import API routes
import { POST as triggerResearchPOST } from '@/app/api/trigger-research/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';

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
    const sessionCookie = await createAuthenticatedSession('researchuser');
    
    const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {
      type: 'InvalidResearch'
    }, sessionCookie);

    const response = await triggerResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid research type');
  });

  test('triggerResearch_missingType_returns400', async () => {
    const sessionCookie = await createAuthenticatedSession('researchuser');
    
    const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {}, sessionCookie);

    const response = await triggerResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing or invalid research type');
  });
});
