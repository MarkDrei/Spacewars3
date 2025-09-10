// ---
// Tests for TypeScript Compile-Time Deadlock Prevention System
// Phase 1: Core Type System Validation
// ---

import { describe, expect, test } from 'vitest';
import { 
  TypedMutex, 
  TypedReadWriteLock, 
  createEmptyContext,
  type CacheLevel,
  type WorldLevel,
  type UserLevel,
  type TestValidCacheToWorld,
  type TestValidWorldToUser,
  type TestInvalidUserToWorld,
  type TestInvalidSameLevel
} from '../../lib/server/typedLocks';

describe('Phase 1: Typed Locks Core System', () => {
  
  describe('Type System Validation', () => {
    test('typeValidation_lockOrderingTypes_compileCorrectly', () => {
      // These should compile without errors
      const validCacheToWorld: TestValidCacheToWorld = true;
      const validWorldToUser: TestValidWorldToUser = true;
      
      // These should be false (invalid orderings)
      const invalidUserToWorld: TestInvalidUserToWorld = false;
      const invalidSameLevel: TestInvalidSameLevel = false;
      
      expect(validCacheToWorld).toBe(true);
      expect(validWorldToUser).toBe(true);
      expect(invalidUserToWorld).toBe(false);
      expect(invalidSameLevel).toBe(false);
    });

    test('emptyContext_creation_hasCorrectType', () => {
      const emptyCtx = createEmptyContext();
      
      // Runtime verification that context was created
      expect(emptyCtx).toBeDefined();
      expect(emptyCtx._state).toBeDefined();
      expect(emptyCtx._maxLevel).toBeUndefined();
    });
  });

  describe('TypedMutex Functionality', () => {
    test('typedMutex_basicAcquisition_worksCorrectly', async () => {
      const cacheMutex = new TypedMutex('cache-test', 0 as CacheLevel);
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      const result = await cacheMutex.acquire(emptyCtx, async (cacheCtx: any) => {
        executionOrder.push('cache-acquired');
        expect(cacheCtx._state).toBeDefined();
        return 'success';
      });

      expect(result).toBe('success');
      expect(executionOrder).toEqual(['cache-acquired']);
    });

    test('typedMutex_validLockOrdering_allowsAcquisition', async () => {
      const cacheMutex = new TypedMutex('cache-test', 0 as CacheLevel);
      const worldMutex = new TypedMutex('world-test', 1 as WorldLevel);
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      // Valid ordering: Cache (0) → World (1)
      const result = await cacheMutex.acquire(emptyCtx, async (cacheCtx: any) => {
        executionOrder.push('cache-acquired');
        
        return await worldMutex.acquire(cacheCtx, async (worldCtx: any) => {
          executionOrder.push('world-acquired');
          expect(worldCtx._state).toBeDefined();
          return 'nested-success';
        });
      });

      expect(result).toBe('nested-success');
      expect(executionOrder).toEqual(['cache-acquired', 'world-acquired']);
    });

    test('typedMutex_concurrentAccess_queuesCorrectly', async () => {
      const userMutex = new TypedMutex('user-test', 2 as UserLevel);
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      // Start multiple concurrent acquisitions
      const promises = [
        userMutex.acquire(emptyCtx, async () => {
          executionOrder.push('first');
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'first-result';
        }),
        userMutex.acquire(emptyCtx, async () => {
          executionOrder.push('second');
          return 'second-result';
        }),
        userMutex.acquire(emptyCtx, async () => {
          executionOrder.push('third');
          return 'third-result';
        })
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(['first-result', 'second-result', 'third-result']);
      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });
  });

  describe('TypedReadWriteLock Functionality', () => {
    test('typedReadWriteLock_concurrentReads_allowedSimultaneously', async () => {
      const worldLock = new TypedReadWriteLock('world-test', 1 as WorldLevel);
      const emptyCtx = createEmptyContext();
      let concurrentReads = 0;
      let maxConcurrentReads = 0;

      const readOperation = async (id: string) => {
        return await worldLock.read(emptyCtx, async () => {
          concurrentReads++;
          maxConcurrentReads = Math.max(maxConcurrentReads, concurrentReads);
          
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 20));
          
          concurrentReads--;
          return `read-${id}`;
        });
      };

      // Start multiple concurrent reads
      const promises = [
        readOperation('1'),
        readOperation('2'),
        readOperation('3')
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(['read-1', 'read-2', 'read-3']);
      expect(maxConcurrentReads).toBeGreaterThan(1); // Should allow concurrent reads
    });

    test('typedReadWriteLock_writeExcludesReads_worksCorrectly', async () => {
      const worldLock = new TypedReadWriteLock('world-test', 1 as WorldLevel);
      const emptyCtx = createEmptyContext();
      const executionOrder: string[] = [];

      // Start a write operation
      const writePromise = worldLock.write(emptyCtx, async () => {
        executionOrder.push('write-start');
        await new Promise(resolve => setTimeout(resolve, 30));
        executionOrder.push('write-end');
        return 'write-result';
      });

      // Start read operations while write is in progress
      const readPromise = worldLock.read(emptyCtx, async () => {
        executionOrder.push('read');
        return 'read-result';
      });

      const [writeResult, readResult] = await Promise.all([writePromise, readPromise]);

      expect(writeResult).toBe('write-result');
      expect(readResult).toBe('read-result');
      expect(executionOrder).toEqual(['write-start', 'write-end', 'read']);
    });
  });

  describe('Lock Statistics', () => {
    test('typedMutex_lockStatistics_trackCorrectly', async () => {
      const mutex = new TypedMutex('stats-test', 0 as CacheLevel);
      const emptyCtx = createEmptyContext();

      expect(mutex.isLocked()).toBe(false);
      expect(mutex.getQueueLength()).toBe(0);

      const promise = mutex.acquire(emptyCtx, async () => {
        expect(mutex.isLocked()).toBe(true);
        return 'locked';
      });

      const result = await promise;
      
      expect(result).toBe('locked');
      expect(mutex.isLocked()).toBe(false);
    });

    test('typedReadWriteLock_lockStatistics_trackCorrectly', async () => {
      const rwLock = new TypedReadWriteLock('stats-test', 1 as WorldLevel);
      const emptyCtx = createEmptyContext();

      let initialStats = rwLock.getStats();
      expect(initialStats.readers).toBe(0);
      expect(initialStats.writer).toBe(false);
      expect(initialStats.readQueue).toBe(0);
      expect(initialStats.writeQueue).toBe(0);

      await rwLock.read(emptyCtx, async () => {
        let duringReadStats = rwLock.getStats();
        expect(duringReadStats.readers).toBe(1);
        expect(duringReadStats.writer).toBe(false);
        return 'read-complete';
      });

      let finalStats = rwLock.getStats();
      expect(finalStats.readers).toBe(0);
      expect(finalStats.writer).toBe(false);
    });
  });
});

// Compile-time tests (these should cause TypeScript errors if uncommented)
/*
describe('Compile-Time Error Tests (Uncomment to test)', () => {
  test('invalidLockOrdering_shouldCauseCompileError', async () => {
    const worldMutex = new TypedMutex('world', 1 as WorldLevel);
    const cacheMutex = new TypedMutex('cache', 0 as CacheLevel);
    const emptyCtx = createEmptyContext();

    // This should cause a compile error: trying to acquire cache lock (0) after world lock (1)
    await worldMutex.acquire(emptyCtx, async (worldCtx) => {
      return await cacheMutex.acquire(worldCtx, async (cacheCtx) => {
        return 'should-not-compile';
      });
    });
  });
});
*/
