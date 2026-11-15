import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { POST as navigatePOST } from '@/app/api/navigate/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { WorldCache } from '@/lib/server/world/worldCache';
import { UserCache } from '@/lib/server/user/userCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { AfterburnerService } from '@/lib/server/afterburner/AfterburnerService';
import { World, type SpaceObject } from '@/lib/server/world/world';
import type { DatabaseConnection } from '@/lib/server/database';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

const URL = 'http://localhost:3000/api/navigate';
const SHIP_ID = 42;
const MAX_SPEED = 25;

const createMockDb = () =>
  ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DatabaseConnection;

const createShip = (): SpaceObject => ({
  id: SHIP_ID,
  type: 'player_ship',
  x: 100,
  y: 100,
  speed: 5,
  angle: 90,
  last_position_update_ms: Date.now(),
  picture_id: 1,
});

const createUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  ship_id: SHIP_ID,
  inBattle: false,
  techTree: {},
  getCurrentMaxShipSpeed: () => MAX_SPEED,
  ...overrides,
});

describe('POST /api/navigate', () => {
  let world: World;
  let getUser: ReturnType<typeof vi.fn>;

  // Physics updates replace the space object instances, so always read the ship from the world
  const ship = () => world.spaceObjects.find((obj) => obj.id === SHIP_ID)!;

  const navigate = async (body: unknown) => {
    const cookie = await createMockSessionCookie(1);
    const response = await navigatePOST(createRequest(URL, 'POST', body, cookie));
    return { status: response.status, data: await response.json() };
  };

  beforeEach(() => {
    const db = createMockDb();
    world = new World({ width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT }, [createShip()], async () => {}, db);
    WorldCache.resetInstance();
    WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
    NPCManager.resetInstance();
    AfterburnerService.resetInstance();

    getUser = vi.fn().mockResolvedValue(createUser());
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithLock: getUser,
      getBonusesByUserIdWithLock: vi.fn().mockResolvedValue({}),
    } as unknown as UserCache);
  });

  afterEach(async () => {
    await WorldCache.getInstance().shutdown().catch(() => {});
    WorldCache.resetInstance();
    NPCManager.resetInstance();
    AfterburnerService.resetInstance();
    vi.restoreAllMocks();
  });

  test('navigate_notAuthenticated_returns401', async () => {
    const response = await navigatePOST(createRequest(URL, 'POST', { speed: 1 }));
    expect(response.status).toBe(401);
  });

  test('navigate_noSpeedOrAngle_returns400', async () => {
    const { status, data } = await navigate({ foo: 1 });
    expect(status).toBe(400);
    expect(data.error).toBe('Must provide speed and/or angle');
  });

  test.each([
    ['speed', { speed: '10' }],
    ['speed', { speed: [5] }],
    ['angle', { angle: 'north' }],
    ['angle', { angle: true }],
  ])('navigate_nonNumeric_%s_returns400AndLeavesShipUnchanged', async (_field, body) => {
    const { status } = await navigate(body);
    expect(status).toBe(400);
    expect(ship().speed).toBe(5);
    expect(ship().angle).toBe(90);
  });

  test('navigate_validSpeed_updatesShipAndReportsChange', async () => {
    const { status, data } = await navigate({ speed: 20 });

    expect(status).toBe(200);
    expect(ship().speed).toBe(20);
    expect(data.changes.speed).toEqual({ from: 5, to: 20 });
    expect(data.changes.angle).toBeNull();
  });

  test('navigate_speedAboveMax_returns400', async () => {
    const { status, data } = await navigate({ speed: MAX_SPEED + 1 });
    expect(status).toBe(400);
    expect(data.error).toBe(`Speed must be between 0 and ${MAX_SPEED}`);
    expect(ship().speed).toBe(5);
  });

  test('navigate_negativeSpeed_returns400', async () => {
    const { status } = await navigate({ speed: -1 });
    expect(status).toBe(400);
  });

  test.each([
    [-90, 270],
    [450, 90],
    [360, 0],
  ])('navigate_angle%s_normalizedTo%s', async (input, expected) => {
    const { status, data } = await navigate({ angle: input });
    expect(status).toBe(200);
    expect(ship().angle).toBe(expected);
    expect(data.changes.angle).toEqual({ from: 90, to: expected });
  });

  test('navigate_nullSpeedWithAngle_onlyChangesAngle', async () => {
    const { status } = await navigate({ speed: null, angle: 10 });
    expect(status).toBe(200);
    expect(ship().speed).toBe(5);
    expect(ship().angle).toBe(10);
  });

  test('navigate_userInBattle_returns400', async () => {
    getUser.mockResolvedValue(createUser({ inBattle: true }));
    const { status, data } = await navigate({ speed: 1 });
    expect(status).toBe(400);
    expect(data.error).toBe('Cannot navigate while in battle');
  });

  test('navigate_userNotFound_returns404', async () => {
    getUser.mockResolvedValue(null);
    const { status } = await navigate({ speed: 1 });
    expect(status).toBe(404);
  });

  test('navigate_shipMissingInWorld_returns404', async () => {
    getUser.mockResolvedValue(createUser({ ship_id: 999 }));
    const { status, data } = await navigate({ angle: 1 });
    expect(status).toBe(404);
    expect(data.error).toBe('Player ship not found');
  });

  test('navigate_invalidJson_returns400', async () => {
    const cookie = await createMockSessionCookie(1);
    const request = createRequest(URL, 'POST', undefined, cookie);
    const response = await navigatePOST(request);
    expect(response.status).toBe(400);
  });
});
