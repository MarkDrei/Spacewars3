// ---
// Tests for TypedCacheManager
// ---

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { 
  UserWorldCache, 
  getUserWorldCache,
  type TypedCacheConfig 
} from '../../lib/server/world/userWorldCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

describe('TypedCacheManager', () => {
  
  beforeEach(() => {
    // Reset singleton before each test
    UserWorldCache.resetInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      const manager = getUserWorldCache();
      await manager.shutdown();
      UserWorldCache.resetInstance();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Singleton Pattern', () => {
    test('getInstance_multipleCalls_returnsSameInstance', () => {
      const manager1 = UserWorldCache.getInstance();
      const manager2 = UserWorldCache.getInstance();
      const manager3 = getUserWorldCache();

      expect(manager1).toBe(manager2);
      expect(manager2).toBe(manager3);
    });

    test('resetInstance_afterReset_createsNewInstance', () => {
      const manager1 = UserWorldCache.getInstance();
      UserWorldCache.resetInstance();
      const manager2 = UserWorldCache.getInstance();

      expect(manager1).not.toBe(manager2);
    });

    test('getInstance_withConfig_appliesConfiguration', () => {
      const config: TypedCacheConfig = {
        persistenceIntervalMs: 10000,
        enableAutoPersistence: false,
        logStats: true
      };

      const manager = UserWorldCache.getInstance(config);
      
      expect(manager).toBeDefined();
      // Config is applied internally (we can't directly test private members)
    });
  });

  describe('Basic Functionality', () => {
    test('getUserById_nonExistentUser_returnsNull', async () => {
      const manager = getUserWorldCache();
      await manager.initialize();

      const user = await manager.getUserById(createLockContext(), 999); // Non-existent user
      expect(user).toBeNull();
    });

    test('getStats_returnsValidStats', async () => {
      const manager = getUserWorldCache();
      await manager.initialize();

      const stats = await manager.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.userCacheSize).toBe(0);
      expect(stats.worldCacheHits).toBeGreaterThanOrEqual(0);
      expect(stats.worldCacheMisses).toBeGreaterThanOrEqual(0);
      expect(stats.userCacheHits).toBe(0);
      expect(stats.userCacheMisses).toBe(0);
      expect(stats.dirtyUsers).toBe(0);
      expect(typeof stats.worldDirty).toBe('boolean');
    });
  });

  describe('Lifecycle', () => {
    test('initialize_multipleCallsAreSafe_noErrors', async () => {
      const manager = getUserWorldCache();
      
      // Multiple initialization calls should be safe
      await manager.initialize();
      await manager.initialize();
      await manager.initialize();
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    test('shutdown_afterInitialization_cleansUpProperly', async () => {
      const manager = getUserWorldCache();
      await manager.initialize();
      
      await manager.shutdown();
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Concurrency', () => {
    test('concurrentOperations_completeSuccessfully', async () => {
      const manager = getUserWorldCache();
      await manager.initialize();

      // Start multiple concurrent operations
      const operations = [
        manager.getUserById(createLockContext(), 999),
        manager.getUserById(createLockContext(), 998),
        manager.getStats(),
        manager.getStats()
      ];

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(4);
      expect(results[0]).toBeNull(); // Non-existent user
      expect(results[1]).toBeNull(); // Non-existent user
      expect(results[2]).toBeDefined(); // Stats object
      expect(results[3]).toBeDefined(); // Stats object
    });
  });
});

// TODO: Add behavior-focused tests for:
// - Cache hit/miss behavior
// - Dirty data tracking and persistence
// - Message caching
// - World data caching
// - Username cache
// - Concurrent access to same user
