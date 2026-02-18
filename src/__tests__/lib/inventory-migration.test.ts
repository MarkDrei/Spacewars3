import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../lib/server/database';
import { migrations, applyInventoryMigration } from '../../lib/server/migrations';

describe('Inventory Migration', () => {

  it('migration_version9_existsInMigrationsList', () => {
    // Arrange & Act
    const inventoryMigration = migrations.find(m => m.version === 9);

    // Assert
    expect(inventoryMigration).toBeDefined();
    expect(inventoryMigration?.name).toBe('add_inventory');
    expect(inventoryMigration?.up).toHaveLength(1);
    expect(inventoryMigration?.down).toHaveLength(1);
  });

  it('migration_upStatement_addsInventoryColumn', () => {
    // Arrange
    const inventoryMigration = migrations.find(m => m.version === 9);

    // Act & Assert
    expect(inventoryMigration?.up[0]).toContain('ALTER TABLE users');
    expect(inventoryMigration?.up[0]).toContain('ADD COLUMN IF NOT EXISTS inventory');
    expect(inventoryMigration?.up[0]).toContain('TEXT DEFAULT NULL');
  });

  it('migration_downStatement_dropsInventoryColumn', () => {
    // Arrange
    const inventoryMigration = migrations.find(m => m.version === 9);

    // Act & Assert
    expect(inventoryMigration?.down[0]).toContain('ALTER TABLE users');
    expect(inventoryMigration?.down[0]).toContain('DROP COLUMN IF EXISTS inventory');
  });

  it('migration_isIdempotent_canBeAppliedMultipleTimes', async () => {
    // Arrange - get database connection
    const db = await getDatabase();
    await applyInventoryMigration(db);

    // Act - apply migration again (should not throw error)
    const applyAgain = async () => {
      await applyInventoryMigration(db);
    };

    // Assert - no error should be thrown
    await expect(applyAgain()).resolves.not.toThrow();
  });

  it('migration_afterApplication_inventoryColumnExists', async () => {
    // Arrange & Act
    const db = await getDatabase();
    await applyInventoryMigration(db);

    // Assert - check that inventory column exists
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'inventory'
      )
    `);
    
    expect(result.rows[0].exists).toBe(true);
  });

  it('migration_inventoryColumn_hasNullDefaultValue', async () => {
    // Arrange
    const db = await getDatabase();
    await applyInventoryMigration(db);

    // Act - check the default value
    const result = await db.query(`
      SELECT column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'inventory'
    `);

    // Assert - TEXT DEFAULT NULL means column_default is NULL
    expect(result.rows[0].column_default).toBe(null);
  });

  it('migration_inventoryColumn_isNullable', async () => {
    // Arrange
    const db = await getDatabase();
    await applyInventoryMigration(db);

    // Act - check if column is nullable
    const result = await db.query(`
      SELECT is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'inventory'
    `);

    // Assert
    expect(result.rows[0].is_nullable).toBe('YES');
  });

  it('migration_inventoryColumn_isTextType', async () => {
    // Arrange
    const db = await getDatabase();
    await applyInventoryMigration(db);

    // Act - check column data type
    const result = await db.query(`
      SELECT data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'inventory'
    `);

    // Assert
    expect(result.rows[0].data_type).toBe('text');
  });

  it('migration_existingUsers_receiveNullInventoryValue', async () => {
    // Arrange
    const db = await getDatabase();
    await applyInventoryMigration(db);

    // Act - check that existing users have inventory = NULL
    const result = await db.query(`
      SELECT id, username, inventory 
      FROM users 
      WHERE id IN (1, 2, 3)
      ORDER BY id
    `);

    // Assert - all seed users should have inventory = NULL
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(row => {
      expect(row.inventory).toBe(null);
    });
  });

  it('migration_newUsers_canBeCreatedWithInventoryValue', async () => {
    // Arrange
    const db = await getDatabase();
    await applyInventoryMigration(db);

    const inventoryData = JSON.stringify([
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null]
    ]);

    // Act - attempt to insert a new user with inventory value
    const insertResult = await db.query(`
      INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, inventory)
      VALUES ('inventory_test_user', 'test_hash', 500, 0, '{}', $1)
      RETURNING id, inventory
    `, [inventoryData]);

    // Assert
    expect(insertResult.rows[0].inventory).toBe(inventoryData);

    // Cleanup
    await db.query('DELETE FROM users WHERE username = $1', ['inventory_test_user']);
  });
});
