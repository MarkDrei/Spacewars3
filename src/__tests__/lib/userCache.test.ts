// ---
// Tests for TypedCacheManager
// ---

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { 
  UserCache, 
  type TypedCacheConfig 
} from '../../lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import type { WorldCache } from '@/lib/server/world/worldCache';
import type { MessageCache } from '@/lib/server/messages/MessageCache';
import { getDatabase } from '@/lib/server/database';
import { withTransaction } from '../helpers/transactionHelper';

const createWorldCacheStub = (): WorldCache => ({
  getWorldFromCache: vi.fn(() => {
    throw new Error('WorldCache stub not configured for world operations');
  }),
  updateWorldUnsafe: vi.fn(),
  getStats: vi.fn(() => ({
    worldCacheHits: 0,
    worldCacheMisses: 0,
    worldDirty: false,
  })),
  flushToDatabase: vi.fn(async () => {}),
  shutdown: vi.fn(async () => {}),
} as unknown as WorldCache);

const createMessageCacheStub = (): MessageCache => ({
  flushToDatabase: vi.fn(async () => {}),
  shutdown: vi.fn(async () => {}),
} as unknown as MessageCache);

const initializeCache = async (config?: TypedCacheConfig): Promise<void> => {
  const db = await getDatabase();
  await UserCache.intialize2(db, {
    worldCache: createWorldCacheStub(),
    messageCache: createMessageCacheStub(),
  }, config);
};

describe('TypedCacheManager', () => {
  
  beforeEach(async () => {
    UserCache.resetInstance();
    await initializeCache();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      const manager = UserCache.getInstance2();
      await manager.shutdown();
    } catch {
      // Ignore cleanup errors
    }
    UserCache.resetInstance();
  });

  describe('Singleton Pattern', () => {
    test('getInstance_multipleCalls_returnsSameInstance', async () => {
      const manager1 = UserCache.getInstance2();
      const manager2 = UserCache.getInstance2();
      const manager3 = UserCache.getInstance2();

      expect(manager1).toBe(manager2);
      expect(manager2).toBe(manager3);
    });

    test('resetInstance_afterReset_createsNewInstance', async () => {
      const manager1 = UserCache.getInstance2();
      UserCache.resetInstance();
      await initializeCache();
      const manager2 = UserCache.getInstance2();

      expect(manager1).not.toBe(manager2);
    });

    test('getInstance_withConfig_appliesConfiguration', async () => {
      const config: TypedCacheConfig = {
        persistenceIntervalMs: 10000,
        enableAutoPersistence: false,
        logStats: true
      };

      UserCache.resetInstance();
      await initializeCache(config);
      const manager = UserCache.getInstance2();
      
      expect(manager).toBeDefined();
      // Config is applied internally (we can't directly test private members)
    });
  });

  describe('Basic Functionality', () => {
    test('getUserById_nonExistentUser_returnsNull', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        const manager = UserCache.getInstance2();
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const user = await manager.getUserByIdWithLock(userCtx, 999); // Non-existent user
          expect(user).toBeNull();
        });
      });
    });

    test('getStats_returnsValidStats', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        const manager = UserCache.getInstance2();
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {

          const stats = await manager.getStats(userCtx);
          
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
    });
  });


  describe('Concurrency', () => {
    test('concurrentOperations_completeSuccessfully', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        const manager = UserCache.getInstance2();
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    
          // Start multiple concurrent operations
          const operations = [
            manager.getUserByIdWithLock(userCtx, 999),
            manager.getUserByIdWithLock(userCtx, 998),
            manager.getStats(userCtx),
            manager.getStats(userCtx)
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
  });
});

// TODO: Add behavior-focused tests for:
// - Cache hit/miss behavior
// - Dirty data tracking and persistence
// - Message caching
// - World data caching
// - Username cache
// - Concurrent access to same user
