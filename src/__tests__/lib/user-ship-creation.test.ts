// ---
// Test for user ship creation
// ---

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { Database } from 'sqlite3';
import { CREATE_TABLES } from '@/lib/server/schema';
import { createUser, saveUserToDb } from '@/lib/server/user/userRepo';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';

interface SpaceObjectRow {
  id: number;
  type: string;
  x: number;
  y: number;
  speed: number;
  angle: number;
  last_position_update_ms: number;
}

describe('User Ship Creation', () => {
  let db: Database;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
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
    await shutdownIntegrationTestServer();
  });

  it('createUser_newUser_createsShipAndLinksIt', async () => {
    // Create a new user
    const user = await createUser(db, 'testuser', 'passwordhash', saveUserToDb(db));
    
    // Verify user has a ship_id
    expect(user.ship_id).toBeDefined();
    expect(user.ship_id).toBeGreaterThan(0);
    
    // Verify the ship exists in the database
    const ship = await new Promise<SpaceObjectRow | null>((resolve, reject) => {
      db.get('SELECT * FROM space_objects WHERE id = ? AND type = ?', [user.ship_id, 'player_ship'], (err, row) => {
        if (err) reject(err);
        else resolve(row as SpaceObjectRow | undefined || null);
      });
    });
    
    expect(ship).toBeDefined();
    expect(ship).not.toBeNull();
    if (ship) {
      expect(ship.type).toBe('player_ship');
      expect(ship.x).toBe(250); // Center of world
      expect(ship.y).toBe(250); // Center of world
      expect(ship.speed).toBe(0);
      expect(ship.angle).toBe(0);
      expect(ship.last_position_update_ms).toBeGreaterThan(0);
    }
  });

  it('createUser_multipleUsers_eachGetsOwnShip', async () => {
    // Create two users
    const user1 = await createUser(db, 'user1', 'hash1', saveUserToDb(db));
    const user2 = await createUser(db, 'user2', 'hash2', saveUserToDb(db));
    
    // Verify each user has a different ship
    expect(user1.ship_id).toBeDefined();
    expect(user2.ship_id).toBeDefined();
    expect(user1.ship_id).not.toBe(user2.ship_id);
    
    // Verify both ships exist
    const ships = await new Promise<SpaceObjectRow[]>((resolve, reject) => {
      db.all('SELECT * FROM space_objects WHERE type = ?', ['player_ship'], (err, rows) => {
        if (err) reject(err);
        else resolve((rows as SpaceObjectRow[]) || []);
      });
    });
    
    expect(ships).toHaveLength(2);
    expect(ships.map(s => s.id)).toContain(user1.ship_id);
    expect(ships.map(s => s.id)).toContain(user2.ship_id);
  });
});
