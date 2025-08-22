import { describe, expect, test, beforeEach, vi, afterEach } from 'vitest';
import { CacheManager, getCacheManager, resetCacheManager } from '@/lib/server/cacheManager';
import { User } from '@/lib/server/user';
import { World } from '@/lib/server/world';
import { createInitialTechTree } from '@/lib/server/techtree';
import { loadWorldFromDb, saveWorldToDb } from '@/lib/server/worldRepo';
import { getUserByIdFromDb, saveUserToDb } from '@/lib/server/userRepo';

// Mock dependencies
vi.mock('@/lib/server/memoryCache', () => ({
  getMemoryCache: vi.fn(() => mockMemoryCache),
  MemoryCache: vi.fn()
}));

vi.mock('@/lib/server/locks', () => ({
  getLockManager: vi.fn(() => mockLockManager),
  LockManager: vi.fn()
}));

vi.mock('@/lib/server/database', () => ({
  getDatabase: vi.fn(() => mockDatabase)
}));

vi.mock('@/lib/server/worldRepo', () => ({
  loadWorldFromDb: vi.fn(),
  saveWorldToDb: vi.fn(() => mockSaveWorldCallback)
}));

vi.mock('@/lib/server/userRepo', () => ({
  getUserByIdFromDb: vi.fn(),
  saveUserToDb: vi.fn(() => mockSaveUserCallback)
}));

// Mock implementations
const mockMemoryCache = {
  setWorld: vi.fn(),
  getWorld: vi.fn(),
  updateWorld: vi.fn(),
  isWorldDirty: vi.fn(),
  markWorldClean: vi.fn(),
  getUser: vi.fn(),
  setUser: vi.fn(),
  updateUser: vi.fn(),
  isDirtyUser: vi.fn(),
  markUserClean: vi.fn(),
  getAllDirtyUsers: vi.fn(),
  getStats: vi.fn(),
  clearCache: vi.fn(),
  getWorldLock: vi.fn(),
  getUserMutex: vi.fn()
};

const mockLockManager = {
  cleanup: vi.fn(),
  getLockStats: vi.fn()
};

const mockDatabase = {};

const mockSaveWorldCallback = vi.fn();
const mockSaveUserCallback = vi.fn();

