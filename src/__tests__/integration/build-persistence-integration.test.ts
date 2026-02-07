import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { UserCache } from '@/lib/server/user/userCache';
import { TechService } from '@/lib/server/techs/TechService';
import { getDatabase } from '@/lib/server/database';
import { withTransaction } from '../helpers/transactionHelper';
import { createUser } from '@/lib/server/user/userRepo';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';

/**
 * Integration test to verify that completed builds persist tech_counts correctly
 * This reproduces the issue: build completes, auto_turret increases 5->6, 
 * but after restart it's back to 5
 */
describe('Build Persistence Integration', () => {
  let userCache: UserCache;
  let techService: TechService;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
    userCache = UserCache.getInstance2();
    techService = TechService.getInstance();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('completedBuild_techCountsIncreased_persistsToDatabase', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      // Create test user with iron for building
      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'buildpersisttest', 'password', async () => {});
        user.techTree.inventoryCapacity = 4; // Increase capacity to 40000 to hold 10000 iron
        user.iron = 10000; // Enough for builds
        userCache.setUserUnsafe(userContext, user);
        await userCache.updateUserInCache(userContext, user);
        return user;
      });

      // Verify initial tech counts
      /* const initialCounts = */ await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, testUser.id);
        expect(user).not.toBeNull();
        expect(user!.techCounts.auto_turret).toBe(5); // Default from seed
        return { ...user!.techCounts };
      });

      // Add build to queue
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.addTechItemToBuildQueue(testUser.id, 'auto_turret', 'weapon', userContext);
      });

      // Simulate build completion by setting start time in the past
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, testUser.id);
        expect(user).not.toBeNull();
        // Set start time to 10 minutes ago (auto_turret build takes 1 minute)
        user!.buildStartSec = Math.floor(Date.now() / 1000) - 600;
        await userCache.updateUserInCache(userContext, user!);
      });

      // Process completed builds
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const result = await techService.processCompletedBuilds(testUser.id, userContext);
        expect(result.completed).toHaveLength(1);
        expect(result.completed[0].itemKey).toBe('auto_turret');
      });

      // Verify tech counts increased in memory
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, testUser.id);
        expect(user).not.toBeNull();
        expect(user!.techCounts.auto_turret).toBe(6); // Should be 5 + 1
      });

      // CRITICAL: Verify persistence to database
      // In test mode, updateUserInCache persists immediately
      const dbResult = await db.query(
        'SELECT auto_turret FROM users WHERE id = $1',
        [testUser.id]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].auto_turret).toBe(6); // ← THIS IS THE KEY TEST!

      // Also verify build_queue is empty
      const queueResult = await db.query(
        'SELECT build_queue FROM users WHERE id = $1',
        [testUser.id]
      );
      const persistedQueue = JSON.parse(queueResult.rows[0].build_queue);
      expect(persistedQueue).toHaveLength(0);
    });
  });

  it('multipleBuildCompletions_allTechCountsUpdate_persistCorrectly', async () => {
    await withTransaction(async () => {
      const db = await getDatabase();
      const ctx = createLockContext();

      // Create test user
      const testUser = await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await createUser(db, 'multibuiltest', 'password', async () => {});
        user.techTree.inventoryCapacity = 6; // Increase capacity to 160000 to hold 50000 iron
        user.iron = 50000;
        userCache.setUserUnsafe(userContext, user);
        await userCache.updateUserInCache(userContext, user);
        return user;
      });

      // Manually add 3 completed builds directly to simulate completed state
      await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, testUser.id);
        
        // Manually increment tech counts (simulating completed builds)
        user!.techCounts.auto_turret++;
        user!.techCounts.pulse_laser++;  
        user!.techCounts.ship_hull++;
        user!.iron -= 450; // Cost of 3 builds (100 + 150 + 150)
        
        await userCache.updateUserInCache(userContext, user!);
      });

      // Verify all tech counts in database
      const dbResult = await db.query(
        'SELECT auto_turret, pulse_laser, ship_hull, iron FROM users WHERE id = $1',
        [testUser.id]
      );

      expect(dbResult.rows[0].auto_turret).toBe(6); // 5 + 1
      expect(dbResult.rows[0].pulse_laser).toBe(6); // 5 + 1
      expect(dbResult.rows[0].ship_hull).toBe(6); // 5 + 1
      expect(dbResult.rows[0].iron).toBe(49550); // 50000 - 450
    });
  });
});
