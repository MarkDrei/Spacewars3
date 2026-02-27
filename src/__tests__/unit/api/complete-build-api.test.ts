import { describe, expect, test } from 'vitest';
import { POST as completeBuildPOST } from '@/app/api/complete-build/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';

// Auth guard and input-validation tests for the complete-build route.
// requireAuth() fires on line 19, before UserCache.getInstance2() on line 25 — no DB needed.

describe('Complete Build API - auth guard (unit)', () => {
  test('completeBuild_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/complete-build', 'POST', {});
    const response = await completeBuildPOST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeBuild_invalidSessionCookie_returns401', async () => {
    const invalidCookie = 'spacewars-session=invalid-session-data; Path=/; HttpOnly; SameSite=lax';
    const request = createRequest('http://localhost:3000/api/complete-build', 'POST', {}, invalidCookie);
    const response = await completeBuildPOST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeBuild_emptyBody_authCheckedBeforeBodyValidation', async () => {
    const request = createRequest('http://localhost:3000/api/complete-build', 'POST');
    const response = await completeBuildPOST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('completeBuild_validMockSession_passesAuthGuard', async () => {
    // Confirms that createMockSessionCookie produces a cookie the route accepts.
    // The request will proceed past auth and fail later (403 or 200), not at 401.
    const sessionCookie = await createMockSessionCookie(1);
    const request = createRequest('http://localhost:3000/api/complete-build', 'POST', {}, sessionCookie);
    const response = await completeBuildPOST(request);
    expect(response.status).not.toBe(401);
  });
});
