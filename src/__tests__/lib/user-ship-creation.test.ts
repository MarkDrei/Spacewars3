// ---
// Test for user ship creation
// ---

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { CREATE_TABLES } from '@/lib/server/schema';
import { createUser, saveUserToDb } from '@/lib/server/user/userRepo';

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
  let db: Pool;

  beforeEach(async () => {
    // Create database connection for testing
    db = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_TEST_DB || 'spacewars_test',
      user: process.env.POSTGRES_USER || 'spacewars',
      password: process.env.POSTGRES_PASSWORD || 'spacewars',
      max: 5,
    });
    
    // Clean up and create tables
    const client = await db.connect();
    try {
      await client.query('DROP TABLE IF EXISTS battles CASCADE');
      await client.query('DROP TABLE IF EXISTS messages CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      await client.query('DROP TABLE IF EXISTS space_objects CASCADE');
      
      for (const createTableSQL of CREATE_TABLES) {
        await client.query(createTableSQL);
      }
    } finally {
      client.release();
    }
  });

  afterEach(async () => {
    await db.end();
  });

  it('createUser_newUser_createsShipAndLinksIt', async () => {
    // Create a new user
    const user = await createUser(db, 'testuser', 'passwordhash', saveUserToDb(db));
    
    // Verify user has a ship_id
    expect(user.ship_id).toBeDefined();
    expect(user.ship_id).toBeGreaterThan(0);
    
    // Verify the ship exists in the database
    const shipResult = await db.query('SELECT * FROM space_objects WHERE id = $1 AND type = $2', [user.ship_id, 'player_ship']);
    const ship = shipResult.rows[0] as SpaceObjectRow | undefined;
    
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
    const shipsResult = await db.query('SELECT * FROM space_objects WHERE type = $1', ['player_ship']);
    const ships = shipsResult.rows as SpaceObjectRow[];
    
    expect(ships).toHaveLength(2);
    expect(ships.map(s => s.id)).toContain(user1.ship_id);
    expect(ships.map(s => s.id)).toContain(user2.ship_id);
  });
});
