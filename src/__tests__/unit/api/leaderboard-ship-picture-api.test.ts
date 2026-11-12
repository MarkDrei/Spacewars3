import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GET as leaderboardGET } from '@/app/api/leaderboard/route';
import { GET as shipPictureGET, POST as shipPicturePOST } from '@/app/api/update-ship-picture/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { World, type SpaceObject } from '@/lib/server/world/world';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import type { DatabaseConnection } from '@/lib/server/database';
import type { GlobalStatAggregates } from '@/lib/server/statistics/statisticsTypes';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock('@/lib/server/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/database')>()),
  getDatabase,
}));

const authed = async (url: string, method: string, body?: unknown) =>
  createRequest(url, method, body, await createMockSessionCookie(1));

const userRow = (id: number, username: string, overrides: Record<string, unknown> = {}) => ({
  id,
  username,
  score: 0,
  xp: 0,
  pulse_laser: 0,
  auto_turret: 0,
  plasma_lance: 0,
  gauss_rifle: 0,
  photon_torpedo: 0,
  rocket_launcher: 0,
  ship_hull: 0,
  kinetic_armor: 0,
  energy_shield: 0,
  tech_tree: JSON.stringify(createInitialTechTree()),
  ...overrides,
});

const TOP5_KEYS = [
  'battlesWon', 'battlesLost', 'totalDamageDealt', 'totalDamageReceived', 'totalIronTransferred',
  'totalXpAwarded', 'asteroidsCollected', 'shipwrecksCollected', 'escapePodsCollected',
  'totalIronFromCollection', 'totalIronSpentOnResearch', 'researchCount', 'totalIronSpentOnBuilds',
  'totalBuildsCompleted',
] as const;

const emptyTop5 = (): GlobalStatAggregates['top5'] =>
  Object.fromEntries(TOP5_KEYS.map((key) => [key, []])) as unknown as GlobalStatAggregates['top5'];

describe('GET /api/leaderboard', () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    getDatabase.mockResolvedValue({ query });
    const top5 = emptyTop5();
    vi.spyOn(StatisticsCache, 'getInstance').mockReturnValue({
      getGlobalStats: () => ({ top5: { ...top5, battlesWon: [{ userId: 2, username: 'bob', value: 3 }] } }),
    } as unknown as StatisticsCache);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('leaderboard_notAuthenticated_returns401', async () => {
    const response = await leaderboardGET(createRequest('http://localhost/api/leaderboard', 'GET'));
    expect(response.status).toBe(401);
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test('leaderboard_rowsSortedByScore_ranksAndMarksCurrentUser', async () => {
    query.mockResolvedValue({ rows: [userRow(2, 'bob', { score: 50 }), userRow(1, 'alice', { score: 10 })] });

    const response = await leaderboardGET(await authed('http://localhost/api/leaderboard', 'GET'));
    const data = await response.json();

    expect(data.leaderboard).toEqual([
      { rank: 1, userId: 2, username: 'bob', score: 50, isCurrentUser: false },
      { rank: 2, userId: 1, username: 'alice', score: 10, isCurrentUser: true },
    ]);
    expect(query.mock.calls[0][0]).toContain('WHERE id < $1');
  });

  test('leaderboard_bestIn_combinesStatisticsAndUserRows', async () => {
    const fastTree = { ...createInitialTechTree(), shipSpeed: 10 };
    query.mockResolvedValue({
      rows: [
        userRow(1, 'alice', { xp: 500, pulse_laser: 2 }),
        userRow(2, 'bob', { xp: 100, tech_tree: JSON.stringify(fastTree) }),
        userRow(3, 'broken', { tech_tree: '{not json' }),
      ],
    });

    const data = await (await leaderboardGET(await authed('http://localhost/api/leaderboard', 'GET'))).json();

    expect(data.bestIn).toMatchObject({
      battlesWon: 'bob',
      battlesLost: null,
      xp: 'alice',
      pulseLaser: 'alice',
      autoTurret: null,
      shipSpeed: 'bob',
    });
  });

  test('leaderboard_noUsers_returnsEmptyBoardAndNullBestIn', async () => {
    query.mockResolvedValue({ rows: [] });

    const data = await (await leaderboardGET(await authed('http://localhost/api/leaderboard', 'GET'))).json();

    expect(data.leaderboard).toEqual([]);
    expect(data.bestIn.xp).toBeNull();
    expect(data.bestIn.shipSpeed).toBeNull();
  });
});

describe('/api/update-ship-picture', () => {
  const SHIP_ID = 42;
  const URL = 'http://localhost/api/update-ship-picture';
  const query = vi.fn();
  let world: World;
  let getUser: ReturnType<typeof vi.fn>;

  const ship = () => world.spaceObjects.find((obj) => obj.id === SHIP_ID);

  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    getDatabase.mockResolvedValue({ query });
    const db = { query: vi.fn(), connect: vi.fn(), end: vi.fn() } as unknown as DatabaseConnection;
    const playerShip: SpaceObject = {
      id: SHIP_ID, type: 'player_ship', x: 0, y: 0, speed: 0, angle: 0,
      last_position_update_ms: Date.now(), picture_id: 1,
    };
    world = new World({ width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT }, [playerShip], async () => {}, db);
    WorldCache.resetInstance();
    WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
    NPCManager.resetInstance();

    getUser = vi.fn().mockResolvedValue({ ship_id: SHIP_ID });
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithoutRefreshWithLock: getUser,
    } as unknown as UserCache);
  });

  afterEach(async () => {
    await WorldCache.getInstance().shutdown().catch(() => {});
    WorldCache.resetInstance();
    NPCManager.resetInstance();
    vi.restoreAllMocks();
  });

  test('shipPicture_notAuthenticated_returns401', async () => {
    expect((await shipPictureGET(createRequest(URL, 'GET'))).status).toBe(401);
    expect((await shipPicturePOST(createRequest(URL, 'POST', { pictureId: 2 }))).status).toBe(401);
  });

  test('shipPictureGet_existingShip_returnsPictureId', async () => {
    const response = await shipPictureGET(await authed(URL, 'GET'));
    expect(await response.json()).toEqual({ pictureId: 1 });
  });

  test('shipPicturePost_validId_updatesWorldAndDatabase', async () => {
    const response = await shipPicturePOST(await authed(URL, 'POST', { pictureId: 3 }));

    expect(response.status).toBe(200);
    expect(ship()?.picture_id).toBe(3);
    expect(query).toHaveBeenCalledWith('UPDATE space_objects SET picture_id = $1 WHERE id = $2', [3, SHIP_ID]);
  });

  test.each([[0], [1001], [1.5], ['2'], [null]])('shipPicturePost_invalidId_%s_returns400', async (pictureId) => {
    const response = await shipPicturePOST(await authed(URL, 'POST', { pictureId }));

    expect(response.status).toBe(400);
    expect(ship()?.picture_id).toBe(1);
    expect(query).not.toHaveBeenCalled();
  });

  test('shipPicturePost_userWithoutShip_returns404', async () => {
    getUser.mockResolvedValue({ ship_id: null });
    const response = await shipPicturePOST(await authed(URL, 'POST', { pictureId: 3 }));
    expect(response.status).toBe(404);
  });

  test('shipPicturePost_shipMissingInWorld_returns404WithoutDbWrite', async () => {
    getUser.mockResolvedValue({ ship_id: 999 });
    const response = await shipPicturePOST(await authed(URL, 'POST', { pictureId: 3 }));

    expect(response.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });
});
