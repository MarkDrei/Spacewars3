import { describe, expect, test, beforeEach, vi, afterEach } from 'vitest';
import { MemoryCache, getMemoryCache, resetMemoryCache } from '@/lib/server/memoryCache';
import { User } from '@/lib/server/user';
import { World } from '@/lib/server/world';
import { createInitialTechTree } from '@/lib/server/techtree';

// Mock the locks module to use synchronous implementations for testing
vi.mock('@/lib/server/locks', () => ({
  ReadWriteLock: class {
    async read<T>(fn: () => Promise<T>): Promise<T> { return await fn(); }
    async write<T>(fn: () => Promise<T>): Promise<T> { return await fn(); }
  },
  Mutex: class {
    async acquire<T>(fn: () => Promise<T>): Promise<T> { return await fn(); }
  }
}));

describe('MemoryCache', () => {
  let cache: MemoryCache;
  let mockUser: User;
  let mockWorld: World;
  let mockSaveCallback: any;

  beforeEach(() => {
    resetMemoryCache();
    cache = getMemoryCache();
    
    mockSaveCallback = vi.fn().mockResolvedValue(undefined);
    
    mockUser = new User(
      1,
      'testuser',
      'password_hash',
      1000,
      Date.now(),
      createInitialTechTree(),
      mockSaveCallback
    );

    const mockDb = {} as any;
    mockWorld = new World(
      { width: 500, height: 500 },
      [
        {
          id: 1,
          type: 'asteroid',
          x: 100,
          y: 100,
          speed: 5,
          angle: 0,
          last_position_update_ms: Date.now()
        }
      ],
      mockSaveCallback,
      mockDb
    );
  });

  afterEach(() => {
    resetMemoryCache();
  });

  describe('World Cache Operations', () => {
    test('worldCache_getEmpty_returnsNull', async () => {
      // Act
      const result = await cache.getWorld();

      // Assert
      expect(result).toBeNull();
    });

    test('worldCache_setAndGet_returnsWorld', async () => {
      // Act
      await cache.setWorld(mockWorld);
      const result = await cache.getWorld();

      // Assert
      expect(result).toBe(mockWorld);
      expect(await cache.isWorldDirty()).toBe(false);
    });

    test('worldCache_update_marksDirty', async () => {
      // Arrange
      await cache.setWorld(mockWorld);

      // Act
      await cache.updateWorld(mockWorld);

      // Assert
      expect(await cache.isWorldDirty()).toBe(true);
    });

    test('worldCache_markClean_clearsDirtyFlag', async () => {
      // Arrange
      await cache.setWorld(mockWorld);
      await cache.updateWorld(mockWorld);

      // Act
      await cache.markWorldClean();

      // Assert
      expect(await cache.isWorldDirty()).toBe(false);
    });
  });

  describe('User Cache Operations', () => {
    test('userCache_getEmpty_returnsNull', async () => {
      // Act
      const result = await cache.getUser(1);

      // Assert
      expect(result).toBeNull();
    });

    test('userCache_setAndGet_returnsUser', async () => {
      // Act
      await cache.setUser(mockUser);
      const result = await cache.getUser(1);

      // Assert
      expect(result).toBe(mockUser);
      expect(await cache.isDirtyUser(1)).toBe(false);
    });

    test('userCache_update_marksDirty', async () => {
      // Arrange
      await cache.setUser(mockUser);

      // Act
      await cache.updateUser(mockUser);

      // Assert
      expect(await cache.isDirtyUser(1)).toBe(true);
    });

    test('userCache_markClean_clearsDirtyFlag', async () => {
      // Arrange
      await cache.setUser(mockUser);
      await cache.updateUser(mockUser);

      // Act
      await cache.markUserClean(1);

      // Assert
      expect(await cache.isDirtyUser(1)).toBe(false);
    });

    test('userCache_getAllDirtyUsers_returnsOnlyDirtyUsers', async () => {
      // Arrange
      const user2 = new User(2, 'user2', 'hash', 500, Date.now(), createInitialTechTree(), mockSaveCallback);
      const user3 = new User(3, 'user3', 'hash', 750, Date.now(), createInitialTechTree(), mockSaveCallback);
      
      await cache.setUser(mockUser);     // user 1 - clean
      await cache.setUser(user2);        // user 2 - clean
      await cache.setUser(user3);        // user 3 - clean
      
      await cache.updateUser(mockUser);  // user 1 - dirty
      await cache.updateUser(user3);     // user 3 - dirty
      // user 2 stays clean

      // Act
      const dirtyUsers = await cache.getAllDirtyUsers();

      // Assert
      expect(dirtyUsers).toHaveLength(2);
      expect(dirtyUsers.map(u => u.id).sort()).toEqual([1, 3]);
    });

    test('userCache_multipleUsersWithSameId_usesSameLock', async () => {
      // Arrange
      const user1a = new User(1, 'user1a', 'hash', 100, Date.now(), createInitialTechTree(), mockSaveCallback);
      const user1b = new User(1, 'user1b', 'hash', 200, Date.now(), createInitialTechTree(), mockSaveCallback);

      // Act
      await cache.setUser(user1a);
      await cache.updateUser(user1b);
      const result = await cache.getUser(1);

      // Assert
      expect(result).toBe(user1b); // Latest update should be returned
      expect(await cache.isDirtyUser(1)).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    test('getStats_initialState_returnsEmptyStats', async () => {
      // Act
      const stats = await cache.getStats();

      // Assert
      expect(stats).toEqual({
        userCacheSize: 0,
        worldCacheHits: 0,
        worldCacheMisses: 0,
        userCacheHits: 0,
        userCacheMisses: 0,
        dirtyUsers: 0,
        worldDirty: false
      });
    });

    test('getStats_afterOperations_returnsCorrectStats', async () => {
      // Arrange
      await cache.setWorld(mockWorld);
      await cache.setUser(mockUser);
      await cache.updateUser(mockUser);
      
      // Generate some hits and misses
      await cache.getWorld(); // hit
      await cache.getUser(1); // hit  
      await cache.getUser(2); // miss

      // Act
      const stats = await cache.getStats();

      // Assert
      expect(stats.userCacheSize).toBe(1);
      expect(stats.worldCacheHits).toBe(1);
      expect(stats.worldCacheMisses).toBe(0); // World was set, not missed
      expect(stats.userCacheHits).toBe(1);
      expect(stats.userCacheMisses).toBe(1);
      expect(stats.dirtyUsers).toBe(1);
      expect(stats.worldDirty).toBe(false);
    });

    test('getStats_worldMiss_incrementsMissCount', async () => {
      // Act
      await cache.getWorld(); // miss
      const stats = await cache.getStats();

      // Assert
      expect(stats.worldCacheMisses).toBe(1);
      expect(stats.worldCacheHits).toBe(0);
    });
  });

  describe('Cache Management', () => {
    test('clearCache_withData_clearsAllData', async () => {
      // Arrange
      await cache.setWorld(mockWorld);
      await cache.setUser(mockUser);
      await cache.updateUser(mockUser);

      // Act
      await cache.clearCache();

      // Assert
      expect(await cache.getWorld()).toBeNull();
      expect(await cache.getUser(1)).toBeNull();
      expect(await cache.isDirtyUser(1)).toBe(false);
      expect(await cache.isWorldDirty()).toBe(false);
      
      const stats = await cache.getStats();
      expect(stats.userCacheSize).toBe(0);
      expect(stats.dirtyUsers).toBe(0);
    });

    test('getWorldLock_returnsLockInstance', () => {
      // Act
      const lock = cache.getWorldLock();

      // Assert
      expect(lock).toBeDefined();
      expect(typeof lock.read).toBe('function');
      expect(typeof lock.write).toBe('function');
    });

    test('getUserMutex_returnsMutexInstance', async () => {
      // Act
      const mutex = await cache.getUserMutex(1);

      // Assert
      expect(mutex).toBeDefined();
      expect(typeof mutex.acquire).toBe('function');
    });
  });

  describe('Singleton Behavior', () => {
    test('getMemoryCache_multipleCalls_returnsSameInstance', () => {
      // Act
      const cache1 = getMemoryCache();
      const cache2 = getMemoryCache();

      // Assert
      expect(cache1).toBe(cache2);
    });

    test('resetMemoryCache_afterReset_returnsNewInstance', () => {
      // Arrange
      const cache1 = getMemoryCache();

      // Act
      resetMemoryCache();
      const cache2 = getMemoryCache();

      // Assert
      expect(cache1).not.toBe(cache2);
    });
  });
});
