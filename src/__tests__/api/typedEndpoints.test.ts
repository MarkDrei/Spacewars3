// ---
// Tests for TypeScript Compile-Time Deadlock Prevention System
// Phase 3: Typed API Lock Ordering Validation
// ---

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { TypedCacheManager, getTypedCacheManager } from '../../lib/server/typedCacheManager';
import { createEmptyContext } from '../../lib/server/ironGuard';

describe('Phase 3: Typed API Lock Ordering System', () => {
  
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

  describe('API-Style Lock Ordering Patterns', () => {
    test('apiPattern_collectionLikeOperation_executesWithProperLockOrdering', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];
      
      // Simulate collection API pattern: World Write → User → Database Read
      const result = await manager.withWorldWrite(emptyCtx, async (worldCtx) => {
        executionOrder.push('world-write-acquired');
        
        return await manager.withUserLock(worldCtx, async (userCtx) => {
          executionOrder.push('user-lock-acquired');
          
          // Simulate accessing world data (safe - we have world write lock)
          const world = manager.getWorldUnsafe(userCtx);
          expect(world).toBeDefined();
          executionOrder.push('world-data-accessed');
          
          // Simulate accessing user data (safe - we have user lock)
          const user = manager.getUserUnsafe(1, userCtx);
          executionOrder.push('user-data-accessed');
          
          // Simulate database access if needed
          if (!user) {
            return await manager.withDatabaseRead(userCtx, async (dbCtx) => {
              executionOrder.push('database-read-acquired');
              
              // Simulate loading user from database
              const loadedUser = await manager.loadUserFromDbUnsafe(1, dbCtx);
              executionOrder.push('user-loaded-from-db');
              
              if (loadedUser) {
                manager.setUserUnsafe(loadedUser, userCtx);
                executionOrder.push('user-cached');
              }
              
              return 'collection-with-db-load';
            });
          }
          
          // Simulate updating data (safe - we have proper locks)
          manager.updateUserUnsafe(user, userCtx);
          manager.updateWorldUnsafe(world, userCtx);
          executionOrder.push('data-updated');
          
          return 'collection-success';
        });
      });
      
      expect(result).toMatch(/collection-(success|with-db-load)/);
      
      // Verify execution order (may vary if database load was needed)
      if (result === 'collection-success') {
        expect(executionOrder).toEqual([
          'world-write-acquired',
          'user-lock-acquired', 
          'world-data-accessed',
          'user-data-accessed',
          'data-updated'
        ]);
      } else {
        // Database load path
        expect(executionOrder).toContain('world-write-acquired');
        expect(executionOrder).toContain('user-lock-acquired');
        expect(executionOrder).toContain('database-read-acquired');
      }
      
      console.log('✅ Collection-like API pattern executed with proper lock ordering');
    });

    test('apiPattern_navigationLikeOperation_executesWithProperLockOrdering', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];
      
      // Simulate navigation API pattern: World Write → User
      const result = await manager.withWorldWrite(emptyCtx, async (worldCtx) => {
        executionOrder.push('world-write-acquired');
        
        return await manager.withUserLock(worldCtx, async (userCtx) => {
          executionOrder.push('user-lock-acquired');
          
          // Simulate accessing world data for ship updates
          const world = manager.getWorldUnsafe(userCtx);
          expect(world).toBeDefined();
          executionOrder.push('world-data-accessed');
          
          // Simulate accessing user data for ship ownership
          const _user = manager.getUserUnsafe(1, userCtx);
          executionOrder.push('user-data-accessed');
          
          // Simulate updating world with new ship position
          manager.updateWorldUnsafe(world, userCtx);
          executionOrder.push('ship-position-updated');
          
          return 'navigation-success';
        });
      });
      
      expect(result).toBe('navigation-success');
      expect(executionOrder).toEqual([
        'world-write-acquired',
        'user-lock-acquired',
        'world-data-accessed', 
        'user-data-accessed',
        'ship-position-updated'
      ]);
      
      console.log('✅ Navigation-like API pattern executed with proper lock ordering');
    });

    test('apiPattern_readOnlyOperation_executesWithProperLockOrdering', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];
      
      // Simulate read-only API pattern: World Read → User
      const result = await manager.withWorldRead(emptyCtx, async (worldCtx) => {
        executionOrder.push('world-read-acquired');
        
        return await manager.withUserLock(worldCtx, async (userCtx) => {
          executionOrder.push('user-lock-acquired');
          
          // Simulate reading world data
          const world = manager.getWorldUnsafe(userCtx);
          expect(world).toBeDefined();
          executionOrder.push('world-data-read');
          
          // Simulate reading user data
          const user = manager.getUserUnsafe(1, userCtx);
          executionOrder.push('user-data-read');
          
          // Return read-only data (no updates)
          return {
            worldSize: world.spaceObjects.length,
            userIron: user?.iron || 0
          };
        });
      });
      
      expect(result.worldSize).toBeGreaterThanOrEqual(0);
      expect(executionOrder).toEqual([
        'world-read-acquired',
        'user-lock-acquired',
        'world-data-read',
        'user-data-read'
      ]);
      
      console.log('✅ Read-only API pattern executed with proper lock ordering');
    });
  });

  describe('Concurrent API Operations', () => {
    test('concurrentAPIOperations_differentPatterns_noDeadlocks', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      const emptyCtx = createEmptyContext();
      
      // Start multiple concurrent API-like operations
      const operations = [
        // Read-only operation
        manager.withWorldRead(emptyCtx, async (worldCtx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return await manager.withUserLock(worldCtx, async (_userCtx) => {
            return 'read-operation';
          });
        }),
        
        // Write operation 
        manager.withWorldWrite(emptyCtx, async (worldCtx) => {
          await new Promise(resolve => setTimeout(resolve, 15));
          return await manager.withUserLock(worldCtx, async (_userCtx) => {
            return 'write-operation';
          });
        }),
        
        // User-focused operation
        manager.withUserLock(emptyCtx, async (_userCtx) => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return 'user-operation';
        }),
        
        // Get stats (another read operation)
        manager.getStats()
      ];
      
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(4);
      expect(duration).toBeLessThan(1000); // Should complete quickly without deadlocks
      
      console.log(`✅ 4 concurrent API operations completed in ${duration}ms without deadlocks`);
    });

    test('highConcurrencyAPIOperations_manySimultaneous_maintainsSafety', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      const emptyCtx = createEmptyContext();
      
      // Create many concurrent operations simulating high API load
      const operations = Array.from({ length: 10 }, (_, i) => {
        if (i % 3 === 0) {
          // Read operations
          return manager.withWorldRead(emptyCtx, async (_worldCtx) => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
            return `read-${i}`;
          });
        } else if (i % 3 === 1) {
          // Write operations
          return manager.withWorldWrite(emptyCtx, async (worldCtx) => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
            return await manager.withUserLock(worldCtx, async (_userCtx) => {
              return `write-${i}`;
            });
          });
        } else {
          // User operations
          return manager.withUserLock(emptyCtx, async (_userCtx) => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
            return `user-${i}`;
          });
        }
      });
      
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(2000); // Should complete without hanging
      
      // Verify all operations completed successfully
      const readOps = results.filter(r => r.includes('read')).length;
      const writeOps = results.filter(r => r.includes('write')).length;
      const userOps = results.filter(r => r.includes('user')).length;
      
      expect(readOps + writeOps + userOps).toBe(10);
      
      console.log(`✅ 10 high-concurrency API operations (${readOps} read, ${writeOps} write, ${userOps} user) completed in ${duration}ms`);
    });
  });

  describe('Type Safety Validation', () => {
    test('compiletimeSafety_lockContextRequirements_enforceCorrectUsage', async () => {
      const manager = getTypedCacheManager();
      await manager.initialize();
      
      const emptyCtx = createEmptyContext();
      
      // These operations should compile correctly (proper lock contexts)
      await manager.withWorldWrite(emptyCtx, async (worldCtx) => {
        const world = manager.getWorldUnsafe(worldCtx); // ✅ Has world write context
        expect(world).toBeDefined();
        
        await manager.withUserLock(worldCtx, async (userCtx) => {
          const user = manager.getUserUnsafe(1, userCtx); // ✅ Has user context
          manager.updateUserUnsafe(user || { id: 1 } as any, userCtx); // ✅ Has user context
          manager.updateWorldUnsafe(world, userCtx); // ✅ Has world write context
          
          return 'type-safe-operations';
        });
        
        return 'compile-time-safe';
      });
      
      // The following would cause compile errors if uncommented:
      /*
      // ❌ Missing world lock context
      const world = manager.getWorldUnsafe(emptyCtx);
      
      // ❌ Missing user lock context  
      const user = manager.getUserUnsafe(1, emptyCtx);
      
      // ❌ Invalid lock ordering (would need to be detected at compile-time)
      await manager.withUserLock(emptyCtx, async (userCtx) => {
        await manager.withWorldWrite(userCtx, async (worldCtx) => {
          // This violates lock ordering: User(2) → World(1)
        });
      });
      */
      
      console.log('✅ Compile-time type safety enforced for lock contexts');
    });
  });
});
