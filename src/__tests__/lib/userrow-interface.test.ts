// ---
// Tests for UserRow interface to verify XP property is correctly defined
// ---

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseConnection, getDatabase } from '@/lib/server/database';
import { withTransaction } from '../helpers/transactionHelper';

describe('UserRow Interface - XP Property', () => {
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = await getDatabase();
  });

  it('userRow_hasXpProperty_whenLoadedFromDatabase', async () => {
    await withTransaction(async () => {
      // Create a test user with explicit XP value
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_user', 'hash123', 100, 5000, Math.floor(Date.now() / 1000), '{}']
      );

      // Load the user and verify XP is accessible
      const result = await db.query(
        'SELECT id, username, iron, xp FROM users WHERE username = $1',
        ['test_xp_user']
      );

      expect(result.rows.length).toBe(1);
      const row = result.rows[0];
      
      // Verify XP property exists and has correct value
      expect(row.xp).toBeDefined();
      expect(typeof row.xp).toBe('number');
      expect(row.xp).toBe(5000);
    });
  });

  it('userRow_hasDefaultXp_whenCreatedWithoutExplicitValue', async () => {
    await withTransaction(async () => {
      // Create a user without specifying XP (should get default value)
      await db.query(
        `INSERT INTO users (username, password_hash, iron, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5)`,
        ['test_default_xp', 'hash456', 200, Math.floor(Date.now() / 1000), '{}']
      );

      // Load the user and verify default XP
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_default_xp']
      );

      expect(result.rows.length).toBe(1);
      const row = result.rows[0];
      
      // Verify XP defaults to 0
      expect(row.xp).toBe(0);
    });
  });

  it('userRow_supportsXpUpdate_whenModified', async () => {
    await withTransaction(async () => {
      // Create a user with initial XP
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_update_xp', 'hash789', 300, 1000, Math.floor(Date.now() / 1000), '{}']
      );

      // Update XP value
      await db.query(
        'UPDATE users SET xp = $1 WHERE username = $2',
        [2500, 'test_update_xp']
      );

      // Verify update was successful
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_update_xp']
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].xp).toBe(2500);
    });
  });

  it('userRow_supportsAllColumns_includingXp', async () => {
    await withTransaction(async () => {
      const now = Math.floor(Date.now() / 1000);
      // Create a comprehensive user record
      await db.query(
        `INSERT INTO users (
          username, password_hash, iron, xp, last_updated, tech_tree,
          pulse_laser, auto_turret, plasma_lance, gauss_rifle, photon_torpedo, rocket_launcher,
          ship_hull, kinetic_armor, energy_shield, missile_jammer,
          hull_current, armor_current, shield_current, defense_last_regen
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20
        )`,
        [
          'comprehensive_user', 'hash_comp', 500, 7500, now, '{}',
          1, 0, 2, 0, 3, 1,
          5, 2, 3, 1,
          100.0, 50.0, 75.0, now
        ]
      );

      // Load complete user record
      const result = await db.query(
        'SELECT * FROM users WHERE username = $1',
        ['comprehensive_user']
      );

      expect(result.rows.length).toBe(1);
      const row = result.rows[0];
      
      // Verify all key properties including XP
      expect(row.username).toBe('comprehensive_user');
      expect(row.iron).toBe(500);
      expect(row.xp).toBe(7500);
      expect(row.pulse_laser).toBe(1);
      expect(row.ship_hull).toBe(5);
      expect(row.hull_current).toBe(100.0);
    });
  });

  it('userRow_xpIsInteger_notFloatingPoint', async () => {
    await withTransaction(async () => {
      // Insert user with integer XP
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_integer_xp', 'hash_int', 100, 9999, Math.floor(Date.now() / 1000), '{}']
      );

      // Verify XP is integer type
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_integer_xp']
      );

      const xpValue = result.rows[0].xp;
      expect(Number.isInteger(xpValue)).toBe(true);
      expect(xpValue).toBe(9999);
    });
  });
});
