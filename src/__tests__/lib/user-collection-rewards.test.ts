import { describe, expect, test, vi } from 'vitest';
import { User } from '@/lib/server/user';
import { createInitialTechTree } from '@/lib/server/techtree';

// Mock save callback
const mockSaveCallback = vi.fn().mockResolvedValue(undefined);

describe('User Collection Rewards', () => {
  
  test('collected_asteroid_awardsRandomIronBetween50And250', () => {
    // Arrange
    const user = new User(
      1,
      'testuser',
      'password_hash',
      1000, // initial iron
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const initialIron = user.iron;

    // Act
    user.collected('asteroid');

    // Assert
    const ironGained = user.iron - initialIron;
    expect(ironGained).toBeGreaterThanOrEqual(50);
    expect(ironGained).toBeLessThanOrEqual(250);
    expect(user.iron).toBeGreaterThan(initialIron);
  });

  test('collected_shipwreck_awardsRandomIronBetween50And1000', () => {
    // Arrange
    const user = new User(
      2,
      'testuser2',
      'password_hash',
      500, // initial iron
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const initialIron = user.iron;

    // Act
    user.collected('shipwreck');

    // Assert
    const ironGained = user.iron - initialIron;
    expect(ironGained).toBeGreaterThanOrEqual(50);
    expect(ironGained).toBeLessThanOrEqual(1000);
    expect(user.iron).toBeGreaterThan(initialIron);
  });

  test('collected_escapePod_awardsNoIron', () => {
    // Arrange
    const user = new User(
      3,
      'testuser3',
      'password_hash',
      750, // initial iron
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const initialIron = user.iron;

    // Act
    user.collected('escape_pod');

    // Assert
    expect(user.iron).toBe(initialIron); // No change in iron
  });

  test('collected_multipleAsteroids_awardsVariousAmounts', () => {
    // Arrange
    const user = new User(
      4,
      'testuser4',
      'password_hash',
      0, // start with no iron
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const rewards: number[] = [];

    // Act - collect 10 asteroids and track rewards
    for (let i = 0; i < 10; i++) {
      const ironBefore = user.iron;
      user.collected('asteroid');
      const reward = user.iron - ironBefore;
      rewards.push(reward);
    }

    // Assert - all rewards should be in range and vary
    rewards.forEach(reward => {
      expect(reward).toBeGreaterThanOrEqual(50);
      expect(reward).toBeLessThanOrEqual(250);
    });
    
    // Check that we got some variation (not all the same)
    const uniqueRewards = new Set(rewards);
    expect(uniqueRewards.size).toBeGreaterThan(1); // Should have some variation
  });

  test('collected_multipleShipwrecks_awardsVariousAmounts', () => {
    // Arrange
    const user = new User(
      5,
      'testuser5',
      'password_hash',
      0, // start with no iron
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const rewards: number[] = [];

    // Act - collect 5 shipwrecks and track rewards
    for (let i = 0; i < 5; i++) {
      const ironBefore = user.iron;
      user.collected('shipwreck');
      const reward = user.iron - ironBefore;
      rewards.push(reward);
    }

    // Assert - all rewards should be in range
    rewards.forEach(reward => {
      expect(reward).toBeGreaterThanOrEqual(50);
      expect(reward).toBeLessThanOrEqual(1000);
    });
    
    // Check that total iron is sum of all rewards
    const expectedTotal = rewards.reduce((sum, reward) => sum + reward, 0);
    expect(user.iron).toBe(expectedTotal);
  });

  test('collected_mixedObjects_awardsCorrectAmounts', () => {
    // Arrange
    const user = new User(
      6,
      'testuser6',
      'password_hash',
      100, // initial iron
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const initialIron = user.iron;

    // Act
    user.collected('asteroid');
    const ironAfterAsteroid = user.iron;
    
    user.collected('escape_pod');
    const ironAfterEscapePod = user.iron;
    
    user.collected('shipwreck');
    const finalIron = user.iron;

    // Assert
    // Asteroid should give some iron
    expect(ironAfterAsteroid).toBeGreaterThan(initialIron);
    const asteroidReward = ironAfterAsteroid - initialIron;
    expect(asteroidReward).toBeGreaterThanOrEqual(50);
    expect(asteroidReward).toBeLessThanOrEqual(250);
    
    // Escape pod should give no iron
    expect(ironAfterEscapePod).toBe(ironAfterAsteroid);
    
    // Shipwreck should give iron
    expect(finalIron).toBeGreaterThan(ironAfterEscapePod);
    const shipwreckReward = finalIron - ironAfterEscapePod;
    expect(shipwreckReward).toBeGreaterThanOrEqual(50);
    expect(shipwreckReward).toBeLessThanOrEqual(1000);
  });

  test('collected_unknownObjectType_awardsNoIron', () => {
    // Arrange
    const user = new User(
      7,
      'testuser7',
      'password_hash',
      200,
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );
    
    const initialIron = user.iron;
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    // @ts-expect-error - Testing invalid object type
    user.collected('unknown_object');

    // Assert
    expect(user.iron).toBe(initialIron); // No iron change
    expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown object type collected: unknown_object');
    
    consoleWarnSpy.mockRestore();
  });
});
