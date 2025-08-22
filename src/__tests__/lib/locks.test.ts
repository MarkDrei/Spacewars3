import { describe, expect, test, beforeEach } from 'vitest';
import { Mutex, ReadWriteLock, LockManager } from '@/lib/server/locks';

describe('Mutex', () => {
  let mutex: Mutex;

  beforeEach(() => {
    mutex = new Mutex();
  });

  test('mutex_singleOperation_executesImmediately', async () => {
    // Arrange
    let executed = false;

    // Act
    const result = await mutex.acquire(async () => {
      executed = true;
      return 'result';
    });

    // Assert
    expect(executed).toBe(true);
    expect(result).toBe('result');
    expect(mutex.isLocked()).toBe(false);
  });

  test('mutex_concurrentOperations_executesSequentially', async () => {
    // Arrange
    const executionOrder: number[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Act
    const promises = [
      mutex.acquire(async () => {
        await delay(10);
        executionOrder.push(1);
        return 1;
      }),
      mutex.acquire(async () => {
        executionOrder.push(2);
        return 2;
      }),
      mutex.acquire(async () => {
        executionOrder.push(3);
        return 3;
      })
    ];

    const results = await Promise.all(promises);

    // Assert
    expect(results).toEqual([1, 2, 3]);
    expect(executionOrder).toEqual([1, 2, 3]);
    expect(mutex.isLocked()).toBe(false);
    expect(mutex.getQueueLength()).toBe(0);
  });

  test('mutex_operationThrows_releasesLockAndThrows', async () => {
    // Arrange
    const testError = new Error('Test error');

    // Act & Assert
    await expect(mutex.acquire(async () => {
      throw testError;
    })).rejects.toThrow('Test error');

    expect(mutex.isLocked()).toBe(false);

    // Should be able to acquire again
    const result = await mutex.acquire(async () => 'success');
    expect(result).toBe('success');
  });

  test('mutex_queueLength_tracksCorrectly', async () => {
    // Arrange
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let firstStarted = false;

    // Act
    const promise1 = mutex.acquire(async () => {
      firstStarted = true;
      await delay(20);
      return 1;
    });

    // Wait for first operation to start
    while (!firstStarted) {
      await delay(1);
    }

    const promise2 = mutex.acquire(async () => 2);
    const promise3 = mutex.acquire(async () => 3);

    // Assert
    expect(mutex.isLocked()).toBe(true);
    expect(mutex.getQueueLength()).toBe(2);

    await Promise.all([promise1, promise2, promise3]);
    expect(mutex.getQueueLength()).toBe(0);
  });
});

describe('ReadWriteLock', () => {
  let rwLock: ReadWriteLock;

  beforeEach(() => {
    rwLock = new ReadWriteLock();
  });

  test('readWriteLock_multipleReaders_executeConcurrently', async () => {
    // Arrange
    const startTimes: number[] = [];
    const endTimes: number[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Act
    const promises = [
      rwLock.read(async () => {
        startTimes.push(Date.now());
        await delay(10);
        endTimes.push(Date.now());
        return 1;
      }),
      rwLock.read(async () => {
        startTimes.push(Date.now());
        await delay(10);
        endTimes.push(Date.now());
        return 2;
      }),
      rwLock.read(async () => {
        startTimes.push(Date.now());
        await delay(10);
        endTimes.push(Date.now());
        return 3;
      })
    ];

    const results = await Promise.all(promises);

    // Assert
    expect(results).toEqual([1, 2, 3]);
    // All readers should start around the same time (within 5ms)
    const maxStartDiff = Math.max(...startTimes) - Math.min(...startTimes);
    expect(maxStartDiff).toBeLessThan(5);
  });

  test('readWriteLock_writerBlocksReaders_executesExclusively', async () => {
    // Arrange
    const executionOrder: string[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let writerStarted = false;

    // Act
    const writerPromise = rwLock.write(async () => {
      writerStarted = true;
      executionOrder.push('writer-start');
      await delay(20);
      executionOrder.push('writer-end');
      return 'writer';
    });

    // Wait for writer to start
    while (!writerStarted) {
      await delay(1);
    }

    const readerPromises = [
      rwLock.read(async () => {
        executionOrder.push('reader1');
        return 'reader1';
      }),
      rwLock.read(async () => {
        executionOrder.push('reader2');
        return 'reader2';
      })
    ];

    await Promise.all([writerPromise, ...readerPromises]);

    // Assert
    expect(executionOrder).toEqual([
      'writer-start',
      'writer-end',
      'reader1',
      'reader2'
    ]);
  });

  test('readWriteLock_readersBlockWriter_writerWaits', async () => {
    // Arrange
    const executionOrder: string[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let readersStarted = false;

    // Act
    const readerPromises = [
      rwLock.read(async () => {
        readersStarted = true;
        executionOrder.push('reader1-start');
        await delay(20);
        executionOrder.push('reader1-end');
        return 'reader1';
      }),
      rwLock.read(async () => {
        executionOrder.push('reader2-start');
        await delay(20);
        executionOrder.push('reader2-end');
        return 'reader2';
      })
    ];

    // Wait for readers to start
    while (!readersStarted) {
      await delay(1);
    }

    const writerPromise = rwLock.write(async () => {
      executionOrder.push('writer');
      return 'writer';
    });

    await Promise.all([...readerPromises, writerPromise]);

    // Assert
    expect(executionOrder[0]).toBe('reader1-start');
    expect(executionOrder[1]).toBe('reader2-start');
    expect(executionOrder.slice(-3)).toEqual(['reader1-end', 'reader2-end', 'writer']);
  });

  test('readWriteLock_getStats_returnsCorrectInfo', async () => {
    // Arrange
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Act & Assert - Initial state
    let stats = rwLock.getStats();
    expect(stats).toEqual({
      readers: 0,
      writer: false,
      readQueue: 0,
      writeQueue: 0
    });

    // Start readers
    const readerPromises = [
      rwLock.read(async () => {
        await delay(30);
        return 1;
      }),
      rwLock.read(async () => {
        await delay(30);
        return 2;
      })
    ];

    await delay(5); // Let readers start
    stats = rwLock.getStats();
    expect(stats.readers).toBe(2);
    expect(stats.writer).toBe(false);

    await Promise.all(readerPromises);
  });
});

describe('LockManager', () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = new LockManager();
  });

  test('lockManager_getUserLock_returnsSameLockForSameUser', async () => {
    // Act
    const lock1 = await lockManager.getUserLock(1);
    const lock2 = await lockManager.getUserLock(1);
    const lock3 = await lockManager.getUserLock(2);

    // Assert
    expect(lock1).toBe(lock2);
    expect(lock1).not.toBe(lock3);
  });

  test('lockManager_withUserLock_executesWithLock', async () => {
    // Arrange
    let executed = false;

    // Act
    const result = await lockManager.withUserLock(1, async () => {
      executed = true;
      return 'result';
    });

    // Assert
    expect(executed).toBe(true);
    expect(result).toBe('result');
  });

  test('lockManager_withWorldLocks_executeWithCorrectLockType', async () => {
    // Arrange
    let readExecuted = false;
    let writeExecuted = false;

    // Act
    const readResult = await lockManager.withWorldReadLock(async () => {
      readExecuted = true;
      return 'read';
    });

    const writeResult = await lockManager.withWorldWriteLock(async () => {
      writeExecuted = true;
      return 'write';
    });

    // Assert
    expect(readExecuted).toBe(true);
    expect(writeExecuted).toBe(true);
    expect(readResult).toBe('read');
    expect(writeResult).toBe('write');
  });

  test('lockManager_getLockStats_returnsCorrectStats', async () => {
    // Arrange
    await lockManager.getUserLock(1);
    await lockManager.getUserLock(2);

    // Act
    const stats = await lockManager.getLockStats();

    // Assert
    expect(stats.totalUserLocks).toBe(2);
    expect(stats.userLockStats).toHaveLength(2);
    expect(stats.userLockStats[0].userId).toBe(1);
    expect(stats.userLockStats[1].userId).toBe(2);
    expect(stats.worldLockStats.readers).toBe(0);
  });

  test('lockManager_cleanup_clearsAllLocks', async () => {
    // Arrange
    await lockManager.getUserLock(1);
    await lockManager.getUserLock(2);

    // Act
    await lockManager.cleanup();
    const stats = await lockManager.getLockStats();

    // Assert
    expect(stats.totalUserLocks).toBe(0);
    expect(stats.userLockStats).toHaveLength(0);
  });
});
