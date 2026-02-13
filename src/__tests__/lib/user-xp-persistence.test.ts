import { describe, expect, test, beforeEach } from 'vitest';
import { DatabaseConnection, getDatabase } from '@/lib/server/database';
import { withTransaction } from '../helpers/transactionHelper';
import { createInitialTechTree } from '@/lib/server/techs/techtree';

describe('User XP Persistence (Database Integration)', () => {
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = await getDatabase();
  });

  test('database_storesAndRetrievesXp_correctly', async () => {
    await withTransaction(async () => {
      // Arrange & Act - Create user with specific XP value
      const now = Math.floor(Date.now() / 1000);
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_persist', 'hash', 100, 2500, now, JSON.stringify(createInitialTechTree())]
      );

      // Assert - Load and verify XP persisted correctly
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_xp_persist']
      );
      
      expect(result.rows[0].xp).toBe(2500);
    });
  });

  test('database_xpColumn_defaultsToZero_whenNotSpecified', async () => {
    await withTransaction(async () => {
      // Arrange & Act - Create user without specifying XP
      const now = Math.floor(Date.now() / 1000);
      await db.query(
        `INSERT INTO users (username, password_hash, iron, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5)`,
        ['test_xp_default', 'hash', 100, now, JSON.stringify(createInitialTechTree())]
      );

      // Assert - XP should default to 0
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_xp_default']
      );
      
      expect(result.rows[0].xp).toBe(0);
    });
  });

  test('database_updatesXp_correctly', async () => {
    await withTransaction(async () => {
      // Arrange - Create user with XP = 0
      const now = Math.floor(Date.now() / 1000);
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_update', 'hash', 100, 0, now, JSON.stringify(createInitialTechTree())]
      );

      // Act - Update XP
      await db.query(
        'UPDATE users SET xp = $1 WHERE username = $2',
        [7500, 'test_xp_update']
      );

      // Assert - Verify update persisted
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_xp_update']
      );

      expect(result.rows[0].xp).toBe(7500);
    });
  });

  test('database_multipleXpUpdates_persistsLatestValue', async () => {
    await withTransaction(async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_multi', 'hash', 100, 0, now, JSON.stringify(createInitialTechTree())]
      );

      // Act - Multiple updates
      await db.query(
        'UPDATE users SET xp = $1 WHERE username = $2',
        [1000, 'test_xp_multi']
      );
      
      await db.query(
        'UPDATE users SET xp = $1 WHERE username = $2',
        [2000, 'test_xp_multi']
      );
      
      await db.query(
        'UPDATE users SET xp = $1 WHERE username = $2',
        [3500, 'test_xp_multi']
      );

      // Assert - Latest value persisted
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_xp_multi']
      );

      expect(result.rows[0].xp).toBe(3500);
    });
  });

  test('database_xpUpdate_preservesOtherColumns', async () => {
    await withTransaction(async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_preserve', 'hash', 500, 0, now, JSON.stringify(createInitialTechTree())]
      );

      // Act - Update only XP
      await db.query(
        'UPDATE users SET xp = $1 WHERE username = $2',
        [5000, 'test_xp_preserve']
      );

      // Assert - XP updated, other columns unchanged
      const result = await db.query(
        'SELECT xp, iron, username FROM users WHERE username = $1',
        ['test_xp_preserve']
      );

      expect(result.rows[0].xp).toBe(5000);
      expect(result.rows[0].iron).toBe(500); // Unchanged
      expect(result.rows[0].username).toBe('test_xp_preserve'); // Unchanged
    });
  });

  test('database_largeXpValue_persistsCorrectly', async () => {
    await withTransaction(async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const largeXp = 999999999;
      
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_large', 'hash', 100, largeXp, now, JSON.stringify(createInitialTechTree())]
      );

      // Assert - Large value persisted
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_xp_large']
      );

      expect(result.rows[0].xp).toBe(largeXp);
    });
  });

  test('database_xpIncrement_worksCorrectly', async () => {
    await withTransaction(async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      await db.query(
        `INSERT INTO users (username, password_hash, iron, xp, last_updated, tech_tree)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test_xp_increment', 'hash', 100, 1000, now, JSON.stringify(createInitialTechTree())]
      );

      // Act - Increment XP
      await db.query(
        'UPDATE users SET xp = xp + $1 WHERE username = $2',
        [500, 'test_xp_increment']
      );

      // Assert - XP incremented correctly
      const result = await db.query(
        'SELECT xp FROM users WHERE username = $1',
        ['test_xp_increment']
      );

      expect(result.rows[0].xp).toBe(1500);
    });
  });
});
