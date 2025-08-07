// ---
// Tests for the world API endpoint
// ---
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/createApp';
import { Database } from 'sqlite3';
import { CREATE_TABLES } from '../src/schema';
import type { Express } from 'express';

describe('World API', () => {
  let db: Database;
  let app: Express;
  let agent: request.Agent;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Create tables
    await new Promise<void>((resolve, reject) => {
      let completed = 0;
      const tables = CREATE_TABLES;
      
      tables.forEach((createTableSQL) => {
        db.run(createTableSQL, (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === tables.length) {
            resolve();
          }
        });
      });
    });

    // Create app and agent
    app = createApp(db);
    agent = request.agent(app);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      try {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch {
        // Database might already be closed
        resolve();
      }
    });
  });

  describe('GET /api/world', () => {
    it('worldAPI_notAuthenticated_returns401', async () => {
      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('worldAPI_authenticatedWithNoObjects_returnsEmptyWorld', async () => {
      // Register and login user (automatically creates a player ship)
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('worldSize');
      expect(response.body.worldSize).toEqual({ width: 500, height: 500 });
      expect(response.body).toHaveProperty('spaceObjects');
      
      // Now expects one player ship (auto-created during registration)
      expect(response.body.spaceObjects).toHaveLength(1);
      expect(response.body.spaceObjects[0].type).toBe('player_ship');
      expect(response.body.spaceObjects[0].x).toBe(250);
      expect(response.body.spaceObjects[0].y).toBe(250);
    });

    it('worldAPI_withSpaceObjects_returnsObjectsWithUpdatedPositions', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert test space objects with known positions and velocities
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('asteroid', 100, 200, 10, 0, now - 1000, (err) => { // 1 second ago
          if (err) reject(err);
          else {
            insertSpaceObject.run('shipwreck', 300, 400, 20, 90, now - 500, (err) => { // 0.5 seconds ago
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(200);
      expect(response.body.spaceObjects).toHaveLength(3); // player ship + asteroid + shipwreck
      
      // Filter out the player ship to check the test objects
      const testObjects = response.body.spaceObjects.filter((obj: { type: string }) => obj.type !== 'player_ship');
      expect(testObjects).toHaveLength(2);
      
      // Check that positions have been updated based on speed and time
      const asteroid = response.body.spaceObjects.find((obj: { type: string }) => obj.type === 'asteroid');
      const shipwreck = response.body.spaceObjects.find((obj: { type: string }) => obj.type === 'shipwreck');
      
      expect(asteroid).toBeDefined();
      expect(asteroid.x).toBeGreaterThan(100); // Should have moved right (angle 0, speed 10)
      expect(asteroid.y).toBe(200); // Y should be unchanged
      
      expect(shipwreck).toBeDefined();
      expect(shipwreck.x).toBeCloseTo(300, 1); // X should be roughly unchanged (angle 90)
      expect(shipwreck.y).toBeGreaterThan(400); // Should have moved up (angle 90, speed 20)
    });

    it('worldAPI_objectCrossesBoundary_wrapsToroidally', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert object near boundary that will cross it
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        // Object at x=490, moving right at 20 units/minute, 1 second ago
        // Movement: (20 * 1000ms / 60000 * 50) = 16.667
        // Should end up at x=6.667 (490 + 16.667 = 506.667, wraps to 6.667)
        insertSpaceObject.run('escape_pod', 490, 250, 20, 0, now - 1000, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(200);
      expect(response.body.spaceObjects).toHaveLength(2); // escape pod + player ship
      
      const escapePod = response.body.spaceObjects.find((obj: { type: string }) => obj.type === 'escape_pod');
      expect(escapePod).toBeDefined();
      expect(escapePod.x).toBeGreaterThanOrEqual(6.4);
      expect(escapePod.x).toBeLessThanOrEqual(7.0); // Should have wrapped around
      expect(escapePod.x).toBeCloseTo(6.667, 0);
      expect(escapePod.y).toBe(250); // Y unchanged
    });

    it('worldAPI_multipleCallsInSequence_showsProgressiveMovement', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert moving object
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('asteroid', 100, 200, 50, 0, now, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      // First call
      const response1 = await agent.get('/api/world');
      expect(response1.status).toBe(200);
      const asteroid1 = response1.body.spaceObjects.find((obj: { type: string }) => obj.type === 'asteroid');
      expect(asteroid1).toBeDefined();
      const position1 = asteroid1.x;

      // Wait a bit and call again
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

      const response2 = await agent.get('/api/world');
      expect(response2.status).toBe(200);
      const asteroid2 = response2.body.spaceObjects.find((obj: { type: string }) => obj.type === 'asteroid');
      expect(asteroid2).toBeDefined();
      const position2 = asteroid2.x;

      // Position should have increased (object moving right)
      expect(position2).toBeGreaterThan(position1);
    });

    it('worldAPI_stationaryObjects_positionsUnchanged', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert stationary object (speed = 0)
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('asteroid', 150, 250, 0, 45, now - 5000, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(200);
      expect(response.body.spaceObjects).toHaveLength(2); // asteroid + player ship
      
      const asteroid = response.body.spaceObjects.find((obj: { type: string }) => obj.type === 'asteroid');
      expect(asteroid).toBeDefined();
      expect(asteroid.x).toBe(150); // Should be unchanged
      expect(asteroid.y).toBe(250); // Should be unchanged
    });

    it('worldAPI_updatesLastPositionUpdate_setsCurrentTime', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert object with old timestamp
      const oldTime = Date.now() - 10000; // 10 seconds ago
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('asteroid', 100, 200, 10, 0, oldTime, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      const beforeCall = Date.now();
      const response = await agent.get('/api/world');
      const afterCall = Date.now();
      
      expect(response.status).toBe(200);
      
      const asteroid = response.body.spaceObjects[0];
      expect(asteroid.last_position_update_ms).toBeGreaterThanOrEqual(beforeCall);
      expect(asteroid.last_position_update_ms).toBeLessThanOrEqual(afterCall);
    });

    it('worldAPI_databaseError_returns500', async () => {
      // Create a separate database instance for this test to avoid affecting cleanup
      const testDb = new Database(':memory:');
      
      // Create tables in test database
      await new Promise<void>((resolve, reject) => {
        let completed = 0;
        const tables = CREATE_TABLES;
        
        tables.forEach((createTableSQL) => {
          testDb.run(createTableSQL, (err) => {
            if (err) {
              reject(err);
              return;
            }
            completed++;
            if (completed === tables.length) {
              resolve();
            }
          });
        });
      });

      // Create separate app with test database
      const testApp = createApp(testDb);
      const testAgent = request.agent(testApp);

      // Register and login user
      await testAgent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Close test database to simulate error
      testDb.close();

      const response = await testAgent.get('/api/world');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });
  });
});
