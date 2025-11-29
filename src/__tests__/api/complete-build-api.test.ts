import { describe, expect, test } from 'vitest';

// Import API routes
import { POST as completeBuildPOST } from '@/app/api/complete-build/route';

// Import shared test helpers
import { createRequest } from '../helpers/apiTestHelpers';

describe('Complete Build API (Cheat Mode)', () => {
  test('completeBuild_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/complete-build', 'POST', {});

    const response = await completeBuildPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeBuild_invalidSession_returns401', async () => {
    // Create request with invalid session cookie
    const invalidSessionCookie = 'spacewars-session=invalid-session-data; Path=/; HttpOnly; SameSite=lax';
    const request = createRequest(
      'http://localhost:3000/api/complete-build', 
      'POST', 
      {}, 
      invalidSessionCookie
    );

    const response = await completeBuildPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeBuild_emptyBody_stillValidatesAuth', async () => {
    // Test that auth validation happens before body validation
    const request = createRequest('http://localhost:3000/api/complete-build', 'POST');

    const response = await completeBuildPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeBuild_postMethod_required', async () => {
    // Only POST method should be allowed (this tests the API structure)
    const request = createRequest('http://localhost:3000/api/complete-build', 'GET');

    // This should fail since the route only handles POST
    const response = await completeBuildPOST(request);
    
    // Even GET requests should go through auth first
    expect(response.status).toBe(401);
  });
});