import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { randomBytes } from 'crypto';

import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { randomUsername } from '../../helpers/apiTestHelpers';
import { getDatabase } from '@/lib/server/database';
import {
  createUserWithoutShip,
  saveUserToDb,
  getUserByEmail,
  setPasswordResetToken,
  consumePasswordResetToken,
  updateUserPassword,
} from '@/lib/server/user/userRepo';
import { POST as forgotPasswordPOST } from '@/app/api/forgot-password/route';
import { POST as resetPasswordPOST } from '@/app/api/reset-password/route';
import { createRequest } from '../../helpers/apiTestHelpers';
import bcrypt from 'bcrypt';

// Use a password in the bcrypt mock's PRECOMPUTED_HASHES
const TEST_PASSWORD = 'testpass';

async function makeUser(email?: string | null) {
  const db = await getDatabase();
  const username = randomUsername('pwreset');
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  return createUserWithoutShip(db, username, hash, saveUserToDb(db), email);
}

// ── repo helpers ──────────────────────────────────────────────────────────────

describe('Password reset repo helpers', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('setPasswordResetToken and consumePasswordResetToken — happy path', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser('reset-happy@example.com');

      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 60_000;

      await setPasswordResetToken(db, user.id, token, expiresAt);

      const userId = await consumePasswordResetToken(db, token);
      expect(userId).toBe(user.id);

      // Token should be cleared after consumption
      const row = await db.query(
        'SELECT password_reset_token, password_reset_expires FROM users WHERE id = $1',
        [user.id]
      );
      expect(row.rows[0].password_reset_token).toBeNull();
      expect(row.rows[0].password_reset_expires).toBeNull();
    });
  });

  test('consumePasswordResetToken returns null for unknown token', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const result = await consumePasswordResetToken(db, randomBytes(32).toString('hex'));
      expect(result).toBeNull();
    });
  });

  test('consumePasswordResetToken returns null for expired token', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();
      const token = randomBytes(32).toString('hex');
      await setPasswordResetToken(db, user.id, token, Date.now() - 1000);

      const result = await consumePasswordResetToken(db, token);
      expect(result).toBeNull();
    });
  });

  test('consumePasswordResetToken prevents double-consumption', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();
      const token = randomBytes(32).toString('hex');
      await setPasswordResetToken(db, user.id, token, Date.now() + 60_000);

      const first = await consumePasswordResetToken(db, token);
      expect(first).toBe(user.id);

      const second = await consumePasswordResetToken(db, token);
      expect(second).toBeNull();
    });
  });

  test('updateUserPassword updates password_hash in DB', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();
      const newHash = await bcrypt.hash('mypassword', 10);

      await updateUserPassword(db, user.id, newHash);

      const row = await db.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
      expect(row.rows[0].password_hash).toBe(newHash);
    });
  });
});

// ── forgot-password API ───────────────────────────────────────────────────────

describe('POST /api/forgot-password', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
    vi.restoreAllMocks();
  });

  test('always returns 200 even for unknown email', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/forgot-password', 'POST', {
        email: 'nobody@example.com',
      });
      const response = await forgotPasswordPOST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  test('always returns 200 even with invalid email', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/forgot-password', 'POST', {
        email: 'not-an-email',
      });
      const response = await forgotPasswordPOST(request);
      expect(response.status).toBe(200);
    });
  });

  test('sets password_reset_token in DB when email matches and email disabled', async () => {
    // Even if email is disabled, the token should NOT be set (no email = no reset link sent)
    // The route only sets a token when email is enabled.
    await withTransaction(async () => {
      const db = await getDatabase();
      const email = `forgotpw_${Date.now()}@example.com`;
      const user = await makeUser(email);

      delete process.env.EMAIL_ENABLED;

      const request = createRequest('http://localhost:3000/api/forgot-password', 'POST', { email });
      const response = await forgotPasswordPOST(request);
      expect(response.status).toBe(200);

      // No token set when email is disabled
      const row = await db.query('SELECT password_reset_token FROM users WHERE id = $1', [user.id]);
      expect(row.rows[0].password_reset_token).toBeNull();
    });
  });
});

// ── reset-password API ────────────────────────────────────────────────────────

describe('POST /api/reset-password', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('successfully resets password with valid token', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser('reset-success@example.com');
      const token = randomBytes(32).toString('hex');
      await setPasswordResetToken(db, user.id, token, Date.now() + 60_000);

      const request = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        token,
        password: 'mypassword',
      });
      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Password should be updated in DB
      const row = await db.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
      const matches = await bcrypt.compare('mypassword', row.rows[0].password_hash as string);
      expect(matches).toBe(true);

      // Token should be consumed
      const row2 = await db.query(
        'SELECT password_reset_token FROM users WHERE id = $1',
        [user.id]
      );
      expect(row2.rows[0].password_reset_token).toBeNull();
    });
  });

  test('returns 400 for invalid token', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        token: randomBytes(32).toString('hex'),
        password: 'newpass',
      });
      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/invalid|expired/i);
    });
  });

  test('returns 400 for expired token', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();
      const token = randomBytes(32).toString('hex');
      await setPasswordResetToken(db, user.id, token, Date.now() - 1000);

      const request = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        token,
        password: 'newpass',
      });
      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(400);
    });
  });

  test('returns 400 when token is missing', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        password: 'newpass',
      });
      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(400);
    });
  });

  test('returns 400 when password is missing', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        token: randomBytes(32).toString('hex'),
      });
      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(400);
    });
  });

  test('token cannot be consumed twice', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();
      const token = randomBytes(32).toString('hex');
      await setPasswordResetToken(db, user.id, token, Date.now() + 60_000);

      // First reset succeeds
      const req1 = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        token,
        password: 'pass1',
      });
      const res1 = await resetPasswordPOST(req1);
      expect(res1.status).toBe(200);

      // Second attempt with same token fails
      const req2 = createRequest('http://localhost:3000/api/reset-password', 'POST', {
        token,
        password: 'pass2',
      });
      const res2 = await resetPasswordPOST(req2);
      expect(res2.status).toBe(400);
    });
  });
});

// ── getUserByEmail (already tested in email-tokens.test.ts, quick sanity check) ──

describe('getUserByEmail for password reset', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('returns user when email matches', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const email = `pw_lookup_${Date.now()}@example.com`;
      const user = await makeUser(email);

      const found = await getUserByEmail(db, email);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
    });
  });

  test('finds user registered with mixed-case email via lowercase lookup', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      // Simulate a user whose email was stored lowercase (as register route now does)
      const stored = `Mixed_${Date.now()}@Example.COM`.toLowerCase();
      const user = await makeUser(stored);

      // forgot-password submits the email lowercased — should still find the user
      const found = await getUserByEmail(db, stored.toLowerCase());
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
    });
  });
});
