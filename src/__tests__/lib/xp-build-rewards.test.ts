import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { TechService } from '@/lib/server/techs/TechService';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, DATABASE_LOCK_MESSAGES } from '@/lib/server/typedLocks';
import { getDatabase } from '@/lib/server/database';
import { BuildQueueItem, TechFactory } from '@/lib/server/techs/TechFactory';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { withTransaction } from '../helpers/transactionHelper';

describe('TechService - XP Rewards for Build Completion', () => {
  let techService: TechService;
  let mockCreateMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Initialize userCache (will use getDatabase() internally)
    UserCache.resetInstance();
    await UserCache.intialize2(await getDatabase());
    
    // Initialize MessageCache before TechService (TechService constructor tries to get MessageCache)
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
    // Properly close the database connection
    UserCache.resetInstance();
  });

  // Helper to initialize test user within transaction
  async function initTestUser(userId: number, initialXp: number = 0) {
    const db = await getDatabase();
    const now = Math.floor(Date.now() / 1000);
    // Use a precomputed bcrypt hash for 'a' (from bcryptMock.ts)
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMye';
    // INSERT test user in transaction with XP
    await db.query(`
      INSERT INTO users (
        id, username, password_hash, last_updated, iron, xp,
        tech_tree, pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield,
        build_queue, build_start_sec
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [userId, `testuser_${userId}`, hashedPassword, now, 10000, initialXp, '{}', 1, 0, 1, 0, 5, '[]', null]);
  }

  // Helper to update build queue directly via userCache
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

  test('buildCompletion_awardsXpBasedOnCost', async () => {
    await withTransaction(async () => {
      // Setup: Create test user with 0 XP
      const testUserId = 9001;
      await initTestUser(testUserId, 0);

      // Arrange - Add a completed weapon to build queue
      // Pulse Laser cost is 150 iron, so XP should be floor(150/100) = 1
      const pulseLaserSpec = TechFactory.getWeaponSpec('pulse_laser');
      expect(pulseLaserSpec).toBeTruthy();
      expect(pulseLaserSpec!.baseCost).toBe(150);

      const now = Math.floor(Date.now() / 1000);
      const duration = pulseLaserSpec!.buildDurationMinutes * 60; // 2 minutes = 120 seconds
      const completedTime = now - 10; // Completed 10 seconds ago
      const startSec = completedTime - duration;

      const buildQueue: BuildQueueItem[] = [
        {
          itemKey: 'pulse_laser',
          itemType: 'weapon',
          completionTime: 0 // Ignored by service, calculated dynamically
        }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build was processed
      expect(result.completed).toHaveLength(1);
      expect(result.completed[0].itemKey).toBe('pulse_laser');

      // Assert - XP was awarded correctly
      const xpAfter = await getUserXp(testUserId);
      const expectedXp = Math.floor(pulseLaserSpec!.baseCost / 100); // floor(150/100) = 1
      expect(xpAfter).toBe(expectedXp);
    });
  });

  test('buildCompletion_levelUp_sendsNotification', async () => {
    await withTransaction(async () => {
      // Setup: Create test user with XP close to level 2 (999 XP, needs 1 more for level 2)
      const testUserId = 9002;
      await initTestUser(testUserId, 999);

      // Arrange - Add completed weapon that gives 1+ XP to trigger level up
      // Pulse Laser gives floor(150/100) = 1 XP, bringing total to 1000 = Level 2
      const now = Math.floor(Date.now() / 1000);
      const pulseLaserSpec = TechFactory.getWeaponSpec('pulse_laser');
      const duration = pulseLaserSpec!.buildDurationMinutes * 60;
      const completedTime = now - 10;
      const startSec = completedTime - duration;

      const buildQueue: BuildQueueItem[] = [
        {
          itemKey: 'pulse_laser',
          itemType: 'weapon',
          completionTime: 0
        }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build was processed
      expect(result.completed).toHaveLength(1);

      // Assert - Two notifications were sent: build complete + level up
      expect(mockCreateMessage).toHaveBeenCalledTimes(2);
      
      // First notification: Build complete
      expect(mockCreateMessage).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        testUserId,
        expect.stringContaining('Build complete: Pulse Laser')
      );

      // Second notification: Level up with P: prefix
      expect(mockCreateMessage).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        testUserId,
        expect.stringMatching(/P: 🎉 Level Up! You reached level 2! \(\+1 XP from build\)/)
      );

      // Assert - User is now level 2
      const context2 = createLockContext();
      const finalLevel = await context2.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await UserCache.getInstance2().getUserByIdWithLock(userContext, testUserId);
        return user?.getLevel() ?? 0;
      });
      expect(finalLevel).toBe(2);
    });
  });

  test('buildCompletion_noLevelUp_noLevelUpNotification', async () => {
    await withTransaction(async () => {
      // Setup: Create test user with 500 XP (not near level up)
      const testUserId = 9003;
      await initTestUser(testUserId, 500);

      // Arrange - Add completed weapon
      const now = Math.floor(Date.now() / 1000);
      const pulseLaserSpec = TechFactory.getWeaponSpec('pulse_laser');
      const duration = pulseLaserSpec!.buildDurationMinutes * 60;
      const completedTime = now - 10;
      const startSec = completedTime - duration;

      const buildQueue: BuildQueueItem[] = [
        {
          itemKey: 'pulse_laser',
          itemType: 'weapon',
          completionTime: 0
        }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build was processed
      expect(result.completed).toHaveLength(1);

      // Assert - Only one notification was sent: build complete (no level up)
      expect(mockCreateMessage).toHaveBeenCalledOnce();
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.anything(),
        testUserId,
        expect.stringContaining('Build complete: Pulse Laser')
      );

      // Verify no level up notification was sent
      expect(mockCreateMessage).not.toHaveBeenCalledWith(
        expect.anything(),
        testUserId,
        expect.stringContaining('Level Up')
      );

      // Assert - XP increased but still level 1
      const xpAfter = await getUserXp(testUserId);
      expect(xpAfter).toBe(501); // 500 + 1 XP from build
    });
  });

  test('multipleBuildCompletions_accumulateXp', async () => {
    await withTransaction(async () => {
      // Setup: Create test user with 0 XP
      const testUserId = 9004;
      await initTestUser(testUserId, 0);

      // Arrange - Add multiple completed weapons to build queue
      const now = Math.floor(Date.now() / 1000);
      const pulseLaserSpec = TechFactory.getWeaponSpec('pulse_laser');
      const duration = pulseLaserSpec!.buildDurationMinutes * 60;
      
      // Three pulse lasers, each completed
      const buildQueue: BuildQueueItem[] = [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
      ];

      // Start time such that all three are completed
      const firstCompletionTime = now - 10;
      const startSec = firstCompletionTime - (duration * 3) - 10;

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - All three builds were processed
      expect(result.completed).toHaveLength(3);

      // Assert - XP accumulated correctly
      const xpAfter = await getUserXp(testUserId);
      const expectedXp = Math.floor(pulseLaserSpec!.baseCost / 100) * 3; // 1 XP * 3 = 3 XP
      expect(xpAfter).toBe(expectedXp);

      // Assert - Multiple build complete notifications sent (3 builds)
      expect(mockCreateMessage).toHaveBeenCalledTimes(3);
    });
  });

  test('buildCompletion_expensiveDefenseItem_awardsMoreXp', async () => {
    await withTransaction(async () => {
      // Setup: Create test user with 0 XP
      const testUserId = 9005;
      await initTestUser(testUserId, 0);

      // Arrange - Add completed defense item (more expensive = more XP)
      // Energy Shield cost is 800 iron, so XP should be floor(800/100) = 8
      const energyShieldSpec = TechFactory.getDefenseSpec('energy_shield');
      expect(energyShieldSpec).toBeTruthy();
      expect(energyShieldSpec!.baseCost).toBe(800);

      const now = Math.floor(Date.now() / 1000);
      const duration = energyShieldSpec!.buildDurationMinutes * 60;
      const completedTime = now - 10;
      const startSec = completedTime - duration;

      const buildQueue: BuildQueueItem[] = [
        {
          itemKey: 'energy_shield',
          itemType: 'defense',
          completionTime: 0
        }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - Build was processed
      expect(result.completed).toHaveLength(1);

      // Assert - XP was awarded correctly for expensive item
      const xpAfter = await getUserXp(testUserId);
      const expectedXp = Math.floor(energyShieldSpec!.baseCost / 100); // floor(800/100) = 8
      expect(xpAfter).toBe(expectedXp);
    });
  });

  test('buildCompletion_multipleLevelUps_sendsMultipleNotifications', async () => {
    await withTransaction(async () => {
      // Setup: Create test user with XP at 0
      const testUserId = 9006;
      await initTestUser(testUserId, 0);

      // Arrange - Add multiple expensive builds to trigger multiple level ups
      // Use Ship Hull (baseCost 1000, gives 10 XP each)
      // 100 ship hulls * 10 XP = 1000 XP total (enough for level 2)
      const shipHullSpec = TechFactory.getDefenseSpec('ship_hull');
      expect(shipHullSpec).toBeTruthy();
      expect(shipHullSpec!.baseCost).toBe(1000);
      
      const now = Math.floor(Date.now() / 1000);
      const duration = shipHullSpec!.buildDurationMinutes * 60;
      
      // Create 100 completed ship hulls
      const buildQueue: BuildQueueItem[] = Array.from({ length: 100 }, () => ({
        itemKey: 'ship_hull',
        itemType: 'defense' as const,
        completionTime: 0
      }));

      // Start time such that all are completed
      const firstCompletionTime = now - 10;
      const startSec = firstCompletionTime - (duration * 100) - 10;

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act - Process completed builds
      const context = createLockContext();
      const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert - All builds were processed
      expect(result.completed).toHaveLength(100);

      // Assert - User reached level 2 (1000 XP = level 2)
      const xpAfter = await getUserXp(testUserId);
      expect(xpAfter).toBe(1000);

      const context2 = createLockContext();
      const finalLevel = await context2.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await UserCache.getInstance2().getUserByIdWithLock(userContext, testUserId);
        return user?.getLevel() ?? 0;
      });
      expect(finalLevel).toBe(2);

      // Assert - Level up notification was sent (exactly once when crossing threshold)
      const levelUpCalls = mockCreateMessage.mock.calls.filter(call => 
        call[2].includes('Level Up')
      );
      expect(levelUpCalls.length).toBe(1);
      expect(levelUpCalls[0][2]).toContain('Level Up! You reached level 2!');
    });
  });

  test('buildCompletion_xpFormulaCorrect', async () => {
    await withTransaction(async () => {
      // Test that XP formula is exactly: floor(baseCost / 100)
      const testUserId = 9007;
      await initTestUser(testUserId, 0);

      // Test with Auto Turret (baseCost 350, expected XP = floor(350/100) = 3)
      const autoTurretSpec = TechFactory.getWeaponSpec('auto_turret');
      expect(autoTurretSpec).toBeTruthy();
      expect(autoTurretSpec!.baseCost).toBe(350);

      const now = Math.floor(Date.now() / 1000);
      const duration = autoTurretSpec!.buildDurationMinutes * 60;
      const completedTime = now - 10;
      const startSec = completedTime - duration;

      const buildQueue: BuildQueueItem[] = [
        {
          itemKey: 'auto_turret',
          itemType: 'weapon',
          completionTime: 0
        }
      ];

      await updateBuildQueue(testUserId, buildQueue, startSec);

      // Act
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        return await techService.processCompletedBuilds(testUserId, userContext);
      });

      // Assert
      const xpAfter = await getUserXp(testUserId);
      const expectedXp = Math.floor(autoTurretSpec!.baseCost / 100); // floor(350/100) = 3
      expect(xpAfter).toBe(expectedXp);
    });
  });
});
