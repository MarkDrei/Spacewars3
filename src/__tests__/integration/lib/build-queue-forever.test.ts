import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { UserCache } from '@/lib/server/user/userCache';
import { TechService } from '@/lib/server/techs/TechService';
import { getDatabase } from '@/lib/server/database';
import { createUser } from '@/lib/server/user/userRepo';
import { withTransaction } from '../../helpers/transactionHelper';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';

describe('Build Queue Forever', () => {
  let userCache: UserCache;
  let techService: TechService;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
    userCache = UserCache.getInstance2();
    techService = TechService.getInstance();
    techService.setUserCacheForTesting(userCache);
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('addTechItemToBuildQueue_normalAfterRecurring_removesRecurringEntryFirst', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'foreverreplace', 'password', async () => {});
        user.techTree.ironCapacity = 5;
        user.iron = 1000;
        userCache.setUserUnsafe(userContext, user);
        await userCache.updateUserInCache(userContext, user);
        return user;
      });

      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.addTechItemToBuildQueue(testUser.id, 'auto_turret', 'weapon', userContext, { isRecurring: true });
        await techService.addTechItemToBuildQueue(testUser.id, 'ship_hull', 'defense', userContext);
      });

      const dbResult = await db.query('SELECT build_queue FROM users WHERE id = $1', [testUser.id]);
      const persistedQueue = JSON.parse(dbResult.rows[0].build_queue);
      expect(persistedQueue).toHaveLength(1);
      expect(persistedQueue[0].itemKey).toBe('ship_hull');
      expect(persistedQueue[0].isRecurring).toBeFalsy();
    });
  });

  it('processCompletedBuilds_recurringBuild_restartsSameItemWhenIronIsAvailable', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'foreverrestart', 'password', async () => {});
        user.techTree.ironCapacity = 5;
        user.iron = 250;
        user.buildQueue = [{ itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0, isRecurring: true }];
        user.buildStartSec = Math.floor(Date.now() / 1000) - 70;
        userCache.setUserUnsafe(userContext, user);
        await userCache.updateUserInCache(userContext, user);
        return user;
      });

      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const result = await techService.processCompletedBuilds(testUser.id, userContext);
        expect(result.completed).toHaveLength(1);
      });

      const dbResult = await db.query(
        'SELECT auto_turret, iron, build_queue, build_start_sec FROM users WHERE id = $1',
        [testUser.id]
      );
      const persistedQueue = JSON.parse(dbResult.rows[0].build_queue);
      expect(persistedQueue).toHaveLength(1);
      expect(persistedQueue[0].itemKey).toBe('auto_turret');
      expect(persistedQueue[0].isRecurring).toBe(true);
      expect(dbResult.rows[0].build_start_sec).not.toBeNull();
      expect(dbResult.rows[0].iron).toBe(150);
      expect(dbResult.rows[0].auto_turret).toBe(6);
    });
  });

  it('abortBuildQueue_nonEmptyQueue_clearsAllQueuedItems', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'foreverabort', 'password', async () => {});
        user.techTree.ironCapacity = 5;
        user.iron = 1000;
        user.buildQueue = [
          { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 },
          { itemKey: 'ship_hull', itemType: 'defense', completionTime: 0, isRecurring: true }
        ];
        user.buildStartSec = Math.floor(Date.now() / 1000);
        userCache.setUserUnsafe(userContext, user);
        await userCache.updateUserInCache(userContext, user);
        return user;
      });

      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const result = await techService.abortBuildQueue(testUser.id, userContext);
        expect(result.abortedCount).toBe(2);
      });

      const dbResult = await db.query('SELECT build_queue, build_start_sec FROM users WHERE id = $1', [testUser.id]);
      expect(JSON.parse(dbResult.rows[0].build_queue)).toEqual([]);
      expect(dbResult.rows[0].build_start_sec).toBeNull();
    });
  });
});
