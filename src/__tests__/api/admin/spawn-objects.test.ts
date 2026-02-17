import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/admin/spawn-objects/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { createRequest, createAuthenticatedSession, createUser, extractSessionCookie } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';

describe('Admin Spawn Objects API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  describe('Authorization', () => {
    it('spawnObjects_unauthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 1
        });
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Not authenticated');
      });
    });

    it('spawnObjects_unauthorizedUser_returns403', async () => {
      await withTransaction(async () => {
        // Create a regular (non-admin) user
        await createUser('regularuser');
        const sessionCookie = await createAuthenticatedSession('regularuser');

        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 1
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toBe('Admin access restricted to developers');
      });
    });

    it('spawnObjects_adminUserA_succeeds', async () => {
      await withTransaction(async () => {
        // Login as admin user 'a'
        const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
          username: 'a',
          password: 'a'
        });
        const loginResponse = await loginPOST(loginRequest);
        const sessionCookie = extractSessionCookie(loginResponse);

        if (!sessionCookie) {
          throw new Error('Failed to get session cookie');
        }

        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 1
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.spawned).toBe(1);
        expect(data.ids).toHaveLength(1);
      });
    });

    it('spawnObjects_adminUserQ_succeeds', async () => {
      await withTransaction(async () => {
        // Register and login as admin user 'q'
        const password = 'testpass123';
        
        const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
          username: 'q',
          password
        });
        await registerPOST(registerRequest);
        
        const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
          username: 'q',
          password
        });
        const loginResponse = await loginPOST(loginRequest);
        const sessionCookie = extractSessionCookie(loginResponse);

        if (!sessionCookie) {
          throw new Error('Failed to get session cookie');
        }

        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'shipwreck',
          quantity: 1
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.spawned).toBe(1);
        expect(data.ids).toHaveLength(1);
      });
    });
  });

  describe('Validation', () => {
    let sessionCookie: string;

    beforeEach(async () => {
      await withTransaction(async () => {
        // Setup: Login as admin user 'a' for all validation tests
        const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
          username: 'a',
          password: 'a'
        });
        const loginResponse = await loginPOST(loginRequest);
        const cookie = extractSessionCookie(loginResponse);
        if (!cookie) {
          throw new Error('Failed to get session cookie');
        }
        sessionCookie = cookie;
      });
    });

    it('spawnObjects_invalidType_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'planet', // Invalid type
          quantity: 1
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain("type must be one of 'asteroid', 'shipwreck', or 'escape_pod'");
      });
    });

    it('spawnObjects_negativeQuantity_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: -5 // Negative quantity
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('quantity must be at least 1');
      });
    });

    it('spawnObjects_zeroQuantity_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 0 // Zero quantity
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('quantity must be at least 1');
      });
    });

    it('spawnObjects_excessiveQuantity_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 51 // Above max limit
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('quantity cannot exceed 50');
      });
    });

    it('spawnObjects_missingType_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          // Missing type field
          quantity: 1
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('type must be a string');
      });
    });

    it('spawnObjects_missingQuantity_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid'
          // Missing quantity field
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('quantity must be a number');
      });
    });

    it('spawnObjects_nonIntegerQuantity_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 3.5 // Non-integer
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('quantity must be an integer');
      });
    });

    it('spawnObjects_invalidBodyType_returns400', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', 
          'invalid string body', // Not an object
          sessionCookie
        );
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('body must be an object');
      });
    });
  });

  describe('Success Cases', () => {
    let sessionCookie: string;

    beforeEach(async () => {
      await withTransaction(async () => {
        // Setup: Login as admin user 'a' for all success tests
        const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
          username: 'a',
          password: 'a'
        });
        const loginResponse = await loginPOST(loginRequest);
        const cookie = extractSessionCookie(loginResponse);
        if (!cookie) {
          throw new Error('Failed to get session cookie');
        }
        sessionCookie = cookie;
      });
    });

    it('spawnObjects_singleAsteroid_createsOne', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 1
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.spawned).toBe(1);
        expect(data.ids).toHaveLength(1);
        expect(typeof data.ids[0]).toBe('number');

        // Verify object exists in database
        const db = await getDatabase();
        const result = await db.query<{ type: string; speed: number; picture_id: number }>(
          'SELECT * FROM space_objects WHERE id = $1',
          [data.ids[0]]
        );
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].type).toBe('asteroid');
        expect(result.rows[0].speed).toBeGreaterThan(0);
        expect(result.rows[0].picture_id).toBe(1);
      });
    });

    it('spawnObjects_multipleShipwrecks_createsMultiple', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'shipwreck',
          quantity: 10
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.spawned).toBe(10);
        expect(data.ids).toHaveLength(10);

        // Verify all IDs are unique
        const uniqueIds = new Set(data.ids);
        expect(uniqueIds.size).toBe(10);

        // Verify all objects exist in database with correct type
        const db = await getDatabase();
        const result = await db.query<{ type: string; speed: number; picture_id: number }>(
          'SELECT * FROM space_objects WHERE id = ANY($1::int[])',
          [data.ids]
        );
        expect(result.rows).toHaveLength(10);
        
        // All should be shipwrecks
        result.rows.forEach((row) => {
          expect(row.type).toBe('shipwreck');
          expect(row.speed).toBeGreaterThan(0);
          expect(row.picture_id).toBe(1);
        });
      });
    });

    it('spawnObjects_escapePods_returnsCorrectIds', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'escape_pod',
          quantity: 5
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.spawned).toBe(5);
        expect(data.ids).toHaveLength(5);

        // Verify all objects are escape pods
        const db = await getDatabase();
        const result = await db.query<{ type: string; speed: number }>(
          'SELECT * FROM space_objects WHERE id = ANY($1::int[])',
          [data.ids]
        );
        expect(result.rows).toHaveLength(5);
        
        result.rows.forEach((row) => {
          expect(row.type).toBe('escape_pod');
          // Escape pods should have higher base speed (25 ± 25%)
          expect(row.speed).toBeGreaterThanOrEqual(18.75); // 25 * 0.75
          expect(row.speed).toBeLessThanOrEqual(31.25); // 25 * 1.25
        });
      });
    });

    it('spawnObjects_allTypes_respectsTypeConstraint', async () => {
      await withTransaction(async () => {
        // Test each type
        const types = ['asteroid', 'shipwreck', 'escape_pod'] as const;
        
        for (const type of types) {
          const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
            type,
            quantity: 2
          }, sessionCookie);
          const response = await POST(request);

          if (!response) {
            throw new Error('No response from spawn-objects API');
          }

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.spawned).toBe(2);

          // Verify correct type in database
          const db = await getDatabase();
          const result = await db.query<{ type: string }>(
            'SELECT * FROM space_objects WHERE id = ANY($1::int[])',
            [data.ids]
          );
          
          result.rows.forEach((row) => {
            expect(row.type).toBe(type);
          });
        }
      });
    });

    it('spawnObjects_maxQuantity_succeeds', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 50 // Max allowed
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from spawn-objects API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.spawned).toBe(50);
        expect(data.ids).toHaveLength(50);

        // Verify all objects exist
        const db = await getDatabase();
        const result = await db.query<{ count: string }>(
          'SELECT COUNT(*) as count FROM space_objects WHERE id = ANY($1::int[])',
          [data.ids]
        );
        expect(Number(result.rows[0].count)).toBe(50);
      });
    });

    it('spawnObjects_multipleRequests_allSucceed', async () => {
      await withTransaction(async () => {
        // First request
        const request1 = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'asteroid',
          quantity: 5
        }, sessionCookie);
        const response1 = await POST(request1);
        expect(response1.status).toBe(200);
        const data1 = await response1.json();

        // Second request
        const request2 = createRequest('http://localhost:3000/api/admin/spawn-objects', 'POST', {
          type: 'shipwreck',
          quantity: 3
        }, sessionCookie);
        const response2 = await POST(request2);
        expect(response2.status).toBe(200);
        const data2 = await response2.json();

        // Verify both spawned correctly
        expect(data1.spawned).toBe(5);
        expect(data2.spawned).toBe(3);

        // Verify no ID collisions
        const allIds = [...data1.ids, ...data2.ids];
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(8); // Should be 8 unique IDs
      });
    });
  });
});
