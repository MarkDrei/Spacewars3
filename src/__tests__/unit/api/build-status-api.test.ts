import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { GET as buildStatusGET } from '@/app/api/build-status/route';
import { POST as abortBuildQueuePOST } from '@/app/api/abort-build-queue/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { TechService } from '@/lib/server/techs/TechService';
import { TechFactory, type TechCounts } from '@/lib/server/techs/TechFactory';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import type { UserCache } from '@/lib/server/user/userCache';
import type { MessageCache } from '@/lib/server/messages/MessageCache';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';

const PULSE_LASER = TechFactory.getTechSpec('pulse_laser', 'weapon')!;
const PULSE_LASER_SECONDS = PULSE_LASER.buildDurationMinutes * 60;
const IRON_PER_SECOND = 2;

const EMPTY_TECH_COUNTS: TechCounts = {
  pulse_laser: 0,
  auto_turret: 0,
  plasma_lance: 0,
  gauss_rifle: 0,
  photon_torpedo: 0,
  rocket_launcher: 0,
  ship_hull: 0,
  kinetic_armor: 0,
  energy_shield: 0,
  missile_jammer: 0,
};

const BONUSES = {
  levelMultiplier: 1,
  ironRechargeRate: IRON_PER_SECOND,
  ironStorageCapacity: 100_000,
  repairRate: 0,
  shieldRechargeRate: 0,
  constructionSpeedFactor: 1,
  researchSpeedFactor: 1,
} as unknown as UserBonuses;

/**
 * In-memory stand-in for UserCache that mirrors the real refresh semantics:
 * getUserByIdWithLock runs updateStats (iron accrual + chronological build processing),
 * the WithoutRefresh variant returns the cached instance as is.
 */
const createFakeUserCache = (user: User) =>
  ({
    getUserByIdWithLock: vi.fn(async (context: LockContext<LocksAtMostAndHas4>) => {
      await user.updateStats(Math.floor(Date.now() / 1000), context, BONUSES);
      return user;
    }),
    getUserByIdWithoutRefreshWithLock: vi.fn(async () => user),
    updateUserInCache: vi.fn(async () => {}),
  }) as unknown as UserCache;

const makeUser = (lastUpdatedSec: number, overrides: Partial<Pick<User, 'iron' | 'buildQueue' | 'buildStartSec'>>) => {
  const bonusCache = { getBonuses: async () => BONUSES, invalidateBonuses: () => {} } as unknown as UserBonusCache;
  const user = new User(
    1, 'builder', 'hash', 0, 0, lastUpdatedSec, createInitialTechTree(), async () => {},
    { ...EMPTY_TECH_COUNTS }, 100, 100, 100, lastUpdatedSec, false, null, [], null, 0, lastUpdatedSec,
    undefined, bonusCache, TimeMultiplierService.getInstance(),
  );
  Object.assign(user, overrides);
  return user;
};

describe('build status / abort build queue API', () => {
  const nowSec = 1_800_000_000;
  let createMessage: ReturnType<typeof vi.fn>;

  const useUser = (user: User) => {
    const techService = TechService.getInstance();
    techService.setUserCacheForTesting(createFakeUserCache(user));
    techService.setMessageCacheForTesting({ createMessage } as unknown as MessageCache);
  };

  const call = async (handler: typeof buildStatusGET, url: string, method: string) => {
    const cookie = await createMockSessionCookie(1);
    const response = await handler(createRequest(url, method, undefined, cookie));
    return { status: response.status, data: await response.json() };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(nowSec * 1000);
    TimeMultiplierService.resetInstance();
    createMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(UserBonusCache, 'getInstance').mockReturnValue({
      getBonuses: async () => BONUSES,
      invalidateBonuses: () => {},
    } as unknown as UserBonusCache);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TechService.resetInstance();
  });

  test('buildStatus_notAuthenticated_returns401', async () => {
    const response = await buildStatusGET(createRequest('http://localhost/api/build-status', 'GET'));
    expect(response.status).toBe(401);
  });

  test('abortBuildQueue_notAuthenticated_returns401', async () => {
    const response = await abortBuildQueuePOST(createRequest('http://localhost/api/abort-build-queue', 'POST'));
    expect(response.status).toBe(401);
  });

  test('buildStatus_ironForNextItemAccruesDuringFirstBuild_startsNextItemInsteadOfAborting', async () => {
    // First laser (already paid) finished 10 s ago. Iron at start was 0; it accrued
    // IRON_PER_SECOND * build duration (> laser cost) while the first laser was building.
    const lastUpdated = nowSec - PULSE_LASER_SECONDS - 10;
    const user = makeUser(lastUpdated, {
      iron: 0,
      buildStartSec: lastUpdated,
      buildQueue: [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
      ],
    });
    expect(IRON_PER_SECOND * PULSE_LASER_SECONDS).toBeGreaterThan(PULSE_LASER.baseCost);
    useUser(user);

    const { status, data } = await call(buildStatusGET, 'http://localhost/api/build-status', 'GET');

    expect(status).toBe(200);
    expect(data.techCounts.pulse_laser).toBe(1);
    expect(data.buildQueue).toHaveLength(1);
    expect(data.buildQueue[0].completionTime).toBe(lastUpdated + 2 * PULSE_LASER_SECONDS);
    expect(data.queueEstimatedCompletion).toBe(lastUpdated + 2 * PULSE_LASER_SECONDS);
    expect(user.iron).toBe(IRON_PER_SECOND * (PULSE_LASER_SECONDS + 10) - PULSE_LASER.baseCost);
    expect(createMessage).not.toHaveBeenCalledWith(expect.anything(), 1, expect.stringContaining('abort'));
  });

  test('buildStatus_emptyQueue_returnsCountsAndTotals', async () => {
    const user = makeUser(nowSec, { iron: 500 });
    user.techCounts.pulse_laser = 2;
    useUser(user);

    const { status, data } = await call(buildStatusGET, 'http://localhost/api/build-status', 'GET');

    expect(status).toBe(200);
    expect(data.buildQueue).toEqual([]);
    expect(data.queueEstimatedCompletion).toBeNull();
    expect(data.totalDPS).toBe(TechFactory.calculateTotalEffects(user.techCounts).weapons.totalDPS);
  });

  test('buildStatus_refreshesUserOnlyOnce', async () => {
    const user = makeUser(nowSec, { iron: 500 });
    const userCache = createFakeUserCache(user);
    TechService.getInstance().setUserCacheForTesting(userCache);

    await call(buildStatusGET, 'http://localhost/api/build-status', 'GET');

    expect(userCache.getUserByIdWithLock).toHaveBeenCalledTimes(1);
  });

  test('abortBuildQueue_queuedItems_clearsQueueAndReportsCount', async () => {
    const user = makeUser(nowSec, {
      buildStartSec: nowSec,
      buildQueue: [
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
        { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 },
      ],
    });
    useUser(user);

    const { status, data } = await call(abortBuildQueuePOST, 'http://localhost/api/abort-build-queue', 'POST');

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, abortedCount: 2, message: 'Build queue aborted' });
    expect(user.buildQueue).toEqual([]);
    expect(user.buildStartSec).toBeNull();
  });

  test('abortBuildQueue_emptyQueue_reportsAlreadyEmpty', async () => {
    useUser(makeUser(nowSec, {}));

    const { data } = await call(abortBuildQueuePOST, 'http://localhost/api/abort-build-queue', 'POST');

    expect(data).toMatchObject({ success: true, abortedCount: 0, message: 'Build queue already empty' });
  });
});
