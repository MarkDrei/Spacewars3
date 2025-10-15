/**
 * IronGuard Lock System Tests
 * 
 * Tests for compile-time lock ordering validation and runtime behavior
 */

import { describe, expect, test } from 'vitest';
import { 
  createLockContext,
  createEmptyContext,
  LOCK_CACHE,
  LOCK_WORLD,
  LOCK_USER,
  LOCK_MESSAGE_READ,
  LOCK_MESSAGE_WRITE,
  LOCK_DATABASE,
  AsyncMutex,
  AsyncReadWriteLock,
} from '../../lib/server/ironGuard';

describe('IronGuard Lock System', () => {
  
  describe('Basic Lock Acquisition', () => {
    test('lockAcquisition_inOrder_succeeds', () => {
      const ctx = createLockContext();
      
      // Acquire locks in order
      const ctx1 = ctx.acquire(LOCK_CACHE);
      expect(typeof ctx1).not.toBe('string');
      if (typeof ctx1 !== 'string') {
        expect(ctx1.hasLock(LOCK_CACHE)).toBe(true);
        
        const ctx2 = ctx1.acquire(LOCK_WORLD);
        expect(typeof ctx2).not.toBe('string');
        if (typeof ctx2 !== 'string') {
          expect(ctx2.hasLock(LOCK_WORLD)).toBe(true);
          
          const ctx3 = ctx2.acquire(LOCK_USER);
          expect(typeof ctx3).not.toBe('string');
          if (typeof ctx3 !== 'string') {
            expect(ctx3.hasLock(LOCK_USER)).toBe(true);
          }
        }
      }
    });

    test('lockAcquisition_skipIntermediate_succeeds', () => {
      const ctx = createLockContext();
      
      // Skip from 10 directly to 30
      const ctx1 = ctx.acquire(LOCK_CACHE);
      expect(typeof ctx1).not.toBe('string');
      if (typeof ctx1 !== 'string') {
        const ctx2 = ctx1.acquire(LOCK_USER);
        
        expect(typeof ctx2).not.toBe('string');
        if (typeof ctx2 !== 'string') {
          expect(ctx2.hasLock(LOCK_CACHE)).toBe(true);
          expect(ctx2.hasLock(LOCK_USER)).toBe(true);
          expect(ctx2.hasLock(LOCK_WORLD)).toBe(false);
        }
      }
    });

    test('lockAcquisition_directHighLevel_succeeds', () => {
      const ctx = createLockContext();
      
      // Directly acquire lock 30 without holding any others
      const ctx1 = ctx.acquire(LOCK_USER);
      
      expect(typeof ctx1).not.toBe('string');
      if (typeof ctx1 !== 'string') {
        expect(ctx1.hasLock(LOCK_USER)).toBe(true);
      }
    });
  });

  describe('Lock Ordering Validation', () => {
    test('lockValidation_preventsDuplicateAcquisition_atRuntime', () => {
      const ctx = createLockContext();
      const ctx1 = ctx.acquire(LOCK_CACHE);
      
      // Try to acquire same lock again (runtime check)
      if (typeof ctx1 !== 'string') {
        const result = ctx1.acquire(LOCK_CACHE);
        expect(typeof result).toBe('string');
        if (typeof result === 'string') {
          expect(result).toContain('already held');
        }
      }
    });

    test('lockValidation_preventsReverseOrder_atRuntime', () => {
      const ctx = createLockContext();
      const ctx1 = ctx.acquire(LOCK_USER);
      
      // Try to acquire lower level lock (runtime check)
      if (typeof ctx1 !== 'string') {
        const result = ctx1.acquire(LOCK_WORLD);
        expect(typeof result).toBe('string');
        if (typeof result === 'string') {
          expect(result).toContain('violates ordering');
        }
      }
    });
  });

  describe('Multiple Lock Holdings', () => {
    test('lockContext_holdsMultipleLocks_canCheckEach', () => {
      const ctx1 = createLockContext().acquire(LOCK_CACHE);
      if (typeof ctx1 === 'string') return;
      const ctx2 = ctx1.acquire(LOCK_WORLD);
      if (typeof ctx2 === 'string') return;
      const ctx = ctx2.acquire(LOCK_USER);
      if (typeof ctx === 'string') return;
      
      expect(ctx.hasLock(LOCK_CACHE)).toBe(true);
      expect(ctx.hasLock(LOCK_WORLD)).toBe(true);
      expect(ctx.hasLock(LOCK_USER)).toBe(true);
      expect(ctx.hasLock(LOCK_DATABASE)).toBe(false);
    });

    test('lockContext_holdsMultipleLocks_canUseAny', () => {
      const ctx1 = createLockContext().acquire(LOCK_CACHE);
      if (typeof ctx1 === 'string') return;
      const ctx2 = ctx1.acquire(LOCK_WORLD);
      if (typeof ctx2 === 'string') return;
      const ctx = ctx2.acquire(LOCK_USER);
      if (typeof ctx === 'string') return;
      
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

  describe('Context Passing Through Functions', () => {
    test('lockContext_passedToFunction_maintainsState', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function requiresUserLock(context: any): void {
        expect(context.hasLock(LOCK_USER)).toBe(true);
      }
      
      const ctx = createLockContext().acquire(LOCK_USER);
      if (typeof ctx !== 'string') {
        requiresUserLock(ctx);
      }
    });

    test('lockContext_passedThrough_canAcquireMore', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function intermediate(context: any): any {
        // Intermediate function can acquire more locks
        return context.acquire(LOCK_DATABASE);
      }
      
      const ctx1 = createLockContext().acquire(LOCK_USER);
      if (typeof ctx1 === 'string') return;
      
      const ctx2 = intermediate(ctx1);
      
      expect(typeof ctx2).not.toBe('string');
      if (typeof ctx2 !== 'string') {
        expect(ctx2.hasLock(LOCK_USER)).toBe(true);
        expect(ctx2.hasLock(LOCK_DATABASE)).toBe(true);
      }
    });
  });

  describe('ReadWrite Lock Pattern', () => {
    test('readWritePattern_separateLevels_maintainsOrdering', () => {
      const readCtx = createLockContext().acquire(LOCK_MESSAGE_READ);
      const writeCtx = createLockContext().acquire(LOCK_MESSAGE_WRITE);
      
      expect(typeof readCtx).not.toBe('string');
      expect(typeof writeCtx).not.toBe('string');
      if (typeof readCtx !== 'string') {
        expect(readCtx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
      }
      if (typeof writeCtx !== 'string') {
        expect(writeCtx.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
      }
    });

    test('readWritePattern_cannotDowngrade_fromWriteToRead', () => {
      const writeCtx = createLockContext().acquire(LOCK_MESSAGE_WRITE);
      if (typeof writeCtx === 'string') return;
      
      // Try to acquire read lock after write lock (should fail)
      const result = writeCtx.acquire(LOCK_MESSAGE_READ);
      expect(typeof result).toBe('string');
      if (typeof result === 'string') {
        expect(result).toContain('violates ordering');
      }
    });
  });

  describe('Empty Context Compatibility', () => {
    test('createEmptyContext_createsValidContext', () => {
      const ctx = createEmptyContext();
      
      expect(ctx).toBeDefined();
      expect(ctx.getHeldLocks()).toEqual([]);
    });

    test('createEmptyContext_canAcquireLocks', () => {
      const ctx = createEmptyContext();
      const ctx1 = ctx.acquire(LOCK_CACHE);
      
      expect(typeof ctx1).not.toBe('string');
      if (typeof ctx1 !== 'string') {
        expect(ctx1.hasLock(LOCK_CACHE)).toBe(true);
      }
    });
  });

  describe('AsyncMutex', () => {
    test('asyncMutex_singleAcquisition_succeeds', async () => {
      const mutex = new AsyncMutex('test-cache', LOCK_CACHE);
      const emptyCtx = createLockContext();
      
      const result = await mutex.acquire(emptyCtx, async (ctx) => {
        expect(ctx.hasLock(LOCK_CACHE)).toBe(true);
        return 'success';
      });
      
      expect(result).toBe('success');
    });

    test('asyncMutex_serialization_maintainsOrder', async () => {
      const mutex = new AsyncMutex('test-cache', LOCK_CACHE);
      const emptyCtx = createLockContext();
      const executionOrder: number[] = [];
      
      // Launch 3 concurrent operations
      const promises = [
        mutex.acquire(emptyCtx, async () => {
          executionOrder.push(1);
          await new Promise(resolve => setTimeout(resolve, 10));
          return 1;
        }),
        mutex.acquire(emptyCtx, async () => {
          executionOrder.push(2);
          return 2;
        }),
        mutex.acquire(emptyCtx, async () => {
          executionOrder.push(3);
          return 3;
        }),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toEqual([1, 2, 3]);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    test('asyncMutex_chainedAcquisition_maintainsLockOrdering', async () => {
      const cacheMutex = new AsyncMutex('cache', LOCK_CACHE);
      const userMutex = new AsyncMutex('user', LOCK_USER);
      const emptyCtx = createLockContext();
      
      const result = await cacheMutex.acquire(emptyCtx, async (cacheCtx) => {
        return await userMutex.acquire(cacheCtx, async (userCtx) => {
          expect(userCtx.hasLock(LOCK_CACHE)).toBe(true);
          expect(userCtx.hasLock(LOCK_USER)).toBe(true);
          return 'chained-success';
        });
      });
      
      expect(result).toBe('chained-success');
    });
  });

  describe('AsyncReadWriteLock', () => {
    test('asyncRWLock_readOperation_succeeds', async () => {
      const rwLock = new AsyncReadWriteLock('message', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const emptyCtx = createLockContext();
      
      const result = await rwLock.read(emptyCtx, async (ctx) => {
        expect(ctx.hasLock(LOCK_MESSAGE_READ)).toBe(true);
        return 'read-success';
      });
      
      expect(result).toBe('read-success');
    });

    test('asyncRWLock_writeOperation_succeeds', async () => {
      const rwLock = new AsyncReadWriteLock('message', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const emptyCtx = createLockContext();
      
      const result = await rwLock.write(emptyCtx, async (ctx) => {
        expect(ctx.hasLock(LOCK_MESSAGE_WRITE)).toBe(true);
        return 'write-success';
      });
      
      expect(result).toBe('write-success');
    });

    test('asyncRWLock_multipleReaders_concurrent', async () => {
      const rwLock = new AsyncReadWriteLock('message', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const emptyCtx = createLockContext();
      const startTimes: number[] = [];
      
      // Launch 3 concurrent read operations
      const promises = [1, 2, 3].map(i =>
        rwLock.read(emptyCtx, async () => {
          startTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));
          return i;
        })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toEqual([1, 2, 3]);
      // All readers should start roughly at the same time (within 5ms)
      const timeSpread = Math.max(...startTimes) - Math.min(...startTimes);
      expect(timeSpread).toBeLessThan(5);
    });

    test('asyncRWLock_writeBlocksReaders_serialization', async () => {
      const rwLock = new AsyncReadWriteLock('message', LOCK_MESSAGE_READ, LOCK_MESSAGE_WRITE);
      const emptyCtx = createLockContext();
      const executionOrder: string[] = [];
      
      // Start a write operation
      const writePromise = rwLock.write(emptyCtx, async () => {
        executionOrder.push('write-start');
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push('write-end');
        return 'write';
      });
      
      // Wait a bit to ensure write starts first
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Start a read operation (should be queued)
      const readPromise = rwLock.read(emptyCtx, async () => {
        executionOrder.push('read');
        return 'read';
      });
      
      await Promise.all([writePromise, readPromise]);
      
      expect(executionOrder).toEqual(['write-start', 'write-end', 'read']);
    });
  });

  describe('Type System Documentation', () => {
    test('typeSystemValidation_documentsExpectedBehavior', () => {
      // This test documents the expected compile-time behavior
      // The actual validation happens at compile time
      
      // ✅ Valid patterns (these compile)
      const valid1 = createLockContext().acquire(LOCK_CACHE);
      expect(typeof valid1).not.toBe('string');
      
      if (typeof valid1 !== 'string') {
        const valid2 = valid1.acquire(LOCK_WORLD);
        expect(typeof valid2).not.toBe('string');
        
        if (typeof valid2 !== 'string') {
          const valid3 = valid2.acquire(LOCK_USER);
          expect(typeof valid3).not.toBe('string');
        }
      }
      
      // ❌ Invalid patterns (these would cause compile errors if types were wrong)
      // const invalid1 = createLockContext().acquire(LOCK_USER).acquire(LOCK_WORLD);
      // const invalid2 = createLockContext().acquire(LOCK_DATABASE).acquire(LOCK_CACHE);
      
      // Runtime validation catches ordering violations
      const ctx = createLockContext().acquire(LOCK_USER);
      if (typeof ctx !== 'string') {
        const result = ctx.acquire(LOCK_WORLD);
        expect(typeof result).toBe('string');
      }
    });
  });
});
