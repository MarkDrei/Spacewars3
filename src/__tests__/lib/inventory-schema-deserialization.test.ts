// ---
// Tests for inventory schema definition and deserialization in userRepo
// Validates that inventory column is properly added and parsed from database
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../lib/server/database';
import { getUserByIdFromDb, saveUserToDb } from '../../lib/server/user/userRepo';
import { InventoryItem, INVENTORY_ROWS, INVENTORY_COLS, Commander } from '../../shared/src/types/inventory';
import type { DatabaseConnection } from '../../lib/server/database';

describe('Inventory Schema and Deserialization', () => {
  let db: DatabaseConnection;
  let testUserId: number;

  beforeEach(async () => {
    db = await getDatabase();
    await db.query('BEGIN');
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
  });

  describe('Schema Definition', () => {
    it('inventoryColumn_freshDatabase_existsWithCorrectType', async () => {
      // Query the database schema to check if inventory column exists
      const result = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'inventory'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('inventory');
      expect(result.rows[0].data_type).toBe('text');
      expect(result.rows[0].is_nullable).toBe('YES');
    });

    it('inventoryColumn_newUser_defaultsToNull', async () => {
      // Create a new user via raw SQL (not through userRepo)
      const now = Math.floor(Date.now() / 1000);
      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree) VALUES ($1, $2, $3, $4, $5) RETURNING id, inventory',
        ['test_inventory_default', 'hash', 0.0, now, '{}']
      );

      expect(result.rows[0].inventory).toBeNull();
    });
  });

  describe('Deserialization - Empty Inventory', () => {
    it('userFromRow_nullInventoryColumn_deserializesToEmpty10x10Grid', async () => {
      const { createUserWithoutShip } = await import('../../lib/server/user/userRepo');
      const user = await createUserWithoutShip(db, 'test_empty_inventory', 'hash', saveUserToDb(db));
      testUserId = user.id;

      // Fetch the user from database
      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser!.inventory).toBeDefined();
      expect(Array.isArray(fetchedUser!.inventory)).toBe(true);
      expect(fetchedUser!.inventory.length).toBe(INVENTORY_ROWS);

      // Check all rows
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        expect(Array.isArray(fetchedUser!.inventory[row])).toBe(true);
        expect(fetchedUser!.inventory[row].length).toBe(INVENTORY_COLS);

        // Check all columns in this row
        for (let col = 0; col < INVENTORY_COLS; col++) {
          expect(fetchedUser!.inventory[row][col]).toBeNull();
        }
      }
    });

    it('userFromRow_emptyJsonArray_deserializesToEmpty10x10Grid', async () => {
      const now = Math.floor(Date.now() / 1000);
      const emptyGrid = JSON.stringify(
        Array.from({ length: INVENTORY_ROWS }, () =>
          Array.from({ length: INVENTORY_COLS }, () => null)
        )
      );

      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['test_empty_json', 'hash', 0.0, now, '{}', emptyGrid]
      );
      testUserId = result.rows[0].id;

      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser!.inventory).toBeDefined();
      expect(fetchedUser!.inventory.length).toBe(INVENTORY_ROWS);

      // Verify all slots are null
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
          expect(fetchedUser!.inventory[row][col]).toBeNull();
        }
      }
    });
  });

  describe('Deserialization - With Items', () => {
    it('userFromRow_inventoryWithCommander_deserializesCorrectly', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Create a commander item
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Captain Nova',
        stats: [
          { statType: 'shipSpeed', bonusPercent: 25 },
          { statType: 'projectileDamage', bonusPercent: 50 }
        ]
      };

      // Create inventory with commander in slot [0][0]
      const inventory: (InventoryItem | null)[][] = Array.from(
        { length: INVENTORY_ROWS },
        () => Array.from({ length: INVENTORY_COLS }, () => null)
      );
      inventory[0][0] = { type: 'commander', data: commander };

      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['test_with_commander', 'hash', 0.0, now, '{}', JSON.stringify(inventory)]
      );
      testUserId = result.rows[0].id;

      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser!.inventory[0][0]).not.toBeNull();
      
      const item = fetchedUser!.inventory[0][0] as InventoryItem;
      expect(item.type).toBe('commander');
      expect(item.data).toEqual(commander);
    });

    it('userFromRow_inventoryWithMultipleItems_deserializesAllCorrectly', async () => {
      const now = Math.floor(Date.now() / 1000);

      const commander1: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Commander Alpha',
        stats: [{ statType: 'energyDamage', bonusPercent: 30 }]
      };

      const commander2: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Commander Beta',
        stats: [
          { statType: 'projectileAccuracy', bonusPercent: 40 },
          { statType: 'energyReloadRate', bonusPercent: 60 }
        ]
      };

      // Create inventory with multiple commanders
      const inventory: (InventoryItem | null)[][] = Array.from(
        { length: INVENTORY_ROWS },
        () => Array.from({ length: INVENTORY_COLS }, () => null)
      );
      inventory[0][0] = { type: 'commander', data: commander1 };
      inventory[5][7] = { type: 'commander', data: commander2 };

      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['test_multiple_items', 'hash', 0.0, now, '{}', JSON.stringify(inventory)]
      );
      testUserId = result.rows[0].id;

      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();

      // Check commander 1
      const item1 = fetchedUser!.inventory[0][0] as InventoryItem;
      expect(item1).not.toBeNull();
      expect(item1.type).toBe('commander');
      expect(item1.data).toEqual(commander1);

      // Check commander 2
      const item2 = fetchedUser!.inventory[5][7] as InventoryItem;
      expect(item2).not.toBeNull();
      expect(item2.type).toBe('commander');
      expect(item2.data).toEqual(commander2);

      // Check some empty slots
      expect(fetchedUser!.inventory[0][1]).toBeNull();
      expect(fetchedUser!.inventory[5][6]).toBeNull();
      expect(fetchedUser!.inventory[9][9]).toBeNull();
    });
  });

  describe('Deserialization - Error Handling', () => {
    it('userFromRow_invalidJsonInInventory_fallsBackToEmptyGrid', async () => {
      const now = Math.floor(Date.now() / 1000);

      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['test_invalid_json', 'hash', 0.0, now, '{}', 'invalid json {']
      );
      testUserId = result.rows[0].id;

      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser!.inventory).toBeDefined();
      expect(fetchedUser!.inventory.length).toBe(INVENTORY_ROWS);

      // Should fallback to empty grid
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        expect(fetchedUser!.inventory[row].length).toBe(INVENTORY_COLS);
        for (let col = 0; col < INVENTORY_COLS; col++) {
          expect(fetchedUser!.inventory[row][col]).toBeNull();
        }
      }
    });

    it('userFromRow_wrongDimensionsInInventory_fallsBackToEmptyGrid', async () => {
      const now = Math.floor(Date.now() / 1000);

      // Create a 5×5 grid instead of 10×10
      const wrongSizedGrid = JSON.stringify(
        Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null))
      );

      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['test_wrong_dimensions', 'hash', 0.0, now, '{}', wrongSizedGrid]
      );
      testUserId = result.rows[0].id;

      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser!.inventory).toBeDefined();
      expect(fetchedUser!.inventory.length).toBe(INVENTORY_ROWS);

      // Should fallback to correct 10×10 empty grid
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        expect(fetchedUser!.inventory[row].length).toBe(INVENTORY_COLS);
        for (let col = 0; col < INVENTORY_COLS; col++) {
          expect(fetchedUser!.inventory[row][col]).toBeNull();
        }
      }
    });

    it('userFromRow_inventoryNotAnArray_fallsBackToEmptyGrid', async () => {
      const now = Math.floor(Date.now() / 1000);

      const result = await db.query(
        'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['test_not_array', 'hash', 0.0, now, '{}', '{"not": "an array"}']
      );
      testUserId = result.rows[0].id;

      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser!.inventory).toBeDefined();
      expect(fetchedUser!.inventory.length).toBe(INVENTORY_ROWS);

      // Should fallback to empty grid
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        expect(fetchedUser!.inventory[row].length).toBe(INVENTORY_COLS);
        for (let col = 0; col < INVENTORY_COLS; col++) {
          expect(fetchedUser!.inventory[row][col]).toBeNull();
        }
      }
    });
  });

  describe('Serialization - Save to Database', () => {
    it('saveUserToDb_inventoryWithItems_serializesCorrectly', async () => {
      const { createUserWithoutShip } = await import('../../lib/server/user/userRepo');
      const user = await createUserWithoutShip(db, 'test_save_inventory', 'hash', saveUserToDb(db));
      testUserId = user.id;

      // Add a commander to inventory
      const commander: Commander = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Commander Gamma',
        stats: [
          { statType: 'shipSpeed', bonusPercent: 35 },
          { statType: 'projectileDamage', bonusPercent: 45 },
          { statType: 'energyAccuracy', bonusPercent: 55 }
        ]
      };
      user.inventory[2][3] = { type: 'commander', data: commander };

      // Save the user
      await saveUserToDb(db)(user);

      // Fetch from database and verify
      const result = await db.query('SELECT inventory FROM users WHERE id = $1', [testUserId]);
      expect(result.rows).toHaveLength(1);

      const savedInventory = JSON.parse(result.rows[0].inventory);
      expect(savedInventory[2][3]).toEqual({ type: 'commander', data: commander });
      expect(savedInventory[0][0]).toBeNull();
      expect(savedInventory[9][9]).toBeNull();
    });

    it('saveUserToDb_emptyInventory_serializesAsEmptyGrid', async () => {
      const { createUserWithoutShip } = await import('../../lib/server/user/userRepo');
      const user = await createUserWithoutShip(db, 'test_save_empty', 'hash', saveUserToDb(db));
      testUserId = user.id;

      // Save the user (inventory is empty)
      await saveUserToDb(db)(user);

      // Fetch from database and verify
      const result = await db.query('SELECT inventory FROM users WHERE id = $1', [testUserId]);
      expect(result.rows).toHaveLength(1);

      const savedInventory = JSON.parse(result.rows[0].inventory);
      expect(savedInventory.length).toBe(INVENTORY_ROWS);
      
      for (let row = 0; row < INVENTORY_ROWS; row++) {
        expect(savedInventory[row].length).toBe(INVENTORY_COLS);
        for (let col = 0; col < INVENTORY_COLS; col++) {
          expect(savedInventory[row][col]).toBeNull();
        }
      }
    });
  });

  describe('Round-trip Consistency', () => {
    it('inventoryRoundTrip_complexInventory_maintainsDataIntegrity', async () => {
      const { createUserWithoutShip } = await import('../../lib/server/user/userRepo');
      const user = await createUserWithoutShip(db, 'test_roundtrip', 'hash', saveUserToDb(db));
      testUserId = user.id;

      // Create a complex inventory
      const commanders: Commander[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          name: 'Commander One',
          stats: [{ statType: 'shipSpeed', bonusPercent: 20 }]
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          name: 'Commander Two',
          stats: [
            { statType: 'projectileDamage', bonusPercent: 30 },
            { statType: 'energyDamage', bonusPercent: 40 }
          ]
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          name: 'Commander Three',
          stats: [
            { statType: 'projectileAccuracy', bonusPercent: 50 },
            { statType: 'energyReloadRate', bonusPercent: 60 },
            { statType: 'projectileReloadRate', bonusPercent: 70 }
          ]
        }
      ];

      // Place commanders in various positions
      user.inventory[0][0] = { type: 'commander', data: commanders[0] };
      user.inventory[4][5] = { type: 'commander', data: commanders[1] };
      user.inventory[9][9] = { type: 'commander', data: commanders[2] };

      // Save to database
      await saveUserToDb(db)(user);

      // Fetch from database
      const fetchedUser = await getUserByIdFromDb(db, testUserId, saveUserToDb(db));

      expect(fetchedUser).not.toBeNull();

      // Verify commanders are in correct positions
      expect(fetchedUser!.inventory[0][0]).toEqual({ type: 'commander', data: commanders[0] });
      expect(fetchedUser!.inventory[4][5]).toEqual({ type: 'commander', data: commanders[1] });
      expect(fetchedUser!.inventory[9][9]).toEqual({ type: 'commander', data: commanders[2] });

      // Verify some empty slots
      expect(fetchedUser!.inventory[0][1]).toBeNull();
      expect(fetchedUser!.inventory[5][5]).toBeNull();
    });
  });
});
