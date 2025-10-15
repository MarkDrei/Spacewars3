/**
 * Tests for IronGuard Lock System
 * 
 * Comprehensive test suite verifying compile-time and runtime lock ordering
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { 
  LockContext,
  createEmptyLockContext,
  LOCK_CACHE,
  LOCK_WORLD,
  LOCK_USER,
  LOCK_MESSAGE_READ,
  LOCK_MESSAGE_WRITE,
  LOCK_DATABASE,
  AsyncMutex,
  AsyncReadWriteLock
} from '../../lib/server/ironGuard';

describe('IronGuard Core Lock System', () => {
  
  describe('Basic Lock Acquisition', () => {
    test('lockAcquisition_emptyContext_canAcquireAnyLock', () => {
      const ctx = createEmptyLockContext();
      
      // Can acquire any lock from empty context
      const cacheCtx = ctx.acquire(LOCK_CACHE);
      expect(typeof cacheCtx).not.toBe('string');
      expect(cacheCtx.hasLock(LOCK_CACHE)).toBe(true);
      
      const worldCtx = ctx.acquire(LOCK_WORLD);
      expect(typeof worldCtx).not.toBe('string');
      expect(worldCtx.hasLock(LOCK_WORLD)).toBe(true);
      
      const userCtx = ctx.acquire(LOCK_USER);
      expect(typeof userCtx).not.toBe('string');
      expect(userCtx.hasLock(LOCK_USER)).toBe(true);
    });
    
    test('lockAcquisition_orderedSequence_succeeds', () => {
      const ctx = createEmptyLockContext()
        .acquire(LOCK_CACHE)
        .acquire(LOCK_WORLD)
        .acquire(LOCK_USER);
      
      expect(ctx.hasLock(LOCK_CACHE)).toBe(true);
      expect(ctx.hasLock(LOCK_WORLD)).toBe(true);
      expect(ctx.hasLock(LOCK_USER)).toBe(true);
      
      const heldLocks = ctx.getHeldLocks();
      expect(heldLocks).toEqual([10, 20, 30]);
    });
    
    test('lockAcquisition_skipIntermediateLocks_succeeds', () => {
      // Can skip locks: 10 → 30
      const ctx1 = createEmptyLockContext()
        .acquire(LOCK_CACHE)
        .acquire(LOCK_USER);
      
      expect(ctx1.hasLock(LOCK_CACHE)).toBe(true);
      expect(ctx1.hasLock(LOCK_USER)).toBe(true);
      expect(ctx1.hasLock(LOCK_WORLD)).toBe(false);
      
      // Can acquire directly without any prerequisites
      const ctx2 = createEmptyLockContext().acquire(LOCK_USER);
      expect(ctx2.hasLock(LOCK_USER)).toBe(true);
      expect(ctx2.hasLock(LOCK_CACHE)).toBe(false);
      expect(ctx2.hasLock(LOCK_WORLD)).toBe(false);
    });
    
    test('lockAcquisition_alreadyHeld_returnsError', () => {
      const ctx = createEmptyLockContext().acquire(LOCK_CACHE);
      
      // Try to acquire same lock again
      const result = ctx.acquire(LOCK_CACHE);
      expect(typeof result).toBe('string');
      expect(result).toContain('already held');
    });
    
    test('lockAcquisition_wrongOrder_returnsError', () => {
      const ctx = createEmptyLockContext().acquire(LOCK_USER);
      
      // Try to acquire lower lock after higher lock
      const result = ctx.acquire(LOCK_CACHE);
      expect(typeof result).toBe('string');
      expect(result).toContain('violates ordering');
    });
  });
  
  describe('Lock Usage', () => {
    test('useLock_lockIsHeld_executesOperation', () => {
      const ctx = createEmptyLockContext().acquire(LOCK_CACHE);
      
      let executed = false;
      ctx.useLock(LOCK_CACHE, () => {
        executed = true;
      });
      
      expect(executed).toBe(true);
    });
    
    test('useLock_lockNotHeld_returnsError', () => {
      const ctx = createEmptyLockContext().acquire(LOCK_CACHE);
      
      const result = ctx.useLock(LOCK_WORLD, () => {
        // Should not execute
      });
      
      expect(typeof result).toBe('string');
      expect(result).toContain('not held');
    });
    
    test('useLock_multipleLocks_canUseAny', () => {
      const ctx = createEmptyLockContext()
        .acquire(LOCK_CACHE)
        .acquire(LOCK_WORLD)
        .acquire(LOCK_USER);
      
      let cacheUsed = false;
      let worldUsed = false;
      let userUsed = false;
      
      ctx.useLock(LOCK_CACHE, () => { cacheUsed = true; });
      ctx.useLock(LOCK_WORLD, () => { worldUsed = true; });
      ctx.useLock(LOCK_USER, () => { userUsed = true; });
      
      expect(cacheUsed).toBe(true);
      expect(worldUsed).toBe(true);
      expect(userUsed).toBe(true);
    });
  });
  
  describe('Message Lock Levels', () => {
    test('messageLocks_orderedAcquisition_succeeds', () => {
      const ctx = createEmptyLockContext()
        .acquire(LOCK_USER)
        .acquire(LOCK_MESSAGE_READ)
        .acquire(LOCK_MESSAGE_WRITE)
        .acquire(LOCK_DATABASE);
      
      expect(ctx.hasLock(LOCK_USER)).toBe(true);
      expect(ctx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
      expect(ctx.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
      expect(ctx.hasLock(LOCK_DATABASE)).toBe(true);
    });
    
    test('messageLocks_readBeforeWrite_enforced', () => {
      // Can acquire read (34) before write (35)
      const ctx1 = createEmptyLockContext()
        .acquire(LOCK_MESSAGE_READ)
        .acquire(LOCK_MESSAGE_WRITE);
      
      expect(ctx1.hasLock(LOCK_MESSAGE_READ)).toBe(true);
      expect(ctx1.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
      
      // Cannot acquire read after write (wrong order)
      const ctx2 = createEmptyLockContext().acquire(LOCK_MESSAGE_WRITE);
      const result = ctx2.acquire(LOCK_MESSAGE_READ);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('violates ordering');
    });
  });
  
  describe('Context String Representation', () => {
    test('toString_emptyContext_showsEmpty', () => {
      const ctx = createEmptyLockContext();
      expect(ctx.toString()).toBe('LockContext[]');
    });
    
    test('toString_withLocks_showsLevels', () => {
      const ctx = createEmptyLockContext()
        .acquire(LOCK_CACHE)
        .acquire(LOCK_USER);
      
      expect(ctx.toString()).toBe('LockContext[10, 30]');
    });
  });
});

describe('IronGuard Async Adapters', () => {
  
  describe('AsyncMutex', () => {
    test('asyncMutex_basicAcquisition_worksCorrectly', async () => {
      const mutex = new AsyncMutex('test', LOCK_CACHE);
      const ctx = createEmptyLockContext();
      
      const result = await mutex.acquire(ctx, async (lockedCtx) => {
        expect(lockedCtx.hasLock(LOCK_CACHE)).toBe(true);
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(mutex.isLocked()).toBe(false);
    });
    
    test('asyncMutex_serialization_enforcesOrder', async () => {
      const mutex = new AsyncMutex('test', LOCK_CACHE);
      const ctx = createEmptyLockContext();
      const results: number[] = [];
      
      // Start three concurrent operations
      const promises = [
        mutex.acquire(ctx, async () => {
          results.push(1);
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(2);
        }),
        mutex.acquire(ctx, async () => {
          results.push(3);
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(4);
        }),
        mutex.acquire(ctx, async () => {
          results.push(5);
          results.push(6);
        })
      ];
      
      await Promise.all(promises);
      
      // Operations should be serialized
      expect(results).toEqual([1, 2, 3, 4, 5, 6]);
    });
    
    test('asyncMutex_errorHandling_releasesLock', async () => {
      const mutex = new AsyncMutex('test', LOCK_CACHE);
      const ctx = createEmptyLockContext();
      
      try {
        await mutex.acquire(ctx, async () => {
          throw new Error('Test error');
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Test error');
      }
      
      // Lock should be released after error
      expect(mutex.isLocked()).toBe(false);
      
      // Should be able to acquire again
      const result = await mutex.acquire(ctx, async () => 'recovered');
      expect(result).toBe('recovered');
    });
  });
  
  describe('AsyncReadWriteLock', () => {
    test('readWriteLock_multipleReaders_allowedConcurrently', async () => {
      const rwLock = new AsyncReadWriteLock('test', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const ctx = createEmptyLockContext();
      const readCount: number[] = [];
      
      // Start multiple concurrent reads
      const promises = [
        rwLock.acquireRead(ctx, async () => {
          readCount.push(1);
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'read1';
        }),
        rwLock.acquireRead(ctx, async () => {
          readCount.push(2);
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'read2';
        }),
        rwLock.acquireRead(ctx, async () => {
          readCount.push(3);
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'read3';
        })
      ];
      
      const results = await Promise.all(promises);
      
      // All reads should have started concurrently
      expect(readCount.length).toBe(3);
      expect(results).toEqual(['read1', 'read2', 'read3']);
      
      const stats = rwLock.getStats();
      expect(stats.readers).toBe(0);
      expect(stats.writer).toBe(false);
    });
    
    test('readWriteLock_writerBlocksReaders_untilReleased', async () => {
      const rwLock = new AsyncReadWriteLock('test', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const ctx = createEmptyLockContext();
      const order: string[] = [];
      
      // Start write first
      const writePromise = rwLock.acquireWrite(ctx, async () => {
        order.push('write-start');
        await new Promise(resolve => setTimeout(resolve, 20));
        order.push('write-end');
      });
      
      // Small delay to ensure write starts first
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Start read - should wait for write
      const readPromise = rwLock.acquireRead(ctx, async () => {
        order.push('read');
      });
      
      await Promise.all([writePromise, readPromise]);
      
      expect(order).toEqual(['write-start', 'write-end', 'read']);
    });
    
    test('readWriteLock_readersBlockWriter_untilAllReleased', async () => {
      const rwLock = new AsyncReadWriteLock('test', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const ctx = createEmptyLockContext();
      const order: string[] = [];
      
      // Start multiple reads
      const readPromises = [
        rwLock.acquireRead(ctx, async () => {
          order.push('read1-start');
          await new Promise(resolve => setTimeout(resolve, 20));
          order.push('read1-end');
        }),
        rwLock.acquireRead(ctx, async () => {
          order.push('read2-start');
          await new Promise(resolve => setTimeout(resolve, 15));
          order.push('read2-end');
        })
      ];
      
      // Small delay to ensure reads start
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Start write - should wait for all reads
      const writePromise = rwLock.acquireWrite(ctx, async () => {
        order.push('write');
      });
      
      await Promise.all([...readPromises, writePromise]);
      
      expect(order).toEqual(['read1-start', 'read2-start', 'read2-end', 'read1-end', 'write']);
    });
  });
});

describe('IronGuard API Patterns', () => {
  
  describe('Context Passing Through Functions', () => {
    // Helper function that requires user lock
    function needsUserLock<THeld extends readonly (10 | 20 | 30 | 34 | 35 | 40)[]>(
      context: LockContext<THeld>
    ): void {
      // Function should be callable with contexts that have or can acquire LOCK_USER
      const ctx = context.acquire(LOCK_USER);
      if (typeof ctx === 'string') {
        throw new Error(ctx);
      }
      
      ctx.useLock(LOCK_USER, () => {
        // User operation
      });
    }
    
    test('contextPassing_emptyContext_canCallFunction', () => {
      const ctx = createEmptyLockContext();
      needsUserLock(ctx);
    });
    
    test('contextPassing_withCacheLock_canCallFunction', () => {
      const ctx = createEmptyLockContext().acquire(LOCK_CACHE);
      needsUserLock(ctx);
    });
    
    test('contextPassing_withUserLock_canUseExisting', () => {
      const ctx = createEmptyLockContext().acquire(LOCK_USER);
      
      // Function can use existing user lock
      ctx.useLock(LOCK_USER, () => {
        // User operation
      });
    });
  });
  
  describe('API-Style Lock Patterns', () => {
    test('apiPattern_worldWriteToUser_executesCorrectly', async () => {
      const worldLock = new AsyncMutex('world', LOCK_WORLD);
      const userLock = new AsyncMutex('user', LOCK_USER);
      const ctx = createEmptyLockContext();
      
      const result = await worldLock.acquire(ctx, async (worldCtx) => {
        return await userLock.acquire(worldCtx, async (userCtx) => {
          expect(userCtx.hasLock(LOCK_WORLD)).toBe(true);
          expect(userCtx.hasLock(LOCK_USER)).toBe(true);
          return 'success';
        });
      });
      
      expect(result).toBe('success');
    });
    
    test('apiPattern_multipleNestedLocks_maintainsContext', async () => {
      const cacheLock = new AsyncMutex('cache', LOCK_CACHE);
      const worldLock = new AsyncMutex('world', LOCK_WORLD);
      const userLock = new AsyncMutex('user', LOCK_USER);
      const dbLock = new AsyncMutex('database', LOCK_DATABASE);
      const ctx = createEmptyLockContext();
      
      const result = await cacheLock.acquire(ctx, async (cacheCtx) => {
        expect(cacheCtx.hasLock(LOCK_CACHE)).toBe(true);
        
        return await worldLock.acquire(cacheCtx, async (worldCtx) => {
          expect(worldCtx.hasLock(LOCK_CACHE)).toBe(true);
          expect(worldCtx.hasLock(LOCK_WORLD)).toBe(true);
          
          return await userLock.acquire(worldCtx, async (userCtx) => {
            expect(userCtx.hasLock(LOCK_CACHE)).toBe(true);
            expect(userCtx.hasLock(LOCK_WORLD)).toBe(true);
            expect(userCtx.hasLock(LOCK_USER)).toBe(true);
            
            return await dbLock.acquire(userCtx, async (dbCtx) => {
              expect(dbCtx.hasLock(LOCK_CACHE)).toBe(true);
              expect(dbCtx.hasLock(LOCK_WORLD)).toBe(true);
              expect(dbCtx.hasLock(LOCK_USER)).toBe(true);
              expect(dbCtx.hasLock(LOCK_DATABASE)).toBe(true);
              
              return 'all-locks-held';
            });
          });
        });
      });
      
      expect(result).toBe('all-locks-held');
    });
  });
});
