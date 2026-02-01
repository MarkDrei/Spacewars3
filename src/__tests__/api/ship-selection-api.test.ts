import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { POST as updateShipPOST } from '@/app/api/update-ship/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as loginPOST } from '@/app/api/login/route';
import { GET as sessionGET } from '@/app/api/session/route';

// Import shared test helpers
import { createRequest, randomUsername } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';

describe('Ship Selection API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('updateShip_validShipId_successfullyUpdatesDatabase', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      
      // Register and login a user
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass'
      });
      const registerResponse = await registerPOST(registerRequest);
      expect(registerResponse.status).toBe(200);

      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: 'testpass'
      });
      const loginResponse = await loginPOST(loginRequest);
      const loginData = await loginResponse.json();
      expect(loginResponse.status).toBe(200);
      
      // Update ship picture to 3
      const updateRequest = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 3
      }, loginData.sessionId);
      const updateResponse = await updateShipPOST(updateRequest);
      const updateData = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updateData.success).toBe(true);
      expect(updateData.shipPictureId).toBe(3);

      // Verify in database
      const db = await getDatabase();
      const result = await db.query(
        'SELECT ship_picture_id FROM users WHERE username = $1',
        [username]
      );
      expect(result.rows[0].ship_picture_id).toBe(3);
    });
  });

  test('updateShip_invalidShipIdTooLow_returnsError', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      
      // Register and login
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass'
      });
      await registerPOST(registerRequest);

      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: 'testpass'
      });
      const loginResponse = await loginPOST(loginRequest);
      const loginData = await loginResponse.json();
      
      // Try to update with invalid ship ID (0)
      const updateRequest = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 0
      }, loginData.sessionId);
      const updateResponse = await updateShipPOST(updateRequest);
      const updateData = await updateResponse.json();

      expect(updateResponse.status).toBe(400);
      expect(updateData.error).toContain('Invalid ship picture ID');
    });
  });

  test('updateShip_invalidShipIdTooHigh_returnsError', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      
      // Register and login
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass'
      });
      await registerPOST(registerRequest);

      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: 'testpass'
      });
      const loginResponse = await loginPOST(loginRequest);
      const loginData = await loginResponse.json();
      
      // Try to update with invalid ship ID (6)
      const updateRequest = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 6
      }, loginData.sessionId);
      const updateResponse = await updateShipPOST(updateRequest);
      const updateData = await updateResponse.json();

      expect(updateResponse.status).toBe(400);
      expect(updateData.error).toContain('Invalid ship picture ID');
    });
  });

  test('updateShip_notAuthenticated_returnsUnauthorized', async () => {
    await withTransaction(async () => {
      // Try to update without authentication
      const updateRequest = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 2
      });
      const updateResponse = await updateShipPOST(updateRequest);
      const updateData = await updateResponse.json();

      expect(updateResponse.status).toBe(401);
      expect(updateData.error).toBeDefined();
    });
  });

  test('updateShip_multipleUpdates_persistsLatestValue', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      
      // Register and login
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass'
      });
      await registerPOST(registerRequest);

      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: 'testpass'
      });
      const loginResponse = await loginPOST(loginRequest);
      const loginData = await loginResponse.json();
      
      // Update to ship 2
      const update1Request = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 2
      }, loginData.sessionId);
      await updateShipPOST(update1Request);

      // Update to ship 4
      const update2Request = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 4
      }, loginData.sessionId);
      await updateShipPOST(update2Request);

      // Update to ship 5
      const update3Request = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 5
      }, loginData.sessionId);
      const update3Response = await updateShipPOST(update3Request);
      const update3Data = await update3Response.json();

      expect(update3Data.shipPictureId).toBe(5);

      // Verify final value in database
      const db = await getDatabase();
      const result = await db.query(
        'SELECT ship_picture_id FROM users WHERE username = $1',
        [username]
      );
      expect(result.rows[0].ship_picture_id).toBe(5);
    });
  });

  test('session_returnsShipPictureId', async () => {
    await withTransaction(async () => {
      const username = randomUsername();
      
      // Register and login
      const registerRequest = createRequest('http://localhost:3000/api/register', 'POST', {
        username,
        password: 'testpass'
      });
      await registerPOST(registerRequest);

      const loginRequest = createRequest('http://localhost:3000/api/login', 'POST', {
        username,
        password: 'testpass'
      });
      const loginResponse = await loginPOST(loginRequest);
      const loginData = await loginResponse.json();
      
      // Update ship picture to 4
      const updateRequest = createRequest('http://localhost:3000/api/update-ship', 'POST', {
        shipPictureId: 4
      }, loginData.sessionId);
      await updateShipPOST(updateRequest);

      // Check session endpoint
      const sessionRequest = createRequest('http://localhost:3000/api/session', 'GET', undefined, loginData.sessionId);
      const sessionResponse = await sessionGET(sessionRequest);
      const sessionData = await sessionResponse.json();

      expect(sessionResponse.status).toBe(200);
      expect(sessionData.loggedIn).toBe(true);
      expect(sessionData.shipPictureId).toBe(4);
      expect(sessionData.username).toBe(username);
    });
  });
});
