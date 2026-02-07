// ---
// XP Schema and Migration Tests
// Validates that XP column is properly added to users table and persists correctly
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { getDatabase } from '@/lib/server/database';

describe('XP Schema and Migration', () => {
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('migration_version8_addsXpColumn', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Verify XP column exists by querying schema (migrations applied automatically during initialization)
      const result = await db.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'xp'
      `);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('xp');
      expect(result.rows[0].data_type).toBe('integer');
      expect(result.rows[0].column_default).toBe('0');
      expect(result.rows[0].is_nullable).toBe('NO');
    });
  });

  it('userRow_newUser_hasXpDefaultZero', async () => {
    await withTransaction(async () => {
      const emptyCtx = createLockContext();
      const userCache = UserCache.getInstance2();
      
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        // Get a test user (created by test server initialization)
        const user = await userCache.getUserByUsername(userCtx, 'a');
        
        expect(user).not.toBeNull();
        expect(user!.xp).toBeDefined();
        expect(user!.xp).toBe(0);
      });
    });
  });

  it('userRow_xpValue_persistsCorrectly', async () => {
    await withTransaction(async () => {
      const emptyCtx = createLockContext();
      const userCache = UserCache.getInstance2();
      let userId: number;
      
      // Phase 1: Set XP value
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await userCache.getUserByUsername(userCtx, 'a');
        expect(user).not.toBeNull();
        
        userId = user!.id;
        user!.xp = 5000;
        
        await userCache.updateUserInCache(userCtx, user!);
      });
      
      // Phase 2: Flush to database
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        await userCache.flushAllToDatabaseWithLock(userCtx);
      });
      
      // Phase 3: Clear cache and reload from database
      UserCache.resetInstance();
      await initializeIntegrationTestServer(); // Re-initialize cache
      const freshUserCache = UserCache.getInstance2();
      
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const reloadedUser = await freshUserCache.getUserByIdWithLock(userCtx, userId!);
        
        expect(reloadedUser).not.toBeNull();
        expect(reloadedUser!.xp).toBe(5000);
      });
    });
  });

  it('userRow_xpUpdate_multipleValues_persistCorrectly', async () => {
    await withTransaction(async () => {
      const emptyCtx = createLockContext();
      const userCache = UserCache.getInstance2();
      
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await userCache.getUserByUsername(userCtx, 'a');
        expect(user).not.toBeNull();
        
        // Test various XP values
        const testValues = [0, 1, 100, 1000, 10000, 99999];
        
        for (const xpValue of testValues) {
          user!.xp = xpValue;
          await userCache.updateUserInCache(userCtx, user!);
          await userCache.flushAllToDatabaseWithLock(userCtx);
          
          // Reload from database directly
          const db = await getDatabase();
          const result = await db.query('SELECT xp FROM users WHERE id = $1', [user!.id]);
          
          expect(result.rows).toHaveLength(1);
          expect(result.rows[0].xp).toBe(xpValue);
        }
      });
    });
  });

  it('schema_createUsersTable_includesXpColumn', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      
      // Query the schema to verify XP column is in the CREATE TABLE definition
      const result = await db.query(`
        SELECT column_name, ordinal_position
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      const columnNames = result.rows.map((row) => row.column_name);
      expect(columnNames).toContain('xp');
      
      // Verify XP comes after iron (as per schema definition)
      const ironIndex = columnNames.indexOf('iron');
      const xpIndex = columnNames.indexOf('xp');
      expect(xpIndex).toBeGreaterThan(ironIndex);
    });
  });
});
