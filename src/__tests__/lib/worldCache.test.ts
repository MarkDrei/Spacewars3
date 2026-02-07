import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import type { DatabaseConnection } from '@/lib/server/database';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { World, type SpaceObject } from '@/lib/server/world/world';
import { WorldCache } from '@/lib/server/world/worldCache';
import { DEFAULT_WORLD_BOUNDS } from '@shared';

const createMockDb = () => {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
      release: vi.fn()
    }),
    end: vi.fn().mockResolvedValue(undefined)
  } as unknown as DatabaseConnection;
};

const createWorld = (db: DatabaseConnection, spaceObjects: SpaceObject[] = []): World => {
  return new World(
    DEFAULT_WORLD_BOUNDS, // Use shared constants for consistency with production
    spaceObjects,
    async () => {},
    db
  );
};

describe('WorldCache', () => {
  let db: DatabaseConnection;

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
        last_position_update_ms: Date.now(),
        picture_id: 1
      }
    ]);

    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      await cache.updateWorldUnsafe(worldContext, updatedWorld);
    });

    expect(cache.getStats().worldDirty).toBe(true);

    await cache.flushToDatabase();

    expect(cache.getStats().worldDirty).toBe(false);
  });
});
