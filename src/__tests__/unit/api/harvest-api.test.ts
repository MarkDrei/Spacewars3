import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { POST as harvestPOST } from '@/app/api/harvest/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserCache } from '@/lib/server/user/userCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { InventoryRepo } from '@/lib/server/inventory/InventoryRepo';
import { World, type SpaceObject } from '@/lib/server/world/world';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import type { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';
import type { TechCounts } from '@/lib/server/techs/TechFactory';
import type { DatabaseConnection } from '@/lib/server/database';
import type { InventorySlot } from '@/lib/server/inventory/inventoryTypes';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

const { sendMessageToUser } = vi.hoisted(() => ({ sendMessageToUser: vi.fn() }));
vi.mock('@/lib/server/messages/MessageCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/messages/MessageCache')>()),
  sendMessageToUser,
}));

const URL = 'http://localhost:3000/api/harvest';
const SHIP_ID = 42;
const ASTEROID_ID = 10;
const FAR_ASTEROID_ID = 11;
const ESCAPE_POD_ID = 12;
const OTHER_SHIP_ID = 13;
const CAPACITY = 5000;

const NO_TECHS = {
  pulse_laser: 0, auto_turret: 0, plasma_lance: 0, gauss_rifle: 0, photon_torpedo: 0,
  rocket_launcher: 0, ship_hull: 0, kinetic_armor: 0, energy_shield: 0, missile_jammer: 0,
} as TechCounts;

const object = (id: number, type: SpaceObject['type'], x: number, y = 100): SpaceObject => ({
  id, type, x, y, speed: 0, angle: 0, last_position_update_ms: Date.now(), picture_id: 1,
});

