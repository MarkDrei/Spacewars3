import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionCookie, createRequest } from '../../helpers/apiTestHelpers';
import { ApiError } from '@/lib/server/errors';

vi.mock('iron-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('iron-session')>();
  return {
    ...actual,
    getIronSession: vi.fn(),
  };
});

vi.mock('@/lib/server/user/userCache', () => ({
  UserCache: { getInstance2: vi.fn() },
}));

vi.mock('@/lib/server/npc/NPCManager', () => ({
  NPCManager: { getInstance: vi.fn() },
}));

vi.mock('@/lib/server/npc/npcCombat', () => ({
  upsertNpcUser: vi.fn(),
  removeNpcSpaceObject: vi.fn(),
  rollbackNpcBattlePreparation: vi.fn(),
}));

vi.mock('@/lib/server/battle/BattleCache', () => ({
  getBattleCache: vi.fn(),
}));

vi.mock('@/lib/server/battle/battleService', () => ({
  initiateBattle: vi.fn(),
}));

vi.mock('@markdrei/ironguard-typescript-locks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markdrei/ironguard-typescript-locks')>();
  return {
    ...actual,
    createLockContext: () => ({
      useLockWithAcquire: (_lock: unknown, fn: (ctx: unknown) => unknown) =>
        fn({
          useLockWithAcquire: (_lock2: unknown, fn2: (ctx: unknown) => unknown) => fn2({}),
        }),
    }),
  };
});

import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { getBattleCache } from '@/lib/server/battle/BattleCache';
import { initiateBattle } from '@/lib/server/battle/battleService';
import { upsertNpcUser, rollbackNpcBattlePreparation } from '@/lib/server/npc/npcCombat';
import { POST } from '@/app/api/attack/route';
import { NPC_USER_ID_OFFSET } from '@/lib/server/npc/npcConstants';

const ATTACKER_USER_ID = 1;
const NPC_TARGET_ID = NPC_USER_ID_OFFSET + 1;

function makeSessionMock(userId: number) {
  (getIronSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId });
}

function makeUserCacheMock() {
  const mockUserCache = {
    getUserByIdWithLock: vi.fn().mockImplementation((_ctx: unknown, id: number) => {
      if (id === ATTACKER_USER_ID) return Promise.resolve({ id: ATTACKER_USER_ID, getLevel: () => 5 });
      if (id === NPC_TARGET_ID) return Promise.resolve({ id: NPC_TARGET_ID, getLevel: () => 5 });
      return Promise.resolve(null);
    }),
  };
  (UserCache.getInstance2 as ReturnType<typeof vi.fn>).mockReturnValue(mockUserCache);
}

function makeNpcManagerMock() {
  const npc = { id: NPC_TARGET_ID, ownerId: ATTACKER_USER_ID, npcIndex: 0, level: 1, orbitAngleDeg: 0, defeated: false, defeatTime: null, npcUserCreated: false, inBattle: false, lastUpdateMs: Date.now() };
  const mockNpcManager = {
    getNpcById: vi.fn().mockReturnValue(npc),
    setInBattle: vi.fn(),
  };
  (NPCManager.getInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockNpcManager);
  return npc;
}

async function postAttack(): Promise<{ status: number; body: { error?: string } }> {
  const sessionCookie = await createMockSessionCookie(ATTACKER_USER_ID);
  const req = createRequest(
    'http://localhost:3000/api/attack',
    'POST',
    { targetUserId: NPC_TARGET_ID },
    undefined,
    { cookie: `${sessionCookie}; NEXT_LOCALE=en` }
  );
  const res = await POST(req);
  const body = await res.json() as { error?: string };
  return { status: res.status, body };
}

describe('attack route NPC cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeSessionMock(ATTACKER_USER_ID);
    makeUserCacheMock();
    makeNpcManagerMock();
    (getBattleCache as ReturnType<typeof vi.fn>).mockReturnValue({
      getRecentAttackees: vi.fn().mockResolvedValue([]),
    });
    (upsertNpcUser as ReturnType<typeof vi.fn>).mockResolvedValue({ existedBefore: false, createdNow: true });
    (rollbackNpcBattlePreparation as ReturnType<typeof vi.fn>).mockResolvedValue({ rolledBack: true, deletedUser: true });
  });

  it('attackRoute_npcBattleStartFails_rollsBackNpcPreparation', async () => {
    (initiateBattle as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(400, 'Target is too far away (150.0 units, max 100)'));

    const { status, body } = await postAttack();

    expect(status).toBe(400);
    expect(body.error).toBe('Target is too far away.');
    expect(rollbackNpcBattlePreparation).toHaveBeenCalledTimes(1);
    expect(rollbackNpcBattlePreparation).toHaveBeenCalledWith(
      expect.objectContaining({ id: NPC_TARGET_ID }),
      expect.anything(),
      { deleteUserIfUnreferenced: true },
    );
  });
});