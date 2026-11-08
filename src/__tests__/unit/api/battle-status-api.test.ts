import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GET as battleStatusGET } from '@/app/api/battle-status/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { UserCache } from '@/lib/server/user/userCache';
import type { Battle } from '@/lib/server/battle/battleTypes';

const { getOngoingBattleForUser } = vi.hoisted(() => ({ getOngoingBattleForUser: vi.fn() }));
vi.mock('@/lib/server/battle/BattleCache', () => ({ getOngoingBattleForUser }));

const URL = 'http://localhost:3000/api/battle-status';
const stats = { hull: { current: 1, max: 1 }, armor: { current: 1, max: 1 }, shield: { current: 1, max: 1 } };

const battle: Battle = {
  id: 7,
  attackerId: 1,
  attackeeId: 2,
  battleStartTime: 1000,
  battleEndTime: null,
  winnerId: null,
  loserId: null,
  attackerWeaponCooldowns: { pulse_laser: 111 },
  attackeeWeaponCooldowns: { auto_turret: 222 },
  attackerStartStats: stats,
  attackeeStartStats: stats,
  attackerEndStats: null,
  attackeeEndStats: null,
  battleLog: [],
  attackerTotalDamage: 30,
  attackeeTotalDamage: 12,
};

describe('GET /api/battle-status', () => {
  let getUserWithoutRefresh: ReturnType<typeof vi.fn>;

  const getStatus = async (userId: number) => {
    const cookie = await createMockSessionCookie(userId);
    const response = await battleStatusGET(createRequest(URL, 'GET', undefined, cookie));
    return { status: response.status, data: await response.json() };
  };

  beforeEach(() => {
    getOngoingBattleForUser.mockReset();
    getUserWithoutRefresh = vi.fn(async (_ctx: unknown, id: number) => (id === 2 ? { username: 'defender' } : { username: 'attacker' }));
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithoutRefreshWithLock: getUserWithoutRefresh,
    } as unknown as UserCache);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('battleStatus_notAuthenticated_returns401', async () => {
    const response = await battleStatusGET(createRequest(URL, 'GET'));
    expect(response.status).toBe(401);
  });

  test('battleStatus_noBattle_returnsNotInBattle', async () => {
    getOngoingBattleForUser.mockResolvedValue(null);

    const { status, data } = await getStatus(1);

    expect(status).toBe(200);
    expect(data).toEqual({ inBattle: false });
    expect(getUserWithoutRefresh).not.toHaveBeenCalled();
  });

  test('battleStatus_attacker_returnsOwnCooldownsAndDamageFromAttackerPerspective', async () => {
    getOngoingBattleForUser.mockResolvedValue(battle);

    const { data } = await getStatus(1);

    expect(data.inBattle).toBe(true);
    expect(data.battle).toMatchObject({
      id: 7,
      isAttacker: true,
      opponentId: 2,
      opponentName: 'defender',
      weaponCooldowns: { pulse_laser: 111 },
      myTotalDamage: 30,
      opponentTotalDamage: 12,
    });
  });

  test('battleStatus_attackee_returnsOwnCooldownsAndDamageFromAttackeePerspective', async () => {
    getOngoingBattleForUser.mockResolvedValue(battle);

    const { data } = await getStatus(2);

    expect(data.battle).toMatchObject({
      isAttacker: false,
      opponentId: 1,
      opponentName: 'attacker',
      weaponCooldowns: { auto_turret: 222 },
      myTotalDamage: 12,
      opponentTotalDamage: 30,
    });
  });

  test('battleStatus_opponentUnknown_returnsUnknownName', async () => {
    getOngoingBattleForUser.mockResolvedValue(battle);
    getUserWithoutRefresh.mockResolvedValue(null);

    const { data } = await getStatus(1);

    expect(data.battle.opponentName).toBe('Unknown');
  });

  test('battleStatus_battleCacheFails_returns500', async () => {
    getOngoingBattleForUser.mockRejectedValue(new Error('BattleCache not initialized'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { status } = await getStatus(1);

    expect(status).toBe(500);
  });
});
