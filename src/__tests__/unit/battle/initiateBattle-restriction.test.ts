import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '@/lib/server/errors';

// We need to test the attack restriction in initiateBattle.
// The function is complex and tightly coupled to many dependencies, so we'll 
// test the attack restriction logic by mocking the BattleCache's getRecentAttackees.

// Mock modules before importing battleService
vi.mock('@/lib/server/battle/BattleCache', () => ({
  getBattleCache: vi.fn(),
  BattleRepo: {
    addBattleEvent: vi.fn(),
    getBattle: vi.fn(),
    endBattle: vi.fn(),
  },
}));

vi.mock('@/lib/server/user/userCache', () => ({
  UserCache: {
    getInstance2: vi.fn(),
  },
}));

vi.mock('@/lib/server/world/worldCache', () => ({
  WorldCache: {
    getInstance: vi.fn(),
  },
}));

vi.mock('@/lib/server/messages/MessageCache', () => ({
  sendMessageToUser: vi.fn(),
}));

import { initiateBattle } from '@/lib/server/battle/battleService';
import { getBattleCache } from '@/lib/server/battle/BattleCache';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import type { User } from '@/lib/server/user/user';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';

function makeUser(id: number, username: string, inBattle = false): Partial<User> {
  return {
    id,
    username,
    inBattle,
    ship_id: 100 + id,
    techCounts: {
      pulse_laser: 5,
      auto_turret: 0,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0,
    },
  };
}

describe('initiateBattle - attack restriction (recent victims)', () => {
  let mockBattleCache: {
    getRecentAttackees: ReturnType<typeof vi.fn>;
    createBattle: ReturnType<typeof vi.fn>;
  };
  let mockWorldCache: {
    getWorldFromCache: ReturnType<typeof vi.fn>;
    updateWorldUnsafe: ReturnType<typeof vi.fn>;
  };
  let mockUserCache: {
    getUserByIdFromCache: ReturnType<typeof vi.fn>;
    updateUserInCache: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBattleCache = {
      getRecentAttackees: vi.fn().mockResolvedValue([]),
      createBattle: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const mockShip = { id: 101, x: 0, y: 0, speed: 5 };
    const mockShip2 = { id: 102, x: 10, y: 10, speed: 5 };
    mockWorldCache = {
      getWorldFromCache: vi.fn().mockReturnValue({ spaceObjects: [mockShip, mockShip2] }),
      updateWorldUnsafe: vi.fn().mockResolvedValue(undefined),
    };

    mockUserCache = {
      getUserByIdFromCache: vi.fn(),
      updateUserInCache: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(getBattleCache).mockReturnValue(mockBattleCache as never);
    vi.mocked(WorldCache.getInstance).mockReturnValue(mockWorldCache as never);
    vi.mocked(UserCache.getInstance2).mockReturnValue(mockUserCache as never);
  });

  it('initiateBattle_targetIsRecentVictim_throwsError', async () => {
    // Arrange: target user is in the recent victims list
    const attacker = makeUser(1, 'attacker') as User;
    const attackee = makeUser(2, 'attackee') as User;

    mockBattleCache.getRecentAttackees.mockResolvedValue([2]); // attackee.id = 2 is in list

    const ctx = createLockContext();

    // Act & Assert
    await expect(
      ctx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) =>
        ctx.useLockWithAcquire(USER_LOCK, async (userCtx) =>
          initiateBattle(battleCtx, userCtx, attacker, attackee)
        )
      )
    ).rejects.toThrow(ApiError);

    await expect(
      ctx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) =>
        ctx.useLockWithAcquire(USER_LOCK, async (userCtx) =>
          initiateBattle(battleCtx, userCtx, attacker, attackee)
        )
      )
    ).rejects.toThrow('You have attacked this player recently. Choose a different target.');
  });

  it('initiateBattle_targetIsOldVictim_allows', async () => {
    // Arrange: target is NOT in the last 3 victims (old victim)
    const attacker = makeUser(1, 'attacker') as User;
    const attackee = makeUser(2, 'attackee') as User;

    // Recent victims are [3, 4, 5] — attackee (id=2) is not among them
    mockBattleCache.getRecentAttackees.mockResolvedValue([3, 4, 5]);

    const ctx = createLockContext();

    // The function should NOT throw an ApiError about recent attacks
    // (it may throw something else due to mocked infrastructure, but not the restriction error)
    try {
      await ctx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) =>
        ctx.useLockWithAcquire(USER_LOCK, async (userCtx) =>
          initiateBattle(battleCtx, userCtx, attacker, attackee)
        )
      );
    } catch (error) {
      // If it throws, it should NOT be the "recently attacked" error
      if (error instanceof ApiError) {
        expect(error.message).not.toContain('recently');
      }
    }

    // getRecentAttackees was called with attacker.id and limit=3
    expect(mockBattleCache.getRecentAttackees).toHaveBeenCalledWith(1, 3);
  });

  it('initiateBattle_noHistory_allows', async () => {
    // Arrange: no battle history at all
    const attacker = makeUser(1, 'attacker') as User;
    const attackee = makeUser(2, 'attackee') as User;

    mockBattleCache.getRecentAttackees.mockResolvedValue([]); // No history

    const ctx = createLockContext();

    // Should not throw the restriction error
    try {
      await ctx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) =>
        ctx.useLockWithAcquire(USER_LOCK, async (userCtx) =>
          initiateBattle(battleCtx, userCtx, attacker, attackee)
        )
      );
    } catch (error) {
      if (error instanceof ApiError) {
        expect(error.message).not.toContain('recently');
      }
    }

    expect(mockBattleCache.getRecentAttackees).toHaveBeenCalledWith(1, 3);
  });

  it('initiateBattle_attackerAlreadyInBattle_throwsEarlyBeforeCheckingVictims', async () => {
    // Arrange: attacker is already in battle
    const attacker = makeUser(1, 'attacker', true) as User; // inBattle = true
    const attackee = makeUser(2, 'attackee') as User;

    const ctx = createLockContext();

    await expect(
      ctx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) =>
        ctx.useLockWithAcquire(USER_LOCK, async (userCtx) =>
          initiateBattle(battleCtx, userCtx, attacker, attackee)
        )
      )
    ).rejects.toThrow('You are already in a battle');

    // getRecentAttackees should NOT have been called (early exit)
    expect(mockBattleCache.getRecentAttackees).not.toHaveBeenCalled();
  });
});
