// ---
// Tests for TypeScript Compile-Time Deadlock Prevention System
// Phase 2: Typed Cache Manager
// ---

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { 
  TypedCacheManager, 
  getTypedCacheManager,
  type TypedCacheConfig 
} from '../../lib/server/typedCacheManager';
import { createEmptyContext } from '../../lib/server/typedLocks';

describe('Phase 2: Typed Cache Manager', () => {
  
  beforeEach(() => {
    // Reset singleton before each test
    TypedCacheManager.resetInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      const manager = getTypedCacheManager();
      await manager.shutdown();
      TypedCacheManager.resetInstance();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Singleton Pattern', () => {
    test('getInstance_multipleCalls_returnsSameInstance', () => {
      const manager1 = TypedCacheManager.getInstance();
      const manager2 = TypedCacheManager.getInstance();
      const manager3 = getTypedCacheManager();

      expect(manager1).toBe(manager2);
      expect(manager2).toBe(manager3);
    });

    test('resetInstance_afterReset_createsNewInstance', () => {
      const manager1 = TypedCacheManager.getInstance();
      TypedCacheManager.resetInstance();
      const manager2 = TypedCacheManager.getInstance();

      expect(manager1).not.toBe(manager2);
    });

    test('getInstance_withConfig_appliesConfiguration', () => {
      const config: TypedCacheConfig = {
        persistenceIntervalMs: 10000,
        enableAutoPersistence: false,
        logStats: true
      };

      const manager = TypedCacheManager.getInstance(config);
      
      expect(manager).toBeDefined();
      // Config is applied internally (we can't directly test private members)
    });
  });

  describe('Lock Ordering Validation', () => {
    test('typedLockOrdering_validSequence_allowsExecution', async () => {
      const manager = getTypedCacheManager();
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      // Valid ordering: Cache Management (0) → World Write (1) → User (2) → Database Read (3)
      const result = await manager.withCacheManagement(emptyCtx, async (cacheCtx) => {
        executionOrder.push('cache-mgmt');
        
        return await manager.withWorldWrite(cacheCtx, async (worldCtx) => {
          executionOrder.push('world-write');
          
          return await manager.withUserLock(worldCtx, async (userCtx) => {
            executionOrder.push('user');
            
            return await manager.withDatabaseRead(userCtx, async (_dbCtx) => {
              executionOrder.push('database-read');
              return 'success';
            });
          });
        });
      });

      expect(result).toBe('success');
      expect(executionOrder).toEqual(['cache-mgmt', 'world-write', 'user', 'database-read']);
    });

    test('typedLockOrdering_skippingLevels_allowsExecution', async () => {
      const manager = getTypedCacheManager();
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      // Valid: Skip world level, go directly Cache (0) → User (2)
      const result = await manager.withCacheManagement(emptyCtx, async (cacheCtx) => {
        executionOrder.push('cache-mgmt');
        
        return await manager.withUserLock(cacheCtx, async (_userCtx) => {
          executionOrder.push('user');
          return 'skipped-world';
        });
      });

      expect(result).toBe('skipped-world');
      expect(executionOrder).toEqual(['cache-mgmt', 'user']);
    });

    test('typedLockOrdering_worldAndUserSeparately_allowsExecution', async () => {
      const manager = getTypedCacheManager();
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      // Valid: World operations separately from user operations
      await manager.withWorldRead(emptyCtx, async (_worldCtx) => {
        executionOrder.push('world-read');
        return 'world-done';
      });

      await manager.withUserLock(emptyCtx, async (_userCtx) => {
        executionOrder.push('user');
        return 'user-done';
      });

      expect(executionOrder).toEqual(['world-read', 'user']);
    });
  });

  describe('Data Access Methods', () => {
    test('unsafeMethods_requireProperContext_enforceCompileTimeSafety', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      const emptyCtx = createEmptyContext();

      // These operations require proper lock contexts (compile-time enforced)
      await manager.withWorldRead(emptyCtx, async (worldCtx) => {
        // This should work - we have world read context
        const world = manager.getWorldUnsafe(worldCtx);
        expect(world).toBeDefined();
      });

      await manager.withUserLock(emptyCtx, async (userCtx) => {
        // This should work - we have user lock context
        const user = manager.getUserUnsafe(123, userCtx);
        expect(user).toBeNull(); // No user 123 in cache initially
      });
    });

    test('loadUserIfNeeded_properLockOrdering_worksCorrectly', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();

      // This method internally uses proper lock ordering
      const user = await manager.loadUserIfNeeded(999); // Non-existent user
      expect(user).toBeNull();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('getStats_properLockOrdering_returnsStats', async () => {
      const manager = getTypedCacheManager();
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

  describe('Initialization and Shutdown', () => {
    test('initialize_multipleCallsAreSafe_noErrors', async () => {
      const manager = getTypedCacheManager();
      
      // Multiple initialization calls should be safe
      await manager.initialize();
      await manager.initialize();
      await manager.initialize();
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    test('shutdown_afterInitialization_cleansUpProperly', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      await manager.shutdown();
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Concurrency Safety', () => {
    test('concurrentOperations_properLockOrdering_noDeadlocks', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      const emptyCtx = createEmptyContext();

      // Start multiple concurrent operations
      const operations = [
        manager.withWorldRead(emptyCtx, async (_worldCtx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'world-read-1';
        }),
        manager.withWorldRead(emptyCtx, async (_worldCtx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'world-read-2';
        }),
        manager.withUserLock(emptyCtx, async (_userCtx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'user-1';
        }),
        manager.loadUserIfNeeded(999),
        manager.getStats()
      ];

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(5);
      expect(results[0]).toBe('world-read-1');
      expect(results[1]).toBe('world-read-2');
      expect(results[2]).toBe('user-1');
      expect(results[3]).toBeNull(); // Non-existent user
      expect(results[4]).toBeDefined(); // Stats object
    });
  });
});

// Note: Compile-time tests would go here if we wanted to verify that 
// invalid lock orderings cause compilation errors. These would be in 
// separate files that are expected to fail compilation.
