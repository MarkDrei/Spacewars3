import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import type sqlite3 from 'sqlite3';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { World, type SpaceObject } from '@/lib/server/world/world';
import { WorldCache } from '@/lib/server/world/worldCache';

const createMockDb = () => {
  return {
    run: vi.fn(function (_sql: string, _params: unknown[], callback: (err: Error | null) => void) {
      callback(null);
    })
  } as unknown as sqlite3.Database;
};

const createWorld = (db: sqlite3.Database, spaceObjects: SpaceObject[] = []): World => {
  return new World(
    { width: 500, height: 500 },
    spaceObjects,
    async () => {},
    db
  );
};

describe('WorldCache', () => {
  let db: sqlite3.Database;

  beforeEach(() => {
    db = createMockDb();
    WorldCache.resetInstance();
  });

  afterEach(async () => {
    try {
      await WorldCache.getInstance().shutdown();
    } catch {
      // ignore missing initialization
    }
    WorldCache.resetInstance();
  });

  test('initializeWithWorld_setsSingleton', () => {
    const world = createWorld(db);
    WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });

    const cache = WorldCache.getInstance();
    const stats = cache.getStats();

    expect(stats.worldCacheMisses).toBeGreaterThan(0);
    expect(stats.worldCacheHits).toBe(0);
  });

  test('getWorldFromCache_updatesHitCount', async () => {
    const world = createWorld(db);
    WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
    const cache = WorldCache.getInstance();
    const ctx = createLockContext();

    const retrievedWorld = await ctx.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      return cache.getWorldFromCache(worldContext);
    });

    expect(retrievedWorld).toBe(world);
    expect(cache.getStats().worldCacheHits).toBe(1);
  });

  test('updateWorldUnsafe_marksDirty_andFlushPersists', async () => {
    const world = createWorld(db);
    WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
    const cache = WorldCache.getInstance();
    const ctx = createLockContext();

    const updatedWorld = createWorld(db, [
      {
        id: 1,
        type: 'asteroid',
        x: 10,
        y: 20,
        speed: 5,
        angle: 45,
        last_position_update_ms: Date.now()
      }
    ]);

    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      cache.updateWorldUnsafe(worldContext, updatedWorld);
    });

    expect(cache.getStats().worldDirty).toBe(true);

    await cache.flushToDatabase();

    expect(cache.getStats().worldDirty).toBe(false);
  });
});
