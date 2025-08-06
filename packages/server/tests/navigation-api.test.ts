// ---
// Tests for the navigation API endpoint
// ---

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/createApp';
import { Database } from 'sqlite3';
import { CREATE_TABLES } from '../src/schema';
import type { Express } from 'express';

describe('Navigation API', () => {
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
        resolve();
      }
    });
  });

  describe('POST /api/navigate', () => {
    it('navigationAPI_notAuthenticated_returns401', async () => {
      const response = await agent.post('/api/navigate').send({ speed: 10 });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('navigationAPI_noParameters_returns400', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      const response = await agent.post('/api/navigate').send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Must provide speed and/or angle');
    });

    it('navigationAPI_playerShipNotFound_returns404', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Delete the user's ship to test the 404 case
      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM space_objects WHERE type = ?', ['player_ship'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const response = await agent.post('/api/navigate').send({ speed: 10 });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Player ship not found');
    });

    it('navigationAPI_invalidSpeed_returns400', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert player ship
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 0, 0, now, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const response = await agent.post('/api/navigate').send({ speed: -5 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Speed must be a non-negative number');
    });

    it('navigationAPI_speedExceedsMax_returns400', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert player ship
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 0, 0, now, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Try to set speed higher than max (default tech tree gives 25 base speed)
      const response = await agent.post('/api/navigate').send({ speed: 100 });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Speed cannot exceed');
    });

    it('navigationAPI_successfulNavigation_returns200', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Insert player ship
      const now = Date.now();
      const insertSpaceObject = db.prepare(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await new Promise<void>((resolve, reject) => {
        insertSpaceObject.run('player_ship', 100, 100, 5, 90, now, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      insertSpaceObject.finalize();

      // Update user with ship_id
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE users SET ship_id = ? WHERE id = ?', [1, 1], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const response = await agent.post('/api/navigate').send({ speed: 20, angle: 45 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.speed).toBe(20);
      expect(response.body.angle).toBe(45);
      expect(response.body.maxSpeed).toBeGreaterThan(0);
    });
  });

  describe('GET /api/ship-stats', () => {
    it('shipStatsAPI_notAuthenticated_returns401', async () => {
      const response = await agent.get('/api/ship-stats');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('shipStatsAPI_playerShipNotFound_returns404', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Delete the user's ship to test the 404 case
      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM space_objects WHERE type = ?', ['player_ship'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const response = await agent.get('/api/ship-stats');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Player ship not found');
    });

    it('shipStatsAPI_successfulRequest_returns200', async () => {
      // Register and login user
      await agent.post('/api/register').send({
        username: 'testuser',
        password: 'testpass'
      });

      // Update the newly created ship with specific test values
      const now = Date.now();
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE space_objects SET x = ?, y = ?, speed = ?, angle = ?, last_position_update_ms = ? WHERE type = ?', 
          [100, 200, 15, 45, now, 'player_ship'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const response = await agent.get('/api/ship-stats');
      
      expect(response.status).toBe(200);
      expect(response.body.x).toBeCloseTo(100, 1); // Allow for physics movement
      expect(response.body.y).toBeCloseTo(200, 1); // Allow for physics movement
      expect(response.body.speed).toBe(15);
      expect(response.body.angle).toBe(45);
      expect(response.body.maxSpeed).toBeGreaterThan(0);
      expect(response.body.last_position_update_ms).toBeGreaterThanOrEqual(now);
    });
  });
});
