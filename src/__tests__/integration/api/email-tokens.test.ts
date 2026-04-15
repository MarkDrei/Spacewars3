import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';

import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { randomUsername } from '../../helpers/apiTestHelpers';
import { getDatabase } from '@/lib/server/database';
import { createUserWithoutShip, saveUserToDb, setEmailVerificationToken, consumeEmailVerificationToken, getUserByEmail } from '@/lib/server/user/userRepo';
import bcrypt from 'bcrypt';

// Use a password that is in the bcrypt mock's PRECOMPUTED_HASHES
const TEST_PASSWORD = 'testpass';

async function makeUser(email?: string | null) {
  const db = await getDatabase();
  const username = randomUsername('emailtest');
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  return createUserWithoutShip(db, username, hash, saveUserToDb(db), email);
}

describe('Email token helpers', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('setEmailVerificationToken and consumeEmailVerificationToken — happy path', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser('verify@example.com');

      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 60_000; // 1 minute from now

      await setEmailVerificationToken(db, user.id, token, expiresAt);

      const consumedUserId = await consumeEmailVerificationToken(db, token);
      expect(consumedUserId).toBe(user.id);

      // Row should now have email_verified = true and token cleared
      const result = await db.query('SELECT email_verified, email_verification_token FROM users WHERE id = $1', [user.id]);
      expect(result.rows[0].email_verified).toBe(true);
      expect(result.rows[0].email_verification_token).toBeNull();
    });
  });

  test('consumeEmailVerificationToken returns null for unknown token', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const fakeToken = randomBytes(32).toString('hex');
      const result = await consumeEmailVerificationToken(db, fakeToken);
      expect(result).toBeNull();
    });
  });

  test('consumeEmailVerificationToken returns null for expired token', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();

      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() - 1000; // Already expired

      await setEmailVerificationToken(db, user.id, token, expiresAt);

      const result = await consumeEmailVerificationToken(db, token);
      expect(result).toBeNull();
    });
  });

  test('consumeEmailVerificationToken prevents double-consumption', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const user = await makeUser();

      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 60_000;

      await setEmailVerificationToken(db, user.id, token, expiresAt);

      // First consumption succeeds
      const first = await consumeEmailVerificationToken(db, token);
      expect(first).toBe(user.id);

      // Second consumption returns null (token was cleared)
      const second = await consumeEmailVerificationToken(db, token);
      expect(second).toBeNull();
    });
  });

  test('getUserByEmail returns user when email matches', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const email = `lookup_${Date.now()}@example.com`;
      const user = await makeUser(email);

      const found = await getUserByEmail(db, email);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
      expect(found!.username).toBe(user.username);
    });
  });

  test('getUserByEmail returns null when email not found', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const result = await getUserByEmail(db, 'nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  test('email uniqueness constraint prevents duplicate emails', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const email = `unique_${Date.now()}@example.com`;
      await makeUser(email);

      // Second user with same email should fail
      const username2 = randomUsername('dup');
      const hash = await bcrypt.hash(TEST_PASSWORD, 10);
      await expect(
        createUserWithoutShip(db, username2, hash, saveUserToDb(db), email)
      ).rejects.toThrow();
    });
  });
});
