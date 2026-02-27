import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../../lib/server/database';
import { applyXpSystemMigration, migrations } from '../../../lib/server/migrations';

describe('XP System Migration', () => {

  it('migration_version8_existsInMigrationsList', () => {
    // Arrange & Act
    const xpMigration = migrations.find(m => m.version === 8);

    // Assert
    expect(xpMigration).toBeDefined();
    expect(xpMigration?.name).toBe('add_xp_system');
    expect(xpMigration?.up).toHaveLength(1);
    expect(xpMigration?.down).toHaveLength(1);
  });

  it('migration_upStatement_addsXpColumn', () => {
    // Arrange
    const xpMigration = migrations.find(m => m.version === 8);

    // Act & Assert
    expect(xpMigration?.up[0]).toContain('ALTER TABLE users');
    expect(xpMigration?.up[0]).toContain('ADD COLUMN IF NOT EXISTS xp');
    expect(xpMigration?.up[0]).toContain('INTEGER NOT NULL DEFAULT 0');
  });

  it('migration_downStatement_dropsXpColumn', () => {
    // Arrange
    const xpMigration = migrations.find(m => m.version === 8);

    // Act & Assert
    expect(xpMigration?.down[0]).toContain('ALTER TABLE users');
    expect(xpMigration?.down[0]).toContain('DROP COLUMN IF EXISTS xp');
  });

  it('migration_isIdempotent_canBeAppliedMultipleTimes', async () => {
    // Arrange - get database connection
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Act - apply migration again (should not throw error)
    const applyAgain = async () => {
      await applyXpSystemMigration(db);
    };

    // Assert - no error should be thrown
    await expect(applyAgain()).resolves.not.toThrow();
  });

  it('migration_afterApplication_xpColumnExists', async () => {
    // Arrange & Act
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Assert - check that xp column exists
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'xp'
      )
    `);
    
    expect(result.rows[0].exists).toBe(true);
  });

  it('migration_xpColumn_hasCorrectDefaultValue', async () => {
    // Arrange
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Act - check the default value
    const result = await db.query(`
      SELECT column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'xp'
    `);

    // Assert
    expect(result.rows[0].column_default).toBe('0');
  });

  it('migration_xpColumn_isNotNullable', async () => {
    // Arrange
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Act - check if column is NOT NULL
    const result = await db.query(`
      SELECT is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'xp'
    `);

    // Assert
    expect(result.rows[0].is_nullable).toBe('NO');
  });

  it('migration_xpColumn_isIntegerType', async () => {
    // Arrange
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Act - check column data type
    const result = await db.query(`
      SELECT data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'xp'
    `);

    // Assert
    expect(result.rows[0].data_type).toBe('integer');
  });

  it('migration_existingUsers_receiveDefaultXpValue', async () => {
    // Arrange
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Act - check that existing users have xp = 0
    const result = await db.query(`
      SELECT id, username, xp 
      FROM users 
      WHERE id IN (1, 2, 3)
      ORDER BY id
    `);

    // Assert - all seed users should have XP = 0
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(row => {
      expect(row.xp).toBe(0);
    });
  });

  it('migration_newUsers_canBeCreatedWithXpValue', async () => {
    // Arrange
    const db = await getDatabase();
    await applyXpSystemMigration(db);

    // Act - attempt to insert a new user with XP value
    const insertResult = await db.query(`
      INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, xp)
      VALUES ('xp_test_user', 'test_hash', 500, 0, '{}', 1000)
      RETURNING id, xp
    `);

    // Assert
    expect(insertResult.rows[0].xp).toBe(1000);

    // Cleanup
    await db.query('DELETE FROM users WHERE username = $1', ['xp_test_user']);
  });
});
