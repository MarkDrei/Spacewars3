import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { TechService } from '@/lib/server/techs/TechService';
import { UserCache } from '@/lib/server/user/userCache';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { InventoryService } from '@/lib/server/inventory/InventoryService';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { getDatabase } from '@/lib/server/database';
import { BuildQueueItem } from '@/lib/server/techs/TechFactory';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { withTransaction } from '../../helpers/transactionHelper';

describe('TechService - Build Completion Score Rewards', () => {
  let techService: TechService;
  let mockCreateMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Initialize userCache
    UserCache.resetInstance();
    UserBonusCache.resetInstance();
    await UserCache.intialize2(await getDatabase());
    UserBonusCache.configureDependencies({ userCache: UserCache.getInstance2(), inventoryService: new InventoryService() });
    UserBonusCache.getInstance();
    
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
    UserBonusCache.resetInstance();
    UserCache.resetInstance();
  });

  // Helper to initialize test user
  async function initTestUser(userId: number) {
    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMye';
    await db.query(`
      INSERT INTO users (
        id, username, password_hash, last_updated, iron, xp, score,
        tech_tree, pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield,
        build_queue, build_start_sec
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [userId, `testuser_${userId}`, hashedPassword, now, 10000, 0, 0, '{}', 1, 0, 1, 0, 5, '[]', null]);
  }

  // Helper to update build queue
  async function updateBuildQueue(userId: number, queue: BuildQueueItem[], startSec: number) {
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

  // Helper to get user score
  async function getUserScore(userId: number): Promise<number> {
    const context = createLockContext();
    const cache = UserCache.getInstance2();
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await cache.getUserByIdWithLock(userContext, userId);
      return user?.score ?? 0;
    });
  }

  // Helper to get user XP (should be 0 for builds)
  async function getUserXp(userId: number): Promise<number> {
    const context = createLockContext();
    const cache = UserCache.getInstance2();
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await cache.getUserByIdWithLock(userContext, userId);
      return user?.xp ?? 0;
    });
  }

  test('processCompletedBuilds_autoTurretCompleted_awards1Score', async () => {
    await withTransaction(async () => {
      // Setup: Auto Turret costs 100 iron -> 100/100 = 1 score
      const testUserId = 9101;
      await initTestUser(testUserId);

      // Arrange - Add completed auto_turret (buildDurationMinutes: 1)
      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 120; // Started 2 min ago, so definitely complete

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - User received 1 score (NOT XP)
      const finalScore = await getUserScore(testUserId);
      expect(finalScore).toBe(1);
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(0); // XP unchanged
    });
  });

  test('processCompletedBuilds_pulseLaserCompleted_awards1Score', async () => {
    await withTransaction(async () => {
      // Setup: Pulse Laser costs 150 iron -> 150/100 = 1 score (Math.floor)
      const testUserId = 9102;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 180; // Started 3 min ago

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - 150/100 = 1.5 -> Math.floor = 1 score
      const finalScore = await getUserScore(testUserId);
      expect(finalScore).toBe(1);
    });
  });

  test('processCompletedBuilds_gaussRifleCompleted_awards5Score', async () => {
    await withTransaction(async () => {
      // Setup: Gauss Rifle costs 500 iron -> 500/100 = 5 score
      const testUserId = 9103;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 600; // Started 10 min ago

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'gauss_rifle', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - 500/100 = 5 score
      const finalScore = await getUserScore(testUserId);
      expect(finalScore).toBe(5);
    });
  });

  test('processCompletedBuilds_rocketLauncherCompleted_awards35Score', async () => {
    await withTransaction(async () => {
      // Setup: Rocket Launcher costs 3500 iron -> 3500/100 = 35 score
      const testUserId = 9104;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 3600; // Started 1 hour ago

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'rocket_launcher', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - 3500/100 = 35 score
      const finalScore = await getUserScore(testUserId);
      expect(finalScore).toBe(35);
    });
  });

  test('processCompletedBuilds_defenseItemCompleted_awardsScore', async () => {
    await withTransaction(async () => {
      // Setup: Kinetic Armor costs 200 iron -> 200/100 = 2 score
      const testUserId = 9105;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 600;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'kinetic_armor', itemType: 'defense', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - 200/100 = 2 score
      const finalScore = await getUserScore(testUserId);
      expect(finalScore).toBe(2);
    });
  });

  test('processCompletedBuilds_multipleBuilds_accumulatesScore', async () => {
    await withTransaction(async () => {
      // Setup: Multiple items completed
      // Auto Turret (100 iron = 1 score) + Pulse Laser (150 iron = 1 score) = 2 score total
      const testUserId = 9106;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 600; // All completed

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - 1 + 1 = 2 score
      const finalScore = await getUserScore(testUserId);
      expect(finalScore).toBe(2);
    });
  });

  test('processCompletedBuilds_buildCompleted_noLevelUpNotification', async () => {
    await withTransaction(async () => {
      // Builds no longer award XP so they never cause level-ups
      const testUserId = 9107;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 120;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Only build complete notification, no level-up
      expect(mockCreateMessage).toHaveBeenCalledOnce();
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.anything(),
        testUserId,
        expect.stringContaining('Build complete: Auto Turret')
      );
    });
  });

  test('processCompletedBuilds_scorePersistsAcrossMultipleCalls', async () => {
    await withTransaction(async () => {
      // Setup: User builds multiple items sequentially
      const testUserId = 9110;
      await initTestUser(testUserId);

      const now = Math.floor(Date.now() / 1000);

      // First build: Auto Turret (1 score)
      const buildQueue1: BuildQueueItem[] = [
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];
      await updateBuildQueue(testUserId, buildQueue1, now - 120);

      const context1 = createLockContext();
      await context1.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Check score after first build
      let currentScore = await getUserScore(testUserId);
      expect(currentScore).toBe(1);

      // Second build: Pulse Laser (1 score)
      const buildQueue2: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];
      await updateBuildQueue(testUserId, buildQueue2, now - 120);

      const context2 = createLockContext();
      await context2.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Check score after second build
      currentScore = await getUserScore(testUserId);
      expect(currentScore).toBe(2);
    });
  });
});
