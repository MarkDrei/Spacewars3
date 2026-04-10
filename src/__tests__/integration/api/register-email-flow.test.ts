import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';

import { POST as registerPOST } from '@/app/api/register/route';
import { GET as verifyEmailGET } from '@/app/api/verify-email/route';
import { createRequest, randomUsername } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';

describe('Register with email flow', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
    vi.restoreAllMocks();
  });

  test('register without email succeeds (backward compat)', async () => {
    await withTransaction(async () => {
      const username = randomUsername('noemail');
      const request = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass',
      });
      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.emailSent).toBe(false);
    });
  });

  test('register with valid email stores email in DB', async () => {
    await withTransaction(async () => {
      const username = randomUsername('withemail');
      const email = `${username}@example.com`;
      const request = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass',
        email,
      });
      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify email stored in DB
      const db = await getDatabase();
      const result = await db.query('SELECT email, email_verified FROM users WHERE username = $1', [username]);
      expect(result.rows[0].email).toBe(email);
      expect(result.rows[0].email_verified).toBe(false);
    });
  });

  test('register with invalid email format returns 400', async () => {
    await withTransaction(async () => {
      const username = randomUsername('bademail');
      const request = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass',
        email: 'not-an-email',
      });
      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid email');
    });
  });

  test('register with duplicate email returns 400', async () => {
    await withTransaction(async () => {
      const email = `dup_${Date.now()}@example.com`;

      // First registration
      const request1 = createRequest('http://localhost:3000/api/register', 'POST', {
        username: randomUsername('first'),
        password: 'testpass',
        email,
      });
      const res1 = await registerPOST(request1);
      expect(res1.status).toBe(200);

      // Second registration with same email
      const request2 = createRequest('http://localhost:3000/api/register', 'POST', {
        username: randomUsername('second'),
        password: 'testpass',
        email,
      });
      const res2 = await registerPOST(request2);
      const data2 = await res2.json();

      expect(res2.status).toBe(400);
      expect(data2.error).toContain('Email already in use');
    });
  });

  test('verify-email with valid token marks user as verified', async () => {
    await withTransaction(async () => {
      const username = randomUsername('verifyflow');
      const email = `${username}@example.com`;
      const db = await getDatabase();

      // Register with email but without sending real email
      const request = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass',
        email,
      });
      await registerPOST(request);

      // Manually set a verification token
      const token = 'test-verification-token-abc123';
      const expiresAt = Date.now() + 60_000;
      await db.query(
        'UPDATE users SET email_verification_token = $1, email_verification_expires = $2, email_verified = FALSE WHERE username = $3',
        [token, expiresAt, username]
      );

      // Call verify-email endpoint
      const verifyRequest = new Request(`http://localhost:3000/api/verify-email?token=${token}`);
      const response = await verifyEmailGET(verifyRequest as Parameters<typeof verifyEmailGET>[0]);

      // Should redirect to login?verified=true
      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('verified=true');

      // User should now be verified in DB
      const result = await db.query('SELECT email_verified, email_verification_token FROM users WHERE username = $1', [username]);
      expect(result.rows[0].email_verified).toBe(true);
      expect(result.rows[0].email_verification_token).toBeNull();
    });
  });

  test('verify-email with invalid token redirects with error', async () => {
    await withTransaction(async () => {
      const verifyRequest = new Request('http://localhost:3000/api/verify-email?token=invalid-token-xyz');
      const response = await verifyEmailGET(verifyRequest as Parameters<typeof verifyEmailGET>[0]);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('invalid-token');
    });
  });

  test('verify-email with missing token redirects with error', async () => {
    await withTransaction(async () => {
      const verifyRequest = new Request('http://localhost:3000/api/verify-email');
      const response = await verifyEmailGET(verifyRequest as Parameters<typeof verifyEmailGET>[0]);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('invalid-token');
    });
  });

  test('register with email but email disabled does not send email', async () => {
    await withTransaction(async () => {
      delete process.env.EMAIL_ENABLED;
      const username = randomUsername('disabledemail');
      const email = `${username}@example.com`;
      const request = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass',
        email,
      });
      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.emailSent).toBe(false);
    });
  });
});
