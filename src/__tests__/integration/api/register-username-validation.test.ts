import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as registerPOST } from '@/app/api/register/route';
import { createRequest } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';

describe('register – username validation', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  // ── valid lengths ───────────────────────────────────────────────────────

  it('register_singleCharUsername_success', async () => {
    await withTransaction(async () => {
      for (const name of ['a', 'x', 'z']) {
        const req = createRequest('http://localhost:3000/api/register', 'POST', {
          username: name,
          password: 'testpass',
        });
        const res = await registerPOST(req);
        // Each name must be unique within the transaction; 'a' etc. might exist
        // from seed data so we only assert the status is not a validation error
        expect([200, 400]).toContain(res.status);
        if (res.status === 400) {
          const data = await res.json();
          // If it fails, it must be "already taken", not a format error
          expect(data.error).toMatch(/already taken/i);
        }
      }
    });
  });

  it('register_uniqueSingleCharUsername_success', async () => {
    await withTransaction(async () => {
      // Use a unique single-char-length name by appending a random suffix, but
      // actually we want to test length = 1 exactly.  Use a letter unlikely in
      // seed data combined with a numeric suffix.
      const name = 'q'; // not in seed data
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: name,
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  it('register_20charUsername_success', async () => {
    await withTransaction(async () => {
      const name = 'u'.repeat(20);
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: name,
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ── length violations ───────────────────────────────────────────────────

  it('register_emptyUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: '',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      // Could be either "Missing or invalid username" (validateRequired) or
      // the length error from validateUsername — both are acceptable.
      expect(data.error).toBeTruthy();
    });
  });

  it('register_21charUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'a'.repeat(21),
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/20/);
    });
  });

  it('register_veryLongUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'a'.repeat(200),
        password: 'testpass',
      });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── space prohibition ───────────────────────────────────────────────────

  it('register_usernameWithSpace_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'user name',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/space/i);
    });
  });

  // ── special character rejection ─────────────────────────────────────────

  it('register_usernameWithAtSign_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'user@host',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
    });
  });

  it('register_usernameWithExclamation_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'user!',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── HTML/SQL injection rejection ────────────────────────────────────────

  it('register_htmlInjectionUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: '<script>',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
    });
  });

  it('register_sqlInjectionUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: "user'--",
        password: 'testpass',
      });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── reserved NPC patterns ───────────────────────────────────────────────

  it('register_npcPatternUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: '[L1-NPC]',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/reserved/i);
    });
  });

  it('register_levelNpcPatternUsername_rejected', async () => {
    await withTransaction(async () => {
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'Level 5 NPC',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── duplicate username rejection ────────────────────────────────────────

  it('register_duplicatePlayerUsername_rejected', async () => {
    await withTransaction(async () => {
      const username = `duptest_${Date.now()}`;

      // First registration succeeds
      const req1 = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'pass1',
      });
      const res1 = await registerPOST(req1);
      expect(res1.status).toBe(200);

      // Second registration with same username fails
      const req2 = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'pass2',
      });
      const res2 = await registerPOST(req2);
      const data2 = await res2.json();
      expect(res2.status).toBe(400);
      expect(data2.error).toMatch(/already taken/i);
    });
  });

  it('register_usernameMatchingExistingPlayer_rejected', async () => {
    await withTransaction(async () => {
      // 'a' is the seed user — trying to register with that name must fail
      const req = createRequest('http://localhost:3000/api/register', 'POST', {
        username: 'a',
        password: 'testpass',
      });
      const res = await registerPOST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/already taken/i);
    });
  });
});
