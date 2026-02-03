import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { UserCache } from '@/lib/server/user/userCache';
import { getDatabase } from '@/lib/server/database';
import { withTransaction } from '../helpers/transactionHelper';
import { createUser } from '@/lib/server/user/userRepo';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';

describe('Build Queue Persistence', () => {
  let userCache: UserCache;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
    userCache = UserCache.getInstance2();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('buildQueue_afterPersistence_isLoadedCorrectly', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      // Create a test user
      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'buildqueuetest', 'password', async () => {});
        userCache.setUserUnsafe(userContext, user);
        return user;
      });

      // Add items to build queue
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, testUser.id);
        expect(user).not.toBeNull();
        expect(user!.buildQueue).toEqual([]);

        // Add two items to build queue
        user!.buildQueue.push({
          itemKey: 'auto_turret',
          itemType: 'weapon',
          completionTime: 0
        });
        user!.buildQueue.push({
          itemKey: 'ship_hull',
          itemType: 'defense',
          completionTime: 0
        });
        user!.buildStartSec = Math.floor(Date.now() / 1000);
        user!.iron = 1000;

        await userCache.updateUserInCache(userContext, user!);
      });

      // In test mode, updateUserInCache persists immediately to DB (within transaction)
      // Verify the data was written correctly by loading directly from DB
      const verifyResult = await db.query(
        'SELECT build_queue, build_start_sec, iron FROM users WHERE id = $1',
        [testUser.id]
      );

      expect(verifyResult.rows).toHaveLength(1);
      const dbRow = verifyResult.rows[0];
      
      // Verify buildQueue was persisted as JSON
      const persistedQueue = JSON.parse(dbRow.build_queue);
      expect(persistedQueue).toHaveLength(2);
      expect(persistedQueue[0].itemKey).toBe('auto_turret');
      expect(persistedQueue[0].itemType).toBe('weapon');
      expect(persistedQueue[1].itemKey).toBe('ship_hull');
      expect(persistedQueue[1].itemType).toBe('defense');
      
      // Verify other fields
      expect(dbRow.build_start_sec).toBeDefined();
      expect(dbRow.iron).toBe(1000);
    });
  });

  it('newUser_hasEmptyBuildQueue', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      // Create a new test user
      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'newusertest', 'password', async () => {});
        userCache.setUserUnsafe(userContext, user);
        return user;
      });

      // Verify new user has empty build queue
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, testUser.id);
        expect(user).not.toBeNull();
        expect(user!.buildQueue).toEqual([]);
        expect(user!.buildStartSec).toBeNull();
      });
    });
  });
});