describe('POST /api/harvest', () => {
  let world: World;
  let user: User;
  let storedInventory: InventorySlot[][];

  const harvest = async (objectId: unknown) => {
    const cookie = await createMockSessionCookie(1);
    const response = await harvestPOST(createRequest(URL, 'POST', { objectId }, cookie));
    return { status: response.status, data: await response.json() };
  };
  const has = (id: number) => world.spaceObjects.some((obj) => obj.id === id);

  beforeEach(() => {
    let nextId = 1000;
    const db = {
      query: vi.fn(async (sql: string) => (sql.startsWith('INSERT') ? { rows: [{ id: nextId++ }] } : { rows: [] })),
    } as unknown as DatabaseConnection;
    world = new World(
      { width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT },
      [
        object(SHIP_ID, 'player_ship', 100),
        object(ASTEROID_ID, 'asteroid', 200),
        object(FAR_ASTEROID_ID, 'asteroid', 400),
        object(ESCAPE_POD_ID, 'escape_pod', 150),
        object(OTHER_SHIP_ID, 'player_ship', 120),
      ],
      async () => {},
      db,
    );
    WorldCache.resetInstance();
    WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
    NPCManager.resetInstance();

    const bonuses = { ironStorageCapacity: CAPACITY } as UserBonuses;
    const bonusCache = { getBonuses: async () => bonuses, invalidateBonuses: () => {} } as unknown as UserBonusCache;
    const now = Math.floor(Date.now() / 1000);
    user = new User(
      1, 'a', 'h', 100, 0, now, createInitialTechTree(), async () => {}, { ...NO_TECHS },
      100, 100, 100, now, false, null, [], null, 0, now, SHIP_ID, bonusCache, TimeMultiplierService.getInstance(),
    );
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithLock: vi.fn().mockResolvedValue(user),
      getBonusesByUserIdWithLock: vi.fn().mockResolvedValue(bonuses),
      updateUserInCache: vi.fn().mockResolvedValue(undefined),
    } as unknown as UserCache);

    storedInventory = [Array.from({ length: 8 }, () => null), Array.from({ length: 8 }, () => null)];
    vi.spyOn(InventoryRepo.prototype, 'getInventory').mockImplementation(async () => storedInventory);
    vi.spyOn(InventoryRepo.prototype, 'saveInventory').mockImplementation(async (_ctx, _id, grid) => {
      storedInventory = grid;
    });
    vi.spyOn(StatisticsCache, 'getInstance').mockReturnValue({
      recordEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as StatisticsCache);
    sendMessageToUser.mockReset().mockResolvedValue(1);
  });

  afterEach(async () => {
    await WorldCache.getInstance().shutdown().catch(() => {});
    WorldCache.resetInstance();
    NPCManager.resetInstance();
    vi.restoreAllMocks();
  });

  test('harvest_asteroidInRange_addsIronRemovesObjectAndSpawnsReplacement', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const objectCount = world.spaceObjects.length;

    const { status, data } = await harvest(ASTEROID_ID);

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, objectType: 'asteroid', ironReward: 375, totalIron: 475 });
    expect(user.iron).toBe(475);
    expect(has(ASTEROID_ID)).toBe(false);
    expect(world.spaceObjects).toHaveLength(objectCount);
    expect(sendMessageToUser).toHaveBeenCalledWith(expect.anything(), 1, expect.stringContaining('375'));
  });

  test('harvest_ironAtCapacity_rewardIsCapped', async () => {
    user.iron = CAPACITY - 10;
    const { data } = await harvest(ASTEROID_ID);

    expect(data.ironReward).toBe(10);
    expect(user.iron).toBe(CAPACITY);
  });

  test('harvest_objectOutOfRange_returns400AndKeepsObject', async () => {
    const { status, data } = await harvest(FAR_ASTEROID_ID);

    expect(status).toBe(400);
    expect(data.error).toBe('Object too far away');
    expect(has(FAR_ASTEROID_ID)).toBe(true);
    expect(user.iron).toBe(100);
  });

  test('harvest_userInBattle_returns400AndKeepsObject', async () => {
    user.inBattle = true;

    const { status, data } = await harvest(ASTEROID_ID);

    expect(status).toBe(400);
    expect(data.error).toBe('Cannot collect while in battle');
    expect(has(ASTEROID_ID)).toBe(true);
    expect(user.iron).toBe(100);
  });

  test('harvest_playerShip_returns400', async () => {
    const { status, data } = await harvest(OTHER_SHIP_ID);
    expect(status).toBe(400);
    expect(data.error).toBe('Cannot collect player ships');
  });

  test('harvest_unknownObject_returns404', async () => {
    const { status } = await harvest(9999);
    expect(status).toBe(404);
  });

  test('harvest_escapePod_putsCommanderIntoInventory', async () => {
    const { status, data } = await harvest(ESCAPE_POD_ID);

    expect(status).toBe(200);
    expect(data).toMatchObject({ objectType: 'escape_pod', ironReward: 0 });
    expect(storedInventory.flat().filter(Boolean)).toHaveLength(1);
    expect(storedInventory[0][0]).toMatchObject({ itemType: 'commander' });
    expect(sendMessageToUser).toHaveBeenCalledTimes(1);
  });

  test('harvest_escapePodWithFullInventory_reportsLostCommanderWithoutError', async () => {
    const full = { itemType: 'commander', name: 'X', imageId: 1, statBonuses: [{ stat: 'shipSpeed', value: 1 }] };
    storedInventory = storedInventory.map((row) => row.map(() => ({ ...full }) as unknown as InventorySlot));

    const { status } = await harvest(ESCAPE_POD_ID);

    expect(status).toBe(200);
    expect(has(ESCAPE_POD_ID)).toBe(false);
    expect(storedInventory.flat().every((slot) => (slot as { name: string }).name === 'X')).toBe(true);
    expect(sendMessageToUser).toHaveBeenCalledTimes(1);
  });

  test('harvest_emptyBody_returns400', async () => {
    const cookie = await createMockSessionCookie(1);
    const response = await harvestPOST(createRequest(URL, 'POST', undefined, cookie));
    expect(response.status).toBe(400);
  });
});
