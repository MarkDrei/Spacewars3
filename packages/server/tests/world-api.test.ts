// ---
// Tests for the world API endpoint
// ---

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

  afterEach((done) => {
    try {
      db.close(done);
    } catch {
      // Database might already be closed
      done();
    }
  });

  describe('GET /api/world', () => {
    it('worldAPI_notAuthenticated_returns401', async () => {
      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('worldAPI_authenticatedWithNoObjects_returnsEmptyWorld', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('worldSize');
      expect(response.body.worldSize).toEqual({ width: 500, height: 500 });
      expect(response.body).toHaveProperty('spaceObjects');
      expect(response.body.spaceObjects).toEqual([]);
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
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
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
      expect(response.body.spaceObjects).toHaveLength(2);
      
      // Check that positions have been updated based on velocity and time
      const asteroid = response.body.spaceObjects.find((obj: { type: string }) => obj.type === 'asteroid');
      const shipwreck = response.body.spaceObjects.find((obj: { type: string }) => obj.type === 'shipwreck');
      
      expect(asteroid).toBeDefined();
      expect(asteroid.x).toBeGreaterThan(100); // Should have moved right (angle 0, velocity 10)
      expect(asteroid.y).toBe(200); // Y should be unchanged
      
      expect(shipwreck).toBeDefined();
      expect(shipwreck.x).toBeCloseTo(300, 1); // X should be roughly unchanged (angle 90)
      expect(shipwreck.y).toBeGreaterThan(400); // Should have moved up (angle 90, velocity 20)
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
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        // Object at x=490, moving right at 20 units/second, 1 second ago
        // Should end up at x=10 (490 + 20 = 510, wraps to 10)
        insertSpaceObject.run('escape_pod', 490, 250, 20, 0, now - 1000, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.get('/api/world');
      
      expect(response.status).toBe(200);
      expect(response.body.spaceObjects).toHaveLength(1);
      
      const escapePod = response.body.spaceObjects[0];
      expect(escapePod.x).toBeCloseTo(10, 1); // Should have wrapped around
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
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
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
      const position1 = response1.body.spaceObjects[0].x;

      // Wait a bit and call again
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

      const response2 = await agent.get('/api/world');
      expect(response2.status).toBe(200);
      const position2 = response2.body.spaceObjects[0].x;

      // Position should have increased (object moving right)
      expect(position2).toBeGreaterThan(position1);
    });

    it('worldAPI_stationaryObjects_positionsUnchanged', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert stationary object (velocity = 0)
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
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
      expect(response.body.spaceObjects).toHaveLength(1);
      
      const asteroid = response.body.spaceObjects[0];
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
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
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
      expect(asteroid.last_position_update).toBeGreaterThanOrEqual(beforeCall);
      expect(asteroid.last_position_update).toBeLessThanOrEqual(afterCall);
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
