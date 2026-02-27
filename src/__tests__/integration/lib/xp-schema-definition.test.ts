import { describe, it, expect } from 'vitest';
import { CREATE_USERS_TABLE } from '../../../lib/server/schema';
import { getDatabase } from '../../../lib/server/database';

describe('XP Schema Definition', () => {

  it('createUsersTable_includesXpColumn', () => {
    // Arrange & Act - check that CREATE_USERS_TABLE SQL includes xp column
    const sql = CREATE_USERS_TABLE;

    // Assert
    expect(sql).toContain('xp');
    expect(sql).toContain('INTEGER NOT NULL DEFAULT 0');
  });

  it('createUsersTable_xpColumn_hasCorrectDefinition', () => {
    // Arrange & Act - parse the SQL to verify exact definition
    const sql = CREATE_USERS_TABLE;
    
    // Assert - should match the format: xp INTEGER NOT NULL DEFAULT 0,
    const xpColumnPattern = /xp\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i;
    expect(sql).toMatch(xpColumnPattern);
  });

  it('createUsersTable_xpColumn_positionedAfterIron', () => {
    // Arrange & Act - verify column ordering
    const sql = CREATE_USERS_TABLE;
    
    // Assert - xp should come after iron in the schema
    const ironIndex = sql.indexOf('iron DOUBLE PRECISION');
    const xpIndex = sql.indexOf('xp INTEGER');
    
    expect(xpIndex).toBeGreaterThan(ironIndex);
    expect(xpIndex).toBeGreaterThan(0); // xp column exists
    expect(ironIndex).toBeGreaterThan(0); // iron column exists
  });

  it('freshDatabase_withSchemaDefinition_createsXpColumn', async () => {
    // Arrange - use existing database (initialized with CREATE_TABLES)
    const db = await getDatabase();

    // Act - query the xp column from information_schema
    const result = await db.query(`
      SELECT 
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'xp'
    `);

    // Assert - column should exist with correct properties
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].column_name).toBe('xp');
    expect(result.rows[0].data_type).toBe('integer');
    expect(result.rows[0].column_default).toBe('0');
    expect(result.rows[0].is_nullable).toBe('NO');
  });

  it('freshDatabase_newUser_defaultsToZeroXp', async () => {
    // Arrange
    const db = await getDatabase();
    const testUsername = 'xp_schema_test_user';

    // Act - create a new user without specifying xp
    const insertResult = await db.query(`
      INSERT INTO users (username, password_hash, iron, last_updated, tech_tree)
      VALUES ($1, 'test_hash', 0, 0, '{}')
      RETURNING id, xp
    `, [testUsername]);

    // Assert - xp should default to 0
    expect(insertResult.rows[0].xp).toBe(0);

    // Cleanup
    await db.query('DELETE FROM users WHERE username = $1', [testUsername]);
  });

  it('freshDatabase_newUser_canSpecifyXpValue', async () => {
    // Arrange
    const db = await getDatabase();
    const testUsername = 'xp_schema_test_user_with_xp';
    const xpValue = 5000;

    // Act - create a new user with explicit xp value
    const insertResult = await db.query(`
      INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, xp)
      VALUES ($1, 'test_hash', 0, 0, '{}', $2)
      RETURNING id, xp
    `, [testUsername, xpValue]);

    // Assert - xp should match the specified value
    expect(insertResult.rows[0].xp).toBe(xpValue);

    // Cleanup
    await db.query('DELETE FROM users WHERE username = $1', [testUsername]);
  });

  it('schemaDefinition_xpColumn_matchesMigrationDefinition', () => {
    // Arrange - the migration and schema should be consistent
    const schemaSql = CREATE_USERS_TABLE;
    
    // Act - extract xp column definition from schema
    const xpInSchema = schemaSql.includes('xp INTEGER NOT NULL DEFAULT 0');
    
    // Assert - schema definition should match migration
    // Migration uses: ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0
    // Schema should use: xp INTEGER NOT NULL DEFAULT 0,
    expect(xpInSchema).toBe(true);
  });
});
