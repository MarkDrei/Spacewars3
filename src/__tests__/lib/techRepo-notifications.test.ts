import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { TechRepo } from '@/lib/server/techRepo';
import { sendMessageToUser } from '@/lib/server/messages/MessageCache';
import { createTestDatabase } from '../helpers/testDatabase';
import sqlite3 from 'sqlite3';

// Mock the notification system
vi.mock('@/lib/server/messages/MessageCache', () => ({
  sendMessageToUser: vi.fn().mockResolvedValue(1)
}));

const mockSendMessageToUser = vi.mocked(sendMessageToUser);

describe('TechRepo - Build Completion Notifications', () => {
  let testDb: sqlite3.Database;
  let techRepo: TechRepo;
  const testUserId = 1;

  beforeEach(async () => {
    // Create test database and TechRepo instance
    testDb = await createTestDatabase();
    techRepo = new TechRepo(testDb);
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Set up test user with initial tech counts
    const now = Math.floor(Date.now() / 1000);
    await new Promise<void>((resolve, reject) => {
      const stmt = testDb.prepare(`
        INSERT INTO users (
          id, username, password_hash, iron, last_updated, tech_tree, 
          pulse_laser, auto_turret, ship_hull, kinetic_armor, energy_shield
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([testUserId, 'testuser', 'hash', 1000, now, '{}', 1, 0, 1, 0, 5], (err) => {
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
  });

  test('processCompletedBuilds_singleWeaponCompleted_sendsNotification', async () => {
    // Arrange - Add a completed weapon to build queue
    const completedTime = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago
    const buildQueue = [
      {
        itemKey: 'pulse_laser',
        itemType: 'weapon' as const,
        completionTime: completedTime
      }
    ];
    
    await techRepo.updateBuildQueue(testUserId, buildQueue);

    // Act - Process completed builds
    const result = await techRepo.processCompletedBuilds(testUserId);

    // Assert - Build was processed
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].itemKey).toBe('pulse_laser');
    expect(result.remaining).toHaveLength(0);

    // Assert - Notification was sent
    expect(mockSendMessageToUser).toHaveBeenCalledOnce();
    expect(mockSendMessageToUser).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('🔧 Construction complete')
    );
    expect(mockSendMessageToUser).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('Pulse Laser')
    );
    expect(mockSendMessageToUser).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('weapon')
    );
  });

  test('processCompletedBuilds_singleDefenseCompleted_sendsNotification', async () => {
    // Arrange - Add a completed defense item to build queue
    const completedTime = Math.floor(Date.now() / 1000) - 10;
    const buildQueue = [
      {
        itemKey: 'kinetic_armor',
        itemType: 'defense' as const,
        completionTime: completedTime
      }
    ];
    
    await techRepo.updateBuildQueue(testUserId, buildQueue);

    // Act - Process completed builds
    const result = await techRepo.processCompletedBuilds(testUserId);

    // Assert - Build was processed
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].itemKey).toBe('kinetic_armor');

    // Assert - Notification was sent for defense
    expect(mockSendMessageToUser).toHaveBeenCalledOnce();
    expect(mockSendMessageToUser).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('🔧 Construction complete')
    );
    expect(mockSendMessageToUser).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('defense system')
    );
  });

  test('processCompletedBuilds_multipleItemsCompleted_sendsMultipleNotifications', async () => {
    // Arrange - Add multiple completed items to build queue
    const completedTime = Math.floor(Date.now() / 1000) - 10;
    const buildQueue = [
      {
        itemKey: 'pulse_laser',
        itemType: 'weapon' as const,
        completionTime: completedTime
      },
      {
        itemKey: 'kinetic_armor',
        itemType: 'defense' as const,
        completionTime: completedTime - 5
      },
      {
        itemKey: 'auto_turret',
        itemType: 'weapon' as const,
        completionTime: completedTime - 2
      }
    ];
    
    await techRepo.updateBuildQueue(testUserId, buildQueue);

    // Act - Process completed builds
    const result = await techRepo.processCompletedBuilds(testUserId);

    // Assert - All builds were processed
    expect(result.completed).toHaveLength(3);
    expect(result.remaining).toHaveLength(0);

    // Assert - Multiple notifications were sent
    expect(mockSendMessageToUser).toHaveBeenCalledTimes(3);
    
    // Check each notification was sent with correct content
    const calls = mockSendMessageToUser.mock.calls;
    expect(calls).toEqual(expect.arrayContaining([
      [testUserId, expect.stringContaining('Pulse Laser')],
      [testUserId, expect.stringContaining('Kinetic Armor')],
      [testUserId, expect.stringContaining('Auto Turret')]
    ]));
  });

  test('processCompletedBuilds_mixedCompletedAndPending_onlyNotifiesCompleted', async () => {
    // Arrange - Mix of completed and pending items
    const now = Math.floor(Date.now() / 1000);
    const buildQueue = [
      {
        itemKey: 'pulse_laser',
        itemType: 'weapon' as const,
        completionTime: now - 10 // Completed
      },
      {
        itemKey: 'auto_turret',
        itemType: 'weapon' as const,
        completionTime: now + 60 // Still building (1 minute from now)
      }
    ];
    
    await techRepo.updateBuildQueue(testUserId, buildQueue);

    // Act - Process completed builds
    const result = await techRepo.processCompletedBuilds(testUserId);

    // Assert - Only completed item was processed
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].itemKey).toBe('pulse_laser');
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].itemKey).toBe('auto_turret');

    // Assert - Only one notification sent (for completed item)
    expect(mockSendMessageToUser).toHaveBeenCalledOnce();
    expect(mockSendMessageToUser).toHaveBeenCalledWith(
      testUserId,
      expect.stringContaining('Pulse Laser')
    );
  });

  test('processCompletedBuilds_noCompletedBuilds_sendsNoNotifications', async () => {
    // Arrange - Only pending builds
    const now = Math.floor(Date.now() / 1000);
    const buildQueue = [
      {
        itemKey: 'pulse_laser',
        itemType: 'weapon' as const,
        completionTime: now + 60 // Still building
      }
    ];
    
    await techRepo.updateBuildQueue(testUserId, buildQueue);

    // Act - Process completed builds
    const result = await techRepo.processCompletedBuilds(testUserId);

    // Assert - No builds completed
    expect(result.completed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);

    // Assert - No notifications sent
    expect(mockSendMessageToUser).not.toHaveBeenCalled();
  });

  test('processCompletedBuilds_notificationFails_continuesWithOtherNotifications', async () => {
    // Arrange - Multiple completed items, mock first notification to fail
    mockSendMessageToUser
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(2);
    
    const completedTime = Math.floor(Date.now() / 1000) - 10;
    const buildQueue = [
      {
        itemKey: 'pulse_laser',
        itemType: 'weapon' as const,
        completionTime: completedTime
      },
      {
        itemKey: 'kinetic_armor',
        itemType: 'defense' as const,
        completionTime: completedTime - 5
      }
    ];
    
    await techRepo.updateBuildQueue(testUserId, buildQueue);

    // Act - Process completed builds (should not throw)
    const result = await techRepo.processCompletedBuilds(testUserId);

    // Assert - Both builds were still processed despite notification failure
    expect(result.completed).toHaveLength(2);
    expect(result.remaining).toHaveLength(0);

    // Assert - Both notifications were attempted
    expect(mockSendMessageToUser).toHaveBeenCalledTimes(2);
  });
});