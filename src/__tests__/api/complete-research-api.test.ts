import { describe, expect, test } from 'vitest';

// Import API routes
import { POST as completeResearchPOST } from '@/app/api/complete-research/route';
import { POST as triggerResearchPOST } from '@/app/api/trigger-research/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { POST as registerPOST } from '@/app/api/register/route';

// Import shared test helpers
import { createRequest, randomUsername, extractSessionCookie } from '../helpers/apiTestHelpers';
import { ResearchType } from '@/lib/server/techtree';

describe('Complete Research API (Cheat Mode)', () => {
  test('completeResearch_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/complete-research', 'POST', {});

    const response = await completeResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeResearch_invalidSession_returns401', async () => {
    // Create request with invalid session cookie
    const invalidSessionCookie = 'spacewars-session=invalid-session-data; Path=/; HttpOnly; SameSite=lax';
    const request = createRequest(
      'http://localhost:3000/api/complete-research', 
      'POST', 
      {}, 
      invalidSessionCookie
    );

    const response = await completeResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeResearch_emptyBody_stillValidatesAuth', async () => {
    // Test that auth validation happens before body validation
    const request = createRequest('http://localhost:3000/api/complete-research', 'POST');

    const response = await completeResearchPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeResearch_postMethod_required', async () => {
    // Only POST method should be allowed (this tests the API structure)
    const request = createRequest('http://localhost:3000/api/complete-research', 'GET');

    // This should fail since the route only handles POST
    const response = await completeResearchPOST(request);
    
    // Even GET requests should go through auth first
    expect(response.status).toBe(401);
  });

  test('completeResearch_nonCheatUser_returns403', async () => {
    // Create a regular user (not 'a' or 'q')
    const username = randomUsername('regularuser');
    const password = 'testpass123';
    
    // Register user
    const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
      username,
      password
    });
    const registerResponse = await registerPOST(registerRequest);
    expect(registerResponse.status).toBe(200);
    
    // Login user
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username,
      password
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);
    
    // Extract session cookie
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Try to complete research - should be denied
    const completeRequest = createRequest(
      'http://localhost:3000/api/complete-research', 
      'POST', 
      {},
      sessionCookie!
    );

    const response = await completeResearchPOST(completeRequest);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Cheat mode only available for developers');
  });

  test('completeResearch_noActiveResearch_returnsMessage', async () => {
    // Login as test user 'a' (cheat mode enabled)
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username: 'a',
      password: 'a'
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);
    
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Try to complete research when none is active
    const completeRequest = createRequest(
      'http://localhost:3000/api/complete-research', 
      'POST', 
      {},
      sessionCookie!
    );

    const response = await completeResearchPOST(completeRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.message).toBe('No active research to complete');
  });

  test('completeResearch_withActiveResearch_completesSuccessfully', async () => {
    // Login as test user 'a' (cheat mode enabled)
    const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
      username: 'a',
      password: 'a'
    });
    const loginResponse = await loginPOST(loginRequest);
    expect(loginResponse.status).toBe(200);
    
    const sessionCookie = extractSessionCookie(loginResponse);
    expect(sessionCookie).toBeTruthy();

    // Trigger a research
    const triggerRequest = createRequest(
      'http://localhost:3000/api/trigger-research',
      'POST',
      { type: ResearchType.ShipSpeed },
      sessionCookie!
    );
    const triggerResponse = await triggerResearchPOST(triggerRequest);
    const triggerData = await triggerResponse.json();
    
    expect(triggerResponse.status).toBe(200);

    // Complete the research via cheat
    const completeRequest = createRequest(
      'http://localhost:3000/api/complete-research', 
      'POST', 
      {},
      sessionCookie!
    );

    const response = await completeResearchPOST(completeRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Completed research');
    expect(data.completedResearch).toBeDefined();
    expect(data.completedResearch.type).toBe(ResearchType.ShipSpeed);
  });
});
