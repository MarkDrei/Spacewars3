import { describe, expect, test, beforeEach, vi } from 'vitest';
import { World, SpaceObject } from '@/lib/server/world/world';
import type { DatabaseConnection } from '@/lib/server/database';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { WORLD_LOCK } from '@/lib/server/typedLocks';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

const createMockDb = () =>
  ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DatabaseConnection;

const worldSize = { width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT };

function createShip(overrides: Partial<SpaceObject> = {}): SpaceObject {
  return {
    id: 1,
    type: 'player_ship',
    x: 100,
    y: 100,
    speed: 50,
    angle: 0,
    last_position_update_ms: 1000,
    picture_id: 1,
    ...overrides,
  };
}

describe('World Afterburner Physics', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    db = createMockDb();
    TimeMultiplierService.resetInstance();
  });

  test('updatePhysics_noAfterburner_normalUpdate', async () => {
    const ship = createShip({ speed: 25, last_position_update_ms: 0 });
    const world = new World(worldSize, [ship], async () => {}, db);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
      world.updatePhysics(worldCtx, 1000);

      const updatedShip = world.spaceObjects[0];
      expect(updatedShip.speed).toBe(25);
      expect(updatedShip.afterburner_boosted_speed).toBeUndefined();
    });
  });

  test('updatePhysics_afterburnerActiveNotExpired_keepsAfterburnerState', async () => {
    const ship = createShip({
      speed: 75,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 75,
      afterburner_cooldown_end_ms: 5000,
      afterburner_old_max_speed: 50,
    });
    const world = new World(worldSize, [ship], async () => {}, db);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
      world.updatePhysics(worldCtx, 3000); // Before cooldown ends at 5000

      const updatedShip = world.spaceObjects[0];
      expect(updatedShip.speed).toBe(75); // Still at boosted speed
      expect(updatedShip.afterburner_boosted_speed).toBe(75);
      expect(updatedShip.afterburner_cooldown_end_ms).toBe(5000);
    });
  });

  test('updatePhysics_afterburnerCooldownExpires_restoresOldMaxSpeed', async () => {
    const ship = createShip({
      speed: 75,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 75,
      afterburner_cooldown_end_ms: 3000,
      afterburner_old_max_speed: 50,
    });
    const world = new World(worldSize, [ship], async () => {}, db);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
      world.updatePhysics(worldCtx, 5000); // After cooldown ends at 3000

      const updatedShip = world.spaceObjects[0];
      expect(updatedShip.speed).toBe(50); // Restored to old max speed
      expect(updatedShip.afterburner_boosted_speed).toBeNull();
      expect(updatedShip.afterburner_cooldown_end_ms).toBeNull();
      expect(updatedShip.afterburner_old_max_speed).toBeNull();
    });
  });

  test('updatePhysics_afterburnerExpires_respectsLowerManualSpeed', async () => {
    const ship = createShip({
      speed: 30, // Player manually slowed down during boost
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 75,
      afterburner_cooldown_end_ms: 3000,
      afterburner_old_max_speed: 50,
    });
    const world = new World(worldSize, [ship], async () => {}, db);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
      world.updatePhysics(worldCtx, 5000);

      const updatedShip = world.spaceObjects[0];
      // Speed was 30, less than old max 50, so it stays at 30
      expect(updatedShip.speed).toBe(30);
      expect(updatedShip.afterburner_boosted_speed).toBeNull();
    });
  });

  test('updatePhysics_multipleShipsDifferentStates_handlesEachCorrectly', async () => {
    const ship1 = createShip({
      id: 1,
      speed: 75,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 75,
      afterburner_cooldown_end_ms: 3000,
      afterburner_old_max_speed: 50,
    });
    const ship2 = createShip({
      id: 2,
      speed: 25,
      x: 200,
      y: 200,
      last_position_update_ms: 1000,
      // No afterburner active
    });
    const asteroid: SpaceObject = {
      id: 3,
      type: 'asteroid',
      x: 500,
      y: 500,
      speed: 5,
      angle: 45,
      last_position_update_ms: 1000,
      picture_id: 1,
    };
    const world = new World(worldSize, [ship1, ship2, asteroid], async () => {}, db);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
      world.updatePhysics(worldCtx, 5000);

      // Ship1: afterburner expired, speed restored
      const updatedShip1 = world.spaceObjects.find(o => o.id === 1)!;
      expect(updatedShip1.speed).toBe(50);
      expect(updatedShip1.afterburner_boosted_speed).toBeNull();

      // Ship2: normal, no afterburner change
      const updatedShip2 = world.spaceObjects.find(o => o.id === 2)!;
      expect(updatedShip2.speed).toBe(25);

      // Asteroid: normal update
      const updatedAsteroid = world.spaceObjects.find(o => o.id === 3)!;
      expect(updatedAsteroid.speed).toBe(5);
    });
  });

  test('updatePhysics_afterburnerAlreadyExpiredBefore_clearsState', async () => {
    const ship = createShip({
      speed: 50,
      last_position_update_ms: 5000,
      afterburner_boosted_speed: 75,
      afterburner_cooldown_end_ms: 3000, // Already expired before last update
      afterburner_old_max_speed: 50,
    });
    const world = new World(worldSize, [ship], async () => {}, db);

    const ctx = createLockContext();
    await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
      world.updatePhysics(worldCtx, 6000);

      const updatedShip = world.spaceObjects[0];
      expect(updatedShip.afterburner_boosted_speed).toBeNull();
      expect(updatedShip.afterburner_cooldown_end_ms).toBeNull();
      expect(updatedShip.afterburner_old_max_speed).toBeNull();
    });
  });
});
