// ---
// Tests for the collection API endpoint
// ---

import request from 'supertest';
import { createApp } from '../src/createApp';
import { Database } from 'sqlite3';
import { CREATE_TABLES } from '../src/schema';
import type { Express } from 'express';

// Type definitions for database query results
interface CountResult {
  count: number;
}

interface SpaceObjectRow {
  id: number;
  type: string;
}

describe('Collection API', () => {
  let db: Database;
  let app: Express;
  let agent: request.Agent;

  beforeEach(async () => {
    // Create in-memory database for testing (acts as a mock database)
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

  describe('POST /api/collect', () => {
    it('collectAPI_notAuthenticated_returns401', async () => {
      const response = await agent.post('/api/collect').send({ objectId: 1 });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('collectAPI_missingObjectId_returns400', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      const response = await agent.post('/api/collect').send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing object ID');
    });

    it('collectAPI_objectNotFound_returns404', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      const response = await agent.post('/api/collect').send({ objectId: 999 });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Object not found');
    });

    it('collectAPI_cannotCollectPlayerShip_returns400', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert a player ship
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 200, 0, 0, now, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.post('/api/collect').send({ objectId: 1 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot collect player ships');
    });

    it('collectAPI_playerShipNotFound_returns404', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert an asteroid but no player ship
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('asteroid', 100, 200, 0, 0, now, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.post('/api/collect').send({ objectId: 1 });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Player ship not found');
    });

    it('collectAPI_objectTooFarAway_returns400', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Get user ID for ship linking
      const userId = 1; // First user created
      
      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Insert player ship and distant asteroid
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 0, 0, now, (err) => {
          if (err) reject(err);
          else {
            // Insert asteroid far away (distance > 125)
            insertSpaceObject.run('asteroid', 300, 300, 0, 0, now, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.post('/api/collect').send({ objectId: 2 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Object too far away');
    });

    it('collectAPI_successfulCollection_returns200', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Get user ID for ship linking
      const userId = 1; // First user created
      
      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Insert player ship and nearby asteroid
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 0, 0, now, (err) => {
          if (err) reject(err);
          else {
            // Insert asteroid nearby (distance <= 125)
            insertSpaceObject.run('asteroid', 150, 150, 0, 0, now, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.post('/api/collect').send({ objectId: 2 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.distance).toBeDefined();
      expect(response.body.distance).toBeLessThanOrEqual(125);
    });

    it('collectAPI_collectDifferentObjectTypes_allSucceed', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Get user ID for ship linking
      const userId = 1; // First user created
      
      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Insert player ship and various collectible objects nearby
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 0, 0, now, (err) => {
          if (err) reject(err);
          else {
            insertSpaceObject.run('asteroid', 120, 120, 0, 0, now, (err) => {
              if (err) reject(err);
              else {
                insertSpaceObject.run('shipwreck', 130, 130, 0, 0, now, (err) => {
                  if (err) reject(err);
                  else {
                    insertSpaceObject.run('escape_pod', 140, 140, 0, 0, now, (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  }
                });
              }
            });
          }
        });
      });

      insertSpaceObject.finalize();

      // Count initial objects
      const initialCount = await new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM space_objects', (err, row: CountResult) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Collect asteroid
      const response1 = await agent.post('/api/collect').send({ objectId: 2 });
      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Verify object count remains the same (one removed, one spawned)
      const countAfterFirstCollection = await new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM space_objects', (err, row: CountResult) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      expect(countAfterFirstCollection).toBe(initialCount);

      // Collect shipwreck
      const response2 = await agent.post('/api/collect').send({ objectId: 3 });
      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);

      // Collect escape pod
      const response3 = await agent.post('/api/collect').send({ objectId: 4 });
      expect(response3.status).toBe(200);
      expect(response3.body.success).toBe(true);

      // Verify final object count (should still be the same)
      const finalCount = await new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM space_objects', (err, row: CountResult) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      expect(finalCount).toBe(initialCount);
    });

    it('collectAPI_spawnsNewObjectAfterCollection_differentTypes', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Get user ID for ship linking
      const userId = 1; // First user created
      
      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Insert player ship and collectible object
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 0, 0, now, (err) => {
          if (err) reject(err);
          else {
            insertSpaceObject.run('asteroid', 120, 120, 0, 0, now, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });

      insertSpaceObject.finalize();

      // Get initial object types
      const initialObjects = await new Promise<SpaceObjectRow[]>((resolve, reject) => {
        db.all('SELECT id, type FROM space_objects ORDER BY id', (err, rows: SpaceObjectRow[]) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Collect the asteroid
      const response = await agent.post('/api/collect').send({ objectId: 2 });
      expect(response.status).toBe(200);

      // Get final objects
      const finalObjects = await new Promise<SpaceObjectRow[]>((resolve, reject) => {
        db.all('SELECT id, type FROM space_objects ORDER BY id', (err, rows: SpaceObjectRow[]) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Should have same number of objects
      expect(finalObjects.length).toBe(initialObjects.length);
      
      // Should have a new object with a different ID
      const newObject = finalObjects.find(obj => !initialObjects.some(initial => initial.id === obj.id));
      expect(newObject).toBeDefined();
      expect(newObject).toBeTruthy(); // Ensure it's not undefined
      if (newObject) {
        expect(['asteroid', 'shipwreck', 'escape_pod']).toContain(newObject.type);
      }
    });

    it('collectAPI_toroidalDistanceCalculation_worksCorrectly', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Get user ID for ship linking
      const userId = 1; // First user created
      
      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Insert player ship near world edge and asteroid on other side (should wrap around)
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 10, 250, 0, 0, now, (err) => {
          if (err) reject(err);
          else {
            // Asteroid on far side - toroidal distance should be small
            insertSpaceObject.run('asteroid', 490, 250, 0, 0, now, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });

      insertSpaceObject.finalize();

      const response = await agent.post('/api/collect').send({ objectId: 2 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Toroidal distance should be ~20, not ~480
      expect(response.body.distance).toBeLessThan(50);
    });
  });
});
