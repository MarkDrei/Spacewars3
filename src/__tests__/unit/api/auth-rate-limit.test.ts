import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginPOST } from '@/app/api/login/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as forgotPasswordPOST } from '@/app/api/forgot-password/route';
import { POST as resetPasswordPOST } from '@/app/api/reset-password/route';
import { POST as changePasswordPOST } from '@/app/api/change-password/route';
import { getAuthRateLimits, type RateLimiter } from '@/lib/server/rateLimit';
import { createMockSessionCookie } from '../../helpers/apiTestHelpers';

// All limits are checked before the first cache or database access, so these run without a server.

const CLIENT_IP = '203.0.113.7';

function postFrom(ip: string, path: string, body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Forwarded-For': ip };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function exhaust(limiter: RateLimiter, key: string): void {
  while (limiter.retryAfterSeconds(key) === 0) {
    limiter.hit(key);
  }
}

async function expectRateLimited(response: Response): Promise<void> {
  const data = await response.json();
  expect(response.status).toBe(429);
  expect(data.code).toBe('RATE_LIMITED');
  expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
}

describe('Rate limits of the authentication endpoints', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('login_addressUsedUpItsAttempts_returns429', async () => {
    exhaust(getAuthRateLimits().loginByIp, CLIENT_IP);

    const response = await loginPOST(postFrom(CLIENT_IP, '/api/login', { username: 'a', password: 'a' }));

    await expectRateLimited(response);
  });

  test('login_twentyAttemptsFromOneAddress_theNextOneReturns429', async () => {
    // Invalid bodies are rejected with 400 before any cache access, but count as attempts
    for (let i = 0; i < 20; i++) {
      const response = await loginPOST(postFrom(CLIENT_IP, '/api/login', {}));
      expect(response.status).toBe(400);
    }

    const response = await loginPOST(postFrom(CLIENT_IP, '/api/login', {}));

    await expectRateLimited(response);
  });

  test('login_otherAddressUsedUpItsAttempts_isNotLimited', async () => {
    exhaust(getAuthRateLimits().loginByIp, '198.51.100.9');

    const response = await loginPOST(postFrom(CLIENT_IP, '/api/login', {}));

    expect(response.status).toBe(400);
  });

  test('login_usernameHasTooManyFailedLogins_returns429ForAnyAddress', async () => {
    exhaust(getAuthRateLimits().loginFailuresByUsername, 'victim');

    const response = await loginPOST(postFrom(CLIENT_IP, '/api/login', { username: 'Victim', password: 'x' }));

    await expectRateLimited(response);
  });

  test('register_addressUsedUpItsRegistrations_returns429', async () => {
    exhaust(getAuthRateLimits().registerByIp, CLIENT_IP);

    const response = await registerPOST(postFrom(CLIENT_IP, '/api/register', { username: 'newpilot', password: 'pw' }));

    await expectRateLimited(response);
  });

  test('register_invalidUsername_isRejectedWithoutCounting', async () => {
    const response = await registerPOST(postFrom(CLIENT_IP, '/api/register', { username: '', password: 'pw' }));

    expect(response.status).toBe(400);
    expect(getAuthRateLimits().registerByIp.retryAfterSeconds(CLIENT_IP)).toBe(0);
  });

  test('forgotPassword_addressUsedUpItsRequests_returns429', async () => {
    exhaust(getAuthRateLimits().passwordResetByIp, CLIENT_IP);

    const response = await forgotPasswordPOST(postFrom(CLIENT_IP, '/api/forgot-password', { email: 'a@example.com' }));

    await expectRateLimited(response);
  });

  test('resetPassword_addressUsedUpItsRequests_returns429', async () => {
    exhaust(getAuthRateLimits().passwordResetByIp, CLIENT_IP);

    const response = await resetPasswordPOST(postFrom(CLIENT_IP, '/api/reset-password', { token: 't', password: 'pw' }));

    await expectRateLimited(response);
  });

  test('changePassword_userHasTooManyWrongCurrentPasswords_returns429', async () => {
    exhaust(getAuthRateLimits().changePasswordFailuresByUser, '1');
    const cookie = await createMockSessionCookie(1);

    const response = await changePasswordPOST(
      postFrom(CLIENT_IP, '/api/change-password', { currentPassword: 'x', newPassword: 'y', confirmPassword: 'y' }, cookie)
    );

    await expectRateLimited(response);
  });
});
