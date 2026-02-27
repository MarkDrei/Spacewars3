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

describe('TechService - Build Completion XP Rewards', () => {
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

  // Helper to initialize test user with specific XP level
  async function initTestUser(userId: number, initialXp: number = 0) {
    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMye';
    await db.query(`
      INSERT INTO users (
        id, username, password_hash, last_updated, iron, xp,
        tech_tree, pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield,
        build_queue, build_start_sec
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [userId, `testuser_${userId}`, hashedPassword, now, 10000, initialXp, '{}', 1, 0, 1, 0, 5, '[]', null]);
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

  // Helper to get user XP
  async function getUserXp(userId: number): Promise<number> {
    const context = createLockContext();
    const cache = UserCache.getInstance2();
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await cache.getUserByIdWithLock(userContext, userId);
      return user?.xp ?? 0;
    });
  }

  test('processCompletedBuilds_autoTurretCompleted_awards1XP', async () => {
    await withTransaction(async () => {
      // Setup: Auto Turret costs 100 iron -> 100/100 = 1 XP
      const testUserId = 9101;
      await initTestUser(testUserId, 0);

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

      // Assert - User received 1 XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(1);
    });
  });

  test('processCompletedBuilds_pulseLaserCompleted_awards1XP', async () => {
    await withTransaction(async () => {
      // Setup: Pulse Laser costs 150 iron -> 150/100 = 1 XP (Math.floor)
      const testUserId = 9102;
      await initTestUser(testUserId, 0);

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

      // Assert - 150/100 = 1.5 -> Math.floor = 1 XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(1);
    });
  });

  test('processCompletedBuilds_gaussRifleCompleted_awards5XP', async () => {
    await withTransaction(async () => {
      // Setup: Gauss Rifle costs 500 iron -> 500/100 = 5 XP
      const testUserId = 9103;
      await initTestUser(testUserId, 0);

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

      // Assert - 500/100 = 5 XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(5);
    });
  });

  test('processCompletedBuilds_rocketLauncherCompleted_awards35XP', async () => {
    await withTransaction(async () => {
      // Setup: Rocket Launcher costs 3500 iron -> 3500/100 = 35 XP
      const testUserId = 9104;
      await initTestUser(testUserId, 0);

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

      // Assert - 3500/100 = 35 XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(35);
    });
  });

  test('processCompletedBuilds_defenseItemCompleted_awardsXP', async () => {
    await withTransaction(async () => {
      // Setup: Kinetic Armor costs 200 iron -> 200/100 = 2 XP
      const testUserId = 9105;
      await initTestUser(testUserId, 0);

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

      // Assert - 200/100 = 2 XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(2);
    });
  });

  test('processCompletedBuilds_multipleBuilds_accumulatesXP', async () => {
    await withTransaction(async () => {
      // Setup: Multiple items completed
      // Auto Turret (100 iron = 1 XP) + Pulse Laser (150 iron = 1 XP) = 2 XP total
      const testUserId = 9106;
      await initTestUser(testUserId, 0);

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

      // Assert - 1 + 1 = 2 XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(2);
    });
  });

  test('processCompletedBuilds_buildCausesLevelUp_sendsLevelUpNotification', async () => {
    await withTransaction(async () => {
      // Setup: User has 995 XP (level 1), building Auto Turret (1 XP) will reach 996 XP (still level 1)
      // Let's give user 999 XP, so +1 XP will reach 1000 XP = level 2
      const testUserId = 9107;
      await initTestUser(testUserId, 999);

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

      // Assert - Level up notification was sent
      expect(mockCreateMessage).toHaveBeenCalledTimes(2); // Build complete + Level up
      
      // Check for level-up notification
      const calls = mockCreateMessage.mock.calls;
      const levelUpCall = calls.find(call => call[2].includes('Level Up'));
      expect(levelUpCall).toBeDefined();
      expect(levelUpCall![2]).toContain('Level Up');
      expect(levelUpCall![2]).toContain('level 2');
      expect(levelUpCall![2]).toContain('+1 XP');
      expect(levelUpCall![2]).toContain('P:'); // Positive message prefix
      expect(levelUpCall![2]).toContain('🎉'); // Celebration emoji
    });
  });

  test('processCompletedBuilds_buildDoesNotCauseLevelUp_noLevelUpNotification', async () => {
    await withTransaction(async () => {
      // Setup: User has 500 XP, building Auto Turret (1 XP) won't cause level up
      const testUserId = 9108;
      await initTestUser(testUserId, 500);

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

  test('processCompletedBuilds_largeBuildCausesMultipleLevelUps_sendsCorrectLevelUpNotification', async () => {
    await withTransaction(async () => {
      // Setup: User has 0 XP (level 1)
      // Rocket Launcher gives 35 XP, which should reach level 2 (requires 1000 XP)
      // Actually, 35 XP won't cause level up from 0. Let's use a different scenario.
      // User has 3970 XP (just below level 3 at 4000 XP)
      // Build Rocket Launcher (35 XP) -> 4005 XP = Level 3
      const testUserId = 9109;
      await initTestUser(testUserId, 3970);

      const now = Math.floor(Date.now() / 1000);
      const startSec = now - 3600;

      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'rocket_launcher', itemType: 'weapon', completionTime: 0 }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Level up from 2 to 3
      const calls = mockCreateMessage.mock.calls;
      const levelUpCall = calls.find(call => call[2].includes('Level Up'));
      expect(levelUpCall).toBeDefined();
      expect(levelUpCall![2]).toContain('level 3');
      expect(levelUpCall![2]).toContain('+35 XP');

      // Verify final XP
      const finalXp = await getUserXp(testUserId);
      expect(finalXp).toBe(4005);
    });
  });

  test('processCompletedBuilds_xpPersistsAcrossMultipleCalls', async () => {
    await withTransaction(async () => {
      // Setup: User builds multiple items sequentially
      const testUserId = 9110;
      await initTestUser(testUserId, 0);

      const now = Math.floor(Date.now() / 1000);

      // First build: Auto Turret (1 XP)
      const buildQueue1: BuildQueueItem[] = [
        { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
      ];
      await updateBuildQueue(testUserId, buildQueue1, now - 120);

      const context1 = createLockContext();
      await context1.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Check XP after first build
      let currentXp = await getUserXp(testUserId);
      expect(currentXp).toBe(1);

      // Second build: Pulse Laser (1 XP)
      const buildQueue2: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];
      await updateBuildQueue(testUserId, buildQueue2, now - 120);

      const context2 = createLockContext();
      await context2.useLockWithAcquire(USER_LOCK, async (userContext) => {
        await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Check XP after second build
      currentXp = await getUserXp(testUserId);
      expect(currentXp).toBe(2);
    });
  });
});
