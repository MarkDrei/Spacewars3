import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TechService } from '@/lib/server/techs/TechService';
import { UserCache } from '@/lib/server/user/userCache';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { getDatabase } from '@/lib/server/database';
import { BuildQueueItem } from '@/lib/server/techs/TechFactory';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { withTransaction } from '../../helpers/transactionHelper';

describe('TimeMultiplier - Build Queue Integration', () => {
  let techService: TechService;
  let mockCreateMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset singleton instances
    TimeMultiplierService.resetInstance();
    UserCache.resetInstance();
    await UserCache.intialize2(await getDatabase());
    
    // Initialize MessageCache before TechService
    const ctx = createLockContext();
    MessageCache.resetInstance(ctx);
    await ctx.useLockWithAcquire(DATABASE_LOCK_MESSAGES, async (msgCtx) => {
      await MessageCache.initialize(msgCtx, { persistenceIntervalMs: 60000, enableAutoPersistence: false});
    });

    // Get TechService instance
    techService = TechService.getInstance();

    // Inject test userCache instance
    techService.setUserCacheForTesting(UserCache.getInstance2());

    // Create mock MessageCache and inject it
    mockCreateMessage = vi.fn().mockResolvedValue(1);
    const mockMessageCache: Partial<MessageCache> = {
      createMessage: mockCreateMessage as (context: unknown, userId: number, message: string) => Promise<number>
    };
    techService.setMessageCacheForTesting(mockMessageCache as MessageCache);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    TimeMultiplierService.resetInstance();
    UserCache.resetInstance();
  });

  // Helper to initialize test user
  async function initTestUser(userId: number) {
    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMye';
    await db.query(`
      INSERT INTO users (
        id, username, password_hash, last_updated, iron, xp,
        tech_tree, pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield,
        build_queue, build_start_sec
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [userId, `testuser_${userId}`, hashedPassword, now, 10000, 0, '{}', 1, 0, 1, 0, 5, '[]', null]);
  }

  // Helper to update build queue
  async function updateBuildQueue(userId: number, queue: BuildQueueItem[], startSec: number | null) {
    const context = createLockContext();
    const cache = UserCache.getInstance2();
    await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await cache.getUserByIdWithLock(userContext, userId);
      if (user) {
        user.buildQueue = queue;
        user.buildStartSec = startSec;
        cache.updateUserInCache(userContext, user);
      }
    });
  }

  // Helper to get build queue
  async function getBuildQueue(userId: number): Promise<BuildQueueItem[]> {
    const context = createLockContext();
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const queue = await techService.getBuildQueue(userId, userContext);
      return queue ?? [];
    });
  }

  test('processCompletedBuilds_withMultiplier10_completesIn1TenthTime', async () => {
    await withTransaction(async () => {
      // Setup: Pulse Laser build time is 2 minutes = 120 seconds
      // With 10x multiplier, should complete in 12 seconds of real time
      const testUserId = 9201;
      await initTestUser(testUserId);

      // Set 10x multiplier for 5 minutes
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Add pulse_laser to queue, started 15 seconds ago (should be complete with 10x)
      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 15; // 15 real seconds ago = 150 game seconds with 10x = enough for 120s build

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert
      expect(result.completed.length).toBe(1);
      expect(result.completed[0].itemKey).toBe('pulse_laser');
      expect(result.completed[0].itemType).toBe('weapon');

      // Verify build was removed from queue
      const queueAfter = await getBuildQueue(testUserId);
      expect(queueAfter.length).toBe(0);
    });
  });

  test('processCompletedBuilds_withMultiplier10_doesNotCompleteIfInsufficientTime', async () => {
    await withTransaction(async () => {
      // Setup: Pulse Laser build time is 2 minutes = 120 seconds
      // With 10x multiplier, needs 12 seconds of real time
      const testUserId = 9202;
      await initTestUser(testUserId);

      // Set 10x multiplier for 5 minutes
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Add pulse_laser to queue, started only 5 seconds ago (not enough with 10x)
      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 5; // 5 real seconds ago = 50 game seconds with 10x = NOT enough for 120s build

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build should NOT be complete
      expect(result.completed.length).toBe(0);

      // Verify build is still in queue
      const queueAfter = await getBuildQueue(testUserId);
      expect(queueAfter.length).toBe(1);
      expect(queueAfter[0].itemKey).toBe('pulse_laser');
    });
  });

  test('getBuildQueue_withMultiplier10_returnsAdjustedCompletionTimes', async () => {
    await withTransaction(async () => {
      // Setup: Pulse Laser = 2 min = 120s, Auto Turret = 1 min = 60s
      // With 10x multiplier: Pulse Laser = 12s real time, Auto Turret = 6s real time
      const testUserId = 9203;
      await initTestUser(testUserId);

      // Set 10x multiplier for 5 minutes
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Add two items to queue
      const now = Math.floor(Date.now() / 1000);
      const startSec = now;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const queue = await getBuildQueue(testUserId);

      // Assert - Completion times should reflect 10x acceleration
      expect(queue.length).toBe(2);
      
      // Pulse Laser: 120s / 10 = 12s effective build time
      const pulseLaserCompletion = queue[0].completionTime;
      expect(pulseLaserCompletion).toBe(startSec + 12);
      
      // Auto Turret: starts after pulse laser, 60s / 10 = 6s effective build time
      const autoTurretCompletion = queue[1].completionTime;
      expect(autoTurretCompletion).toBe(startSec + 12 + 6);
      expect(autoTurretCompletion).toBe(startSec + 18);
    });
  });

  test('getBuildQueue_withMultiplier1_returnsNormalCompletionTimes', async () => {
    await withTransaction(async () => {
      // Setup: No multiplier (default = 1)
      const testUserId = 9204;
      await initTestUser(testUserId);

      // Don't set multiplier - should default to 1
      const timeService = TimeMultiplierService.getInstance();
      expect(timeService.getMultiplier()).toBe(1);

      // Arrange - Add two items to queue
      const now = Math.floor(Date.now() / 1000);
      const startSec = now;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const queue = await getBuildQueue(testUserId);

      // Assert - Completion times should be normal (no acceleration)
      expect(queue.length).toBe(2);
      
      // Pulse Laser: 120s (no acceleration)
      expect(queue[0].completionTime).toBe(startSec + 120);
      
      // Auto Turret: starts after pulse laser, 60s
      expect(queue[1].completionTime).toBe(startSec + 120 + 60);
      expect(queue[1].completionTime).toBe(startSec + 180);
    });
  });

  test('processCompletedBuilds_multiplierExpired_usesNormalDuration', async () => {
    await withTransaction(async () => {
      // Setup: Set multiplier then let it expire
      const testUserId = 9205;
      await initTestUser(testUserId);

      // Mock time
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      // Set 10x multiplier for 5 minutes
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);
      expect(timeService.getMultiplier()).toBe(10);

      // Fast-forward time to after expiration (5 minutes + 1ms)
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 5 * 60 * 1000 + 1);
      
      // Verify multiplier expired
      expect(timeService.getMultiplier()).toBe(1);

      // Arrange - Add pulse_laser to queue, started 15 seconds ago
      // With multiplier = 1 (expired), 15 seconds is NOT enough for 120s build
      const nowSec = Math.floor((mockNow + 5 * 60 * 1000 + 1) / 1000);
      const startSec = nowSec - 15;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build should NOT be complete (multiplier expired)
      expect(result.completed.length).toBe(0);

      // Verify build is still in queue
      const queueAfter = await getBuildQueue(testUserId);
      expect(queueAfter.length).toBe(1);
      expect(queueAfter[0].itemKey).toBe('pulse_laser');
    });
  });

  test('processCompletedBuilds_multipleBuildsBothComplete_withMultiplier10', async () => {
    await withTransaction(async () => {
      // Setup: Both builds should complete with enough time
      const testUserId = 9206;
      await initTestUser(testUserId);

      // Set 10x multiplier for 5 minutes
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Add two items, started 30 seconds ago
      // Pulse Laser = 120s / 10 = 12s, Auto Turret = 60s / 10 = 6s
      // Total = 18s needed, 30s elapsed = both complete
      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 30;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Both builds should be complete
      expect(result.completed.length).toBe(2);
      expect(result.completed[0].itemKey).toBe('pulse_laser');
      expect(result.completed[1].itemKey).toBe('auto_turret');

      // Verify queue is empty
      const queueAfter = await getBuildQueue(testUserId);
      expect(queueAfter.length).toBe(0);
    });
  });

  test('processCompletedBuilds_nextBuildStartsFromRealTime', async () => {
    await withTransaction(async () => {
      // Setup: First build completes, second should start from the completion time
      const testUserId = 9207;
      await initTestUser(testUserId);

      // Set 10x multiplier
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Two builds, first complete, second not
      // Pulse Laser = 120s / 10 = 12s real time
      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 15; // 15s ago, enough for first build

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process builds
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Check that second build has correct start time
      const cache = UserCache.getInstance2();
      const user = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await cache.getUserByIdWithLock(userContext, testUserId);
      });

      expect(user).not.toBeNull();
      expect(user!.buildQueue.length).toBe(1);
      expect(user!.buildQueue[0].itemKey).toBe('auto_turret');
      
      // buildStartSec should be set to the calculated completion time of the first build
      // First build: startSec + (120s / 10) = startSec + 12
      const expectedStartTime = startSec + 12;
      expect(user!.buildStartSec).toBe(expectedStartTime);
    });
  });

  test('getBuildQueue_emptyQueue_returnsEmptyArray', async () => {
    await withTransaction(async () => {
      const testUserId = 9208;
      await initTestUser(testUserId);

      // Set multiplier (shouldn't matter for empty queue)
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Empty queue
      await updateBuildQueue(testUserId, [], null);

      // Act
      const queue = await getBuildQueue(testUserId);

      // Assert
      expect(queue.length).toBe(0);
    });
  });

  test('processCompletedBuilds_exactCompletionTime_withMultiplier', async () => {
    await withTransaction(async () => {
      // Edge case: Build completes exactly at the boundary
      const testUserId = 9209;
      await initTestUser(testUserId);

      // Set 10x multiplier
      const timeService = TimeMultiplierService.getInstance();
      timeService.setMultiplier(10, 5);

      // Arrange - Pulse Laser = 120s / 10 = 12s real time needed
      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 12; // Exactly 12 seconds ago

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build should be complete (>= check, not >)
      expect(result.completed.length).toBe(1);
      expect(result.completed[0].itemKey).toBe('pulse_laser');
    });
  });
});