const mockLoadWorld = vi.fn();
const mockGetUserById = vi.fn();

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockUser: User;
  let mockWorld: World;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    resetCacheManager();
    
    // Setup mock user and world
    const mockSaveCallback = vi.fn();
    mockUser = new User(1, 'testuser', 'hash', 1000, Date.now(), createInitialTechTree(), mockSaveCallback);
    
    const mockDb = {} as any;
    mockWorld = new World(
      { width: 500, height: 500 },
      [{ id: 1, type: 'asteroid', x: 100, y: 100, speed: 5, angle: 0, last_position_update_ms: Date.now() }],
      mockSaveCallback,
      mockDb
    );

    // Setup mock implementations  
    vi.mocked(loadWorldFromDb).mockResolvedValue(mockWorld);
    vi.mocked(getUserByIdFromDb).mockResolvedValue(mockUser);

    cacheManager = getCacheManager({
      persistenceIntervalMs: 100, // Fast for testing
      enableAutoPersistence: false, // Disable auto persistence for controlled testing
      logStats: false
    });
  });

  afterEach(() => {
    resetCacheManager();
  });

  describe('Initialization', () => {
    test('initialize_firstTime_loadsWorldIntoCache', async () => {
      // Arrange
      vi.mocked(loadWorldFromDb).mockResolvedValue(mockWorld);

      // Act
      await cacheManager.initialize();

      // Assert
      expect(loadWorldFromDb).toHaveBeenCalledWith(mockDatabase, expect.any(Function));
      expect(mockMemoryCache.setWorld).toHaveBeenCalledWith(mockWorld);
    });

    test('initialize_alreadyInitialized_doesNotReinitialize', async () => {
      // Arrange
      await cacheManager.initialize();
      vi.clearAllMocks();

      // Act
      await cacheManager.initialize();

      // Assert
      expect(mockMemoryCache.setWorld).not.toHaveBeenCalled();
    });

    test('initialize_worldLoadFails_throwsError', async () => {
      // Arrange
      const testError = new Error('Database error');
      vi.mocked(loadWorldFromDb).mockRejectedValue(testError);

      // Act & Assert
      await expect(cacheManager.initialize()).rejects.toThrow('Database error');
    });
  });

  describe('World Operations', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
      vi.clearAllMocks();
    });

    test('getWorld_cacheHit_returnsCachedWorld', async () => {
      // Arrange
      mockMemoryCache.getWorld.mockResolvedValue(mockWorld);

      // Act
      const result = await cacheManager.getWorld();

      // Assert
      expect(result).toBe(mockWorld);
      expect(mockMemoryCache.getWorld).toHaveBeenCalled();
    });

    test('getWorld_cacheMiss_loadsFromDatabase', async () => {
      // Arrange
      mockMemoryCache.getWorld.mockResolvedValue(null);
      vi.mocked(loadWorldFromDb).mockResolvedValue(mockWorld);

      // Act
      const result = await cacheManager.getWorld();

      // Assert
      expect(result).toBe(mockWorld);
      expect(loadWorldFromDb).toHaveBeenCalled();
      expect(mockMemoryCache.setWorld).toHaveBeenCalledWith(mockWorld);
    });

    test('updateWorld_updatesCache', async () => {
      // Act
      await cacheManager.updateWorld(mockWorld);

      // Assert
      expect(mockMemoryCache.updateWorld).toHaveBeenCalledWith(mockWorld);
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
      vi.clearAllMocks();
    });

    test('getUser_cacheHit_returnsCachedUser', async () => {
      // Arrange
      mockMemoryCache.getUser.mockResolvedValue(mockUser);

      // Act
      const result = await cacheManager.getUser(1);

      // Assert
      expect(result).toBe(mockUser);
      expect(mockMemoryCache.getUser).toHaveBeenCalledWith(1);
    });

    test('getUser_cacheMiss_loadsFromDatabase', async () => {
      // Arrange
      mockMemoryCache.getUser.mockResolvedValue(null);
      vi.mocked(getUserByIdFromDb).mockResolvedValue(mockUser);

      // Act
      const result = await cacheManager.getUser(1);

      // Assert
      expect(result).toBe(mockUser);
      expect(getUserByIdFromDb).toHaveBeenCalledWith(mockDatabase, 1, expect.any(Function));
      expect(mockMemoryCache.setUser).toHaveBeenCalledWith(mockUser);
    });

    test('getUser_cacheMissUserNotFound_returnsNull', async () => {
      // Arrange
      mockMemoryCache.getUser.mockResolvedValue(null);
      vi.mocked(getUserByIdFromDb).mockResolvedValue(null);

      // Act
      const result = await cacheManager.getUser(999);

      // Assert
      expect(result).toBeNull();
      expect(mockMemoryCache.setUser).not.toHaveBeenCalled();
    });

    test('updateUser_updatesCache', async () => {
      // Act
      await cacheManager.updateUser(mockUser);

      // Assert
      expect(mockMemoryCache.updateUser).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('Persistence Operations', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
      vi.clearAllMocks();
    });

    test('persistDirtyData_dirtyWorldAndUsers_persistsBoth', async () => {
      // Arrange
      mockMemoryCache.isWorldDirty.mockResolvedValue(true);
      mockMemoryCache.getWorld.mockResolvedValue(mockWorld);
      mockMemoryCache.getAllDirtyUsers.mockResolvedValue([mockUser]);

      // Act
      await cacheManager.persistDirtyData();

      // Assert
      expect(mockSaveWorldCallback).toHaveBeenCalledWith(mockWorld);
      expect(mockSaveUserCallback).toHaveBeenCalledWith(mockUser);
      expect(mockMemoryCache.markWorldClean).toHaveBeenCalled();
      expect(mockMemoryCache.markUserClean).toHaveBeenCalledWith(mockUser.id);
    });

    test('persistDirtyData_cleanData_doesNotPersist', async () => {
      // Arrange
      mockMemoryCache.isWorldDirty.mockResolvedValue(false);
      mockMemoryCache.getAllDirtyUsers.mockResolvedValue([]);

      // Act
      await cacheManager.persistDirtyData();

      // Assert
      expect(mockSaveWorldCallback).not.toHaveBeenCalled();
      expect(mockSaveUserCallback).not.toHaveBeenCalled();
    });

    test('persistDirtyData_persistenceError_doesNotThrow', async () => {
      // Arrange
      mockMemoryCache.isWorldDirty.mockResolvedValue(true);
      mockMemoryCache.getWorld.mockResolvedValue(mockWorld);
      mockSaveWorldCallback.mockRejectedValue(new Error('Persistence error'));

      // Act & Assert
      await expect(cacheManager.persistDirtyData()).resolves.not.toThrow();
    });
  });

  describe('Lock Access', () => {
    test('getWorldLock_returnsWorldLock', () => {
      // Arrange
      const mockLock = { read: vi.fn(), write: vi.fn() };
      mockMemoryCache.getWorldLock.mockReturnValue(mockLock);

      // Act
      const result = cacheManager.getWorldLock();

      // Assert
      expect(result).toBe(mockLock);
    });

    test('getUserMutex_returnsUserMutex', async () => {
      // Arrange
      const mockMutex = { acquire: vi.fn() };
      mockMemoryCache.getUserMutex.mockResolvedValue(mockMutex);

      // Act
      const result = await cacheManager.getUserMutex(1);

      // Assert
      expect(result).toBe(mockMutex);
      expect(mockMemoryCache.getUserMutex).toHaveBeenCalledWith(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
      vi.clearAllMocks();
    });

    test('getStats_returnsCompleteStats', async () => {
      // Arrange
      const mockCacheStats = { userCacheSize: 5, worldDirty: true };
      const mockLockStats = { totalUserLocks: 3 };
      
      mockMemoryCache.getStats.mockResolvedValue(mockCacheStats);
      
      mockLockManager.getLockStats.mockResolvedValue(mockLockStats);      // Act
      const stats = await cacheManager.getStats();

      // Assert
      expect(stats).toEqual({
        cache: mockCacheStats,
        locks: mockLockStats,
        initialized: true,
        shuttingDown: false,
        autoPersistence: false // We disabled it in config
      });
    });
  });

  describe('Shutdown', () => {
    test('shutdown_initialized_performsCleanShutdown', async () => {
      // Arrange
      await cacheManager.initialize();
      mockMemoryCache.isWorldDirty.mockResolvedValue(false);
      mockMemoryCache.getAllDirtyUsers.mockResolvedValue([]);

      // Act
      await cacheManager.shutdown();

      // Assert
      expect(mockMemoryCache.clearCache).toHaveBeenCalled();
      expect(mockLockManager.cleanup).toHaveBeenCalled();
    });

    test('shutdown_notInitialized_doesNothing', async () => {
      // Act
      await cacheManager.shutdown();

      // Assert
      expect(mockMemoryCache.clearCache).not.toHaveBeenCalled();
    });

    test('shutdown_withDirtyData_persistsBeforeShutdown', async () => {
      // Arrange
      await cacheManager.initialize();
      mockMemoryCache.isWorldDirty.mockResolvedValue(true);
      mockMemoryCache.getWorld.mockResolvedValue(mockWorld);
      mockMemoryCache.getAllDirtyUsers.mockResolvedValue([mockUser]);
      
      // Make sure the save callbacks succeed this time
      mockSaveWorldCallback.mockResolvedValue(undefined);
      mockSaveUserCallback.mockResolvedValue(undefined);

      // Act
      await cacheManager.shutdown();

      // Assert
      expect(mockSaveWorldCallback).toHaveBeenCalledWith(mockWorld);
      expect(mockSaveUserCallback).toHaveBeenCalledWith(mockUser);
      expect(mockMemoryCache.clearCache).toHaveBeenCalled();
    });
  });

  describe('Force Operations', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
      vi.clearAllMocks();
    });

    test('forceRefreshWorld_loadsFromDatabaseAndUpdatesCache', async () => {
      // Arrange
      vi.mocked(loadWorldFromDb).mockResolvedValue(mockWorld);

      // Act
      await cacheManager.forceRefreshWorld();

      // Assert
      expect(loadWorldFromDb).toHaveBeenCalled();
      expect(mockMemoryCache.setWorld).toHaveBeenCalledWith(mockWorld);
    });

    test('forceRefreshUser_loadsFromDatabaseAndUpdatesCache', async () => {
      // Arrange
      vi.mocked(getUserByIdFromDb).mockResolvedValue(mockUser);

      // Act
      await cacheManager.forceRefreshUser(1);

      // Assert
      expect(getUserByIdFromDb).toHaveBeenCalledWith(mockDatabase, 1, expect.any(Function));
      expect(mockMemoryCache.setUser).toHaveBeenCalledWith(mockUser);
    });

    test('forceRefreshUser_userNotFound_doesNotUpdateCache', async () => {
      // Arrange
      vi.mocked(getUserByIdFromDb).mockResolvedValue(null);

      // Act
      await cacheManager.forceRefreshUser(999);

      // Assert
      expect(mockMemoryCache.setUser).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Behavior', () => {
    test('getCacheManager_multipleCalls_returnsSameInstance', () => {
      // Act
      const manager1 = getCacheManager();
      const manager2 = getCacheManager();

      // Assert
      expect(manager1).toBe(manager2);
    });

    test('resetCacheManager_afterReset_returnsNewInstance', () => {
      // Arrange
      const manager1 = getCacheManager();

      // Act
      resetCacheManager();
      const manager2 = getCacheManager();

      // Assert
      expect(manager1).not.toBe(manager2);
    });
  });
});
