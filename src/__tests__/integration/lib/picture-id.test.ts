import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';
import { DEFAULT_USERS } from '@/lib/server/seedData';

/**
 * Tests for picture_id functionality
 */
describe('Picture ID', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('spaceObjectsTable_hasPictureIdColumn_withDefaultValue', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Query the schema to check if picture_id column exists
      const result = await db.query(`
        SELECT column_name, column_default, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_name = 'space_objects' AND column_name = 'picture_id'
      `);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('picture_id');
      expect(result.rows[0].data_type).toBe('integer');
      expect(result.rows[0].is_nullable).toBe('NO');
      expect(result.rows[0].column_default).toContain('1');
    });
  });

  test('seedData_createsUsersWithCorrectPictureIds', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Query all player ships with their picture_ids
      const result = await db.query(`
        SELECT so.picture_id, u.username
        FROM space_objects so
        JOIN users u ON u.ship_id = so.id
        WHERE so.type = 'player_ship'
        ORDER BY u.username
      `);
      
      // Check that we have the expected users
      const userPictureIds = result.rows.reduce((acc: Record<string, number>, row: { username: string; picture_id: number }) => {
        acc[row.username] = row.picture_id;
        return acc;
      }, {} as Record<string, number>);
      
      // Verify default users have correct picture IDs
      expect(userPictureIds['a']).toBe(1);
      expect(userPictureIds['dummy']).toBe(2);
      expect(userPictureIds['dummy2']).toBe(3);
      expect(userPictureIds['dummy3']).toBe(4);
      expect(userPictureIds['dummy4']).toBe(5);
    });
  });

  test('seedData_createsNewDummyUsers', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Check that dummy2, dummy3, dummy4 exist
      const result = await db.query(`
        SELECT username, iron
        FROM users
        WHERE username IN ('dummy2', 'dummy3', 'dummy4')
        ORDER BY username
      `);
      
      expect(result.rows.length).toBe(3);
      expect(result.rows[0].username).toBe('dummy2');
      expect(result.rows[1].username).toBe('dummy3');
      expect(result.rows[2].username).toBe('dummy4');
      
      // All should have same iron amount as dummy (0)
      expect(result.rows[0].iron).toBe(0);
      expect(result.rows[1].iron).toBe(0);
      expect(result.rows[2].iron).toBe(0);
    });
  });

  test('seedData_newDummiesHaveShipsAtUniqueLocations', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Query ship locations for all dummy users
      const result = await db.query(`
        SELECT u.username, so.x, so.y
        FROM users u
        JOIN space_objects so ON u.ship_id = so.id
        WHERE u.username LIKE 'dummy%'
        ORDER BY u.username
      `);
      
      expect(result.rows.length).toBe(4);
      
      // Verify all locations are unique
      const locations = result.rows.map((row: { x: number; y: number }) => `${row.x},${row.y}`);
      const uniqueLocations = new Set(locations);
      expect(uniqueLocations.size).toBe(4);
      
      // Verify expected locations from seed data
      const locationMap = result.rows.reduce((acc: Record<string, { x: number; y: number }>, row: { username: string; x: number; y: number }) => {
        acc[row.username] = { x: row.x, y: row.y };
        return acc;
      }, {} as Record<string, { x: number; y: number }>);
      
      expect(locationMap['dummy']).toEqual({ x: 2530, y: 2530 });
      expect(locationMap['dummy2']).toEqual({ x: 2470, y: 2530 });
      expect(locationMap['dummy3']).toEqual({ x: 2560, y: 2530 });
      expect(locationMap['dummy4']).toEqual({ x: 2500, y: 2560 });
    });
  });

  test('worldRepo_loadWorldFromDb_includesPictureId', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const { loadWorldFromDb } = await import('@/lib/server/world/worldRepo');
      
      const world = await loadWorldFromDb(db, async () => {});
      
      // Find the player ship for user 'a'
      const userAShip = world.spaceObjects.find(obj => 
        obj.type === 'player_ship' && obj.username === 'a'
      );
      
      expect(userAShip).toBeDefined();
      expect(userAShip?.picture_id).toBe(1);
      
      // Find the player ship for user 'dummy'
      const dummyShip = world.spaceObjects.find(obj => 
        obj.type === 'player_ship' && obj.username === 'dummy'
      );
      
      expect(dummyShip).toBeDefined();
      expect(dummyShip?.picture_id).toBe(2);
      
      // Verify all player ships have picture_id
      const playerShips = world.spaceObjects.filter(obj => obj.type === 'player_ship');
      playerShips.forEach(ship => {
        expect(ship.picture_id).toBeDefined();
        expect(ship.picture_id).toBeGreaterThanOrEqual(1);
      });
    });
  });

  test('worldRepo_insertSpaceObject_usesPictureId', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const { insertSpaceObject } = await import('@/lib/server/world/worldRepo');
      
      const newObjectId = await insertSpaceObject(db, {
        type: 'player_ship',
        x: 100,
        y: 200,
        speed: 0,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 3
      });
      
      expect(newObjectId).toBeGreaterThan(0);
      
      // Verify the object was created with correct picture_id
      const result = await db.query(
        'SELECT picture_id FROM space_objects WHERE id = $1',
        [newObjectId]
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].picture_id).toBe(3);
    });
  });

  test('worldRepo_insertSpaceObject_defaultsPictureIdTo1', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const { insertSpaceObject } = await import('@/lib/server/world/worldRepo');
      
      // Insert without specifying picture_id
      const newObjectId = await insertSpaceObject(db, {
        type: 'asteroid',
        x: 100,
        y: 200,
        speed: 10,
        angle: 45,
        last_position_update_ms: Date.now(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        picture_id: undefined as any // Explicitly undefined to test fallback
      });
      
      expect(newObjectId).toBeGreaterThan(0);
      
      // Verify the object was created with default picture_id of 1
      const result = await db.query(
        'SELECT picture_id FROM space_objects WHERE id = $1',
        [newObjectId]
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].picture_id).toBe(1);
    });
  });

  test('seedData_countMatchesExpected', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Count total users in production seed data
      const userResult = await db.query(`
        SELECT COUNT(*) as count FROM users WHERE username NOT LIKE 'testuser%'
      `);
      
      // Should have 5 users: a, dummy, dummy2, dummy3, dummy4
      expect(parseInt(userResult.rows[0].count)).toBe(5);
      
      // Verify it matches the DEFAULT_USERS array length
      expect(DEFAULT_USERS.length).toBe(5);
    });
  });
});
