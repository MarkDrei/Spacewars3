import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/time-multiplier/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { createRequest, createAuthenticatedSession, createUser, extractSessionCookie } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';

describe('Admin Time Multiplier API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    // Reset time multiplier before each test
    TimeMultiplierService.resetInstance();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
    // Clean up after tests
    TimeMultiplierService.resetInstance();
  });

  describe('GET /api/admin/time-multiplier', () => {
    it('GET_authenticated_returnsCurrentStatus', async () => {
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

        // GET request to time-multiplier endpoint
        const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'GET', undefined, sessionCookie);
        const response = await GET(request);

        if (!response) {
          throw new Error('No response from time-multiplier API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();

        // Verify response structure
        expect(data).toHaveProperty('multiplier');
        expect(data).toHaveProperty('expiresAt');
        expect(data).toHaveProperty('activatedAt');
        expect(data).toHaveProperty('remainingSeconds');

        // Verify default values
        expect(data.multiplier).toBe(1);
        expect(data.expiresAt).toBeNull();
        expect(data.activatedAt).toBeNull();
        expect(data.remainingSeconds).toBe(0);
      });
    });

    it('GET_unauthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'GET');
        const response = await GET(request);

        if (!response) {
          throw new Error('No response from time-multiplier API');
        }

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Not authenticated');
      });
    });

    it('GET_nonAdmin_returns403', async () => {
      await withTransaction(async () => {
        // Create a regular (non-admin) user
        await createUser('regularuser');
        const sessionCookie = await createAuthenticatedSession('regularuser');

        const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'GET', undefined, sessionCookie);
        const response = await GET(request);

        if (!response) {
          throw new Error('No response from time-multiplier API');
        }

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toBe('Admin access restricted to developers');
      });
    });

    it('GET_afterExpiry_returnsMultiplier1', async () => {
      await withTransaction(async () => {
        // Set a very short duration multiplier (will expire quickly)
        const service = TimeMultiplierService.getInstance();
        service.setMultiplier(10, 0.001); // 0.001 minutes = 60ms

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 100));

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

        // GET request should show multiplier = 1 (expired)
        const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'GET', undefined, sessionCookie);
        const response = await GET(request);

        if (!response) {
          throw new Error('No response from time-multiplier API');
        }

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.multiplier).toBe(1); // Should be reset to 1
        expect(data.remainingSeconds).toBe(0);
      });
    });
  });

  describe('POST /api/admin/time-multiplier', () => {
    it('POST_validInput_setsMultiplier', async () => {
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

        // POST request to set multiplier
        const postRequest = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10,
          durationMinutes: 5
        }, sessionCookie);
        const postResponse = await POST(postRequest);

        if (!postResponse) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(postResponse.status).toBe(200);
        const data = await postResponse.json();

        // Verify response structure
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('multiplier');
        expect(data).toHaveProperty('expiresAt');
        expect(data).toHaveProperty('durationMinutes');

        // Verify values
        expect(data.success).toBe(true);
        expect(data.multiplier).toBe(10);
        expect(data.durationMinutes).toBe(5);
        expect(typeof data.expiresAt).toBe('number');
        expect(data.expiresAt).toBeGreaterThan(Date.now());

        // Verify that the multiplier was actually set by calling GET
        const getRequest = createRequest('http://localhost:3000/api/admin/time-multiplier', 'GET', undefined, sessionCookie);
        const getResponse = await GET(getRequest);
        const getStatus = await getResponse?.json();

        expect(getStatus?.multiplier).toBe(10);
        expect(getStatus?.remainingSeconds).toBeGreaterThan(0);
        expect(getStatus?.remainingSeconds).toBeLessThanOrEqual(5 * 60);
      });
    });

    it('POST_invalidMultiplier_returns400', async () => {
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

        // Test invalid multiplier (less than 1)
        const request1 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 0.5,
          durationMinutes: 5
        }, sessionCookie);
        const response1 = await POST(request1);

        if (!response1) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(response1.status).toBe(400);
        const data1 = await response1.json();
        expect(data1.error).toContain('Multiplier must be a number >= 1');

        // Test non-numeric multiplier
        const request2 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 'invalid',
          durationMinutes: 5
        }, sessionCookie);
        const response2 = await POST(request2);
        expect(response2?.status).toBe(400);

        // Test missing multiplier
        const request3 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          durationMinutes: 5
        }, sessionCookie);
        const response3 = await POST(request3);
        expect(response3?.status).toBe(400);
      });
    });

    it('POST_invalidDuration_returns400', async () => {
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

        // Test invalid duration (zero)
        const request1 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10,
          durationMinutes: 0
        }, sessionCookie);
        const response1 = await POST(request1);

        if (!response1) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(response1.status).toBe(400);
        const data1 = await response1.json();
        expect(data1.error).toContain('Duration must be a positive number');

        // Test negative duration
        const request2 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10,
          durationMinutes: -5
        }, sessionCookie);
        const response2 = await POST(request2);
        expect(response2?.status).toBe(400);

        // Test non-numeric duration
        const request3 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10,
          durationMinutes: 'invalid'
        }, sessionCookie);
        const response3 = await POST(request3);
        expect(response3?.status).toBe(400);

        // Test missing duration
        const request4 = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10
        }, sessionCookie);
        const response4 = await POST(request4);
        expect(response4?.status).toBe(400);
      });
    });

    it('POST_unauthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10,
          durationMinutes: 5
        });
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Not authenticated');
      });
    });

    it('POST_nonAdmin_returns403', async () => {
      await withTransaction(async () => {
        // Create a regular (non-admin) user
        await createUser('regularuser');
        const sessionCookie = await createAuthenticatedSession('regularuser');

        const request = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 10,
          durationMinutes: 5
        }, sessionCookie);
        const response = await POST(request);

        if (!response) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toBe('Admin access restricted to developers');
      });
    });

    it('POST_multiplierOf1_isValid', async () => {
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

        // POST request to set multiplier to 1 (minimum valid value)
        const postRequest = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 1,
          durationMinutes: 5
        }, sessionCookie);
        const postResponse = await POST(postRequest);

        if (!postResponse) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(postResponse.status).toBe(200);
        const data = await postResponse.json();
        expect(data.success).toBe(true);
        expect(data.multiplier).toBe(1);
      });
    });

    it('POST_highMultiplier_isValid', async () => {
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

        // POST request to set high multiplier (e.g., 100x)
        const postRequest = createRequest('http://localhost:3000/api/admin/time-multiplier', 'POST', {
          multiplier: 100,
          durationMinutes: 10
        }, sessionCookie);
        const postResponse = await POST(postRequest);

        if (!postResponse) {
          throw new Error('No response from time-multiplier POST API');
        }

        expect(postResponse.status).toBe(200);
        const data = await postResponse.json();
        expect(data.success).toBe(true);
        expect(data.multiplier).toBe(100);
      });
    });
  });
});
