import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as triggerResearchPOST } from '@/app/api/trigger-research/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';

describe('Trigger Research API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('triggerResearch_notAuthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {
        type: 'IronHarvesting'
      });

      const response = await triggerResearchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });

  test('triggerResearch_invalidType_returns400', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('researchuser');
      
      const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {
        type: 'InvalidResearch'
      }, sessionCookie);

      const response = await triggerResearchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid research type');
    });
  });

  test('triggerResearch_missingType_returns400', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('researchuser');
      
      const request = createRequest('http://localhost:3000/api/trigger-research', 'POST', {}, sessionCookie);

      const response = await triggerResearchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid research type');
    });
  });
});
