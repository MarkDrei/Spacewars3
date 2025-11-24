import { describe, test, expect, beforeEach, vi, afterEach, MockedFunction } from 'vitest';
import { TechService } from '@/lib/server/techs/TechService';
import { createTestDatabase } from '../helpers/testDatabase';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import sqlite3 from 'sqlite3';
import { BuildQueueItem } from '@/lib/server/techs/TechFactory';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';

describe('TechService - Build Completion Notifications', () => {
  let testDb: sqlite3.Database;
  let techService: TechService;
  let mockCreateMessage: MockedFunction<(userId: number, messageText: string) => Promise<number>>;
  const testUserId = 1;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
    // Create test database
    testDb = await createTestDatabase();

    // Initialize userCache with test database
    UserCache.resetInstance();
    await UserCache.intialize2({ db: testDb });

    // Get TechService instance
    techService = TechService.getInstance();

    // Inject test userCache instance
    techService.setUserCacheForTesting(UserCache.getInstance2());

    // Create mock MessageCache and inject it
    mockCreateMessage = vi.fn<(userId: number, messageText: string) => Promise<number>>().mockResolvedValue(1);
    const mockMessageCache: Partial<MessageCache> = {
      createMessage: mockCreateMessage
    };
    techService.setMessageCacheForTesting(mockMessageCache as MessageCache);

    // Clear all mocks
    vi.clearAllMocks();

    // Set up test user with initial tech counts
    const now = Math.floor(Date.now() / 1000);
    await new Promise<void>((resolve, reject) => {
      const stmt = testDb.prepare(`
        INSERT INTO users (
          id, username, password_hash, iron, last_updated, tech_tree, 
          pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield,
          build_queue, build_start_sec
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([testUserId, 'testuser', 'hash', 1000, now, '{}', 1, 0, 1, 0, 5, '[]', null], (err) => {
        stmt.finalize(); // Always finalize the statement
        if (err) reject(err);
        else resolve();
      });
    });
  });

  afterEach(async () => {
    // Properly close the database connection
    await new Promise<void>((resolve) => {
      testDb.close((err) => {
        if (err) {
          console.error('Error closing test database:', err);
        }
        resolve();
      });
    });
    UserCache.resetInstance();
    await shutdownIntegrationTestServer();
  });

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

  test('processCompletedBuilds_singleWeaponCompleted_sendsNotification', async () => {
    // Arrange - Add a completed weapon to build queue
    // Pulse Laser duration is 2 minutes (120 seconds)
    const now = Math.floor(Date.now() / 1000);
    const completedTime = now - 10; // Completed 10 seconds ago
    const duration = 120;
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

    // Assert - Notification was sent
    expect(mockCreateMessage).toHaveBeenCalledOnce();
    expect(mockCreateMessage).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('Build complete: Pulse Laser')
    );
  });

  test('processCompletedBuilds_singleDefenseCompleted_sendsNotification', async () => {
    // Arrange - Add a completed defense item to build queue
    // Kinetic Armor duration? Let's assume 1 min for simplicity or check factory.
    // TechFactory: kinetic_armor buildDurationMinutes = 2 (from memory? no, let's check or just assume service uses factory)
    // I will just set startSec far in the past to ensure completion.
    const startSec = Math.floor(Date.now() / 1000) - 10000;

    const buildQueue: BuildQueueItem[] = [
      {
        itemKey: 'kinetic_armor',
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
    expect(result.completed[0].itemKey).toBe('kinetic_armor');

    // Assert - Notification was sent for defense
    expect(mockCreateMessage).toHaveBeenCalledOnce();
    expect(mockCreateMessage).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('Build complete: Kinetic Armor') // Adjust string to match TechService output
    );
  });

  test('processCompletedBuilds_multipleItemsCompleted_sendsMultipleNotifications', async () => {
    // Arrange - Add multiple completed items to build queue
    // We need to set startSec such that multiple items are finished.
    // Item 1: Pulse Laser (2 min)
    // Item 2: Kinetic Armor (assume 2 min)
    // Item 3: Auto Turret (1 min)
    // Total time: 5 mins.
    // Set start time 6 mins ago.

    const startSec = Math.floor(Date.now() / 1000) - (10 * 60);

    const buildQueue: BuildQueueItem[] = [
      { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
      { itemKey: 'kinetic_armor', itemType: 'defense', completionTime: 0 },
      { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
    ];

    await updateBuildQueue(testUserId, buildQueue, startSec);

    // Act - Process completed builds
    const context = createLockContext();
    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await techService.processCompletedBuilds(testUserId, userContext);
    });

    // Assert - All builds were processed
    expect(result.completed).toHaveLength(3);

    // Assert - Multiple notifications were sent
    expect(mockCreateMessage).toHaveBeenCalledTimes(3);

    // Check each notification was sent with correct content
    const calls = mockCreateMessage.mock.calls;
    expect(calls).toEqual(expect.arrayContaining([
      [testUserId, expect.stringContaining('Pulse Laser')],
      [testUserId, expect.stringContaining('Kinetic Armor')],
      [testUserId, expect.stringContaining('Auto Turret')]
    ]));
  });

  test('processCompletedBuilds_mixedCompletedAndPending_onlyNotifiesCompleted', async () => {
    // Arrange - Mix of completed and pending items
    // Item 1: Pulse Laser (2 min) - Completed
    // Item 2: Auto Turret (1 min) - Pending
    // Set start time 2.5 mins ago. 
    // Item 1 finishes at T+2. Item 2 starts at T+2, finishes at T+3.
    // Current time is T+2.5. So Item 1 done, Item 2 halfway.

    const now = Math.floor(Date.now() / 1000);
    const startSec = now - (2.5 * 60);

    const buildQueue: BuildQueueItem[] = [
      { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
      { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
    ];

    await updateBuildQueue(testUserId, buildQueue, startSec);

    // Act - Process completed builds
    const context = createLockContext();
    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await techService.processCompletedBuilds(testUserId, userContext);
    });

    // Assert - Only completed item was processed
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].itemKey).toBe('pulse_laser');

    // Assert - Only one notification sent (for completed item)
    expect(mockCreateMessage).toHaveBeenCalledOnce();
    expect(mockCreateMessage).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('Pulse Laser')
    );
  });

  test('processCompletedBuilds_noCompletedBuilds_sendsNoNotifications', async () => {
    // Arrange - Only pending builds
    // Item 1: Pulse Laser (2 min)
    // Start time: 1 min ago. Not done.

    const now = Math.floor(Date.now() / 1000);
    const startSec = now - (1 * 60);

    const buildQueue: BuildQueueItem[] = [
      { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
    ];

    await updateBuildQueue(testUserId, buildQueue, startSec);

    // Act - Process completed builds
    const context = createLockContext();
    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await techService.processCompletedBuilds(testUserId, userContext);
    });

    // Assert - No builds completed
    expect(result.completed).toHaveLength(0);

    // Assert - No notifications sent
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  test('processCompletedBuilds_notificationFails_continuesWithOtherNotifications', async () => {
    // Arrange - Multiple completed items, mock first notification to fail
    mockCreateMessage
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(2);

    const startSec = Math.floor(Date.now() / 1000) - (10 * 60); // All done

    const buildQueue: BuildQueueItem[] = [
      { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
      { itemKey: 'kinetic_armor', itemType: 'defense', completionTime: 0 }
    ];

    await updateBuildQueue(testUserId, buildQueue, startSec);

    // Act - Process completed builds (should not throw)
    const context = createLockContext();
    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await techService.processCompletedBuilds(testUserId, userContext);
    });

    // Assert - Both builds were still processed despite notification failure
    expect(result.completed).toHaveLength(2);

    // Assert - Both notifications were attempted
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
  });
});