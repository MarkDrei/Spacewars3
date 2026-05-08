/**
 * Unit tests for attack API route localized error messages.
 *
 * The route reads the NEXT_LOCALE cookie to determine the user's language and
 * returns translated error strings.  These tests verify that the correct
 * language is used for each rejection reason without touching the database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSessionCookie, createRequest } from '../../helpers/apiTestHelpers';
import { ApiError } from '@/lib/server/errors';

// ---- Mock heavy server infrastructure ----------------------------------------

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

// ---- Import mocked modules ---------------------------------------------------

import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { initiateBattle } from '@/lib/server/battle/battleService';
import { getBattleCache } from '@/lib/server/battle/BattleCache';
import { upsertNpcUser } from '@/lib/server/npc/npcCombat';
import { POST } from '@/app/api/attack/route';
import { NPC_USER_ID_OFFSET } from '@/lib/server/npc/npcConstants';

const ATTACKER_USER_ID = 1;
const TARGET_USER_ID = 2;
const NPC_TARGET_ID = NPC_USER_ID_OFFSET + 1; // valid NPC id

function makeSessionMock(userId: number) {
  (getIronSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId });
}

function makeUserCacheMock(attackerLevel: number, targetLevel: number) {
  const mockUserCache = {
    getUserByIdWithLock: vi.fn().mockImplementation((_ctx: unknown, id: number) => {
      if (id === ATTACKER_USER_ID) return Promise.resolve({ id: ATTACKER_USER_ID, getLevel: () => attackerLevel });
      if (id === TARGET_USER_ID) return Promise.resolve({ id: TARGET_USER_ID, getLevel: () => targetLevel });
      if (id === NPC_TARGET_ID) return Promise.resolve({ id: NPC_TARGET_ID, getLevel: () => targetLevel });
      return Promise.resolve(null);
    }),
  };
  (UserCache.getInstance2 as ReturnType<typeof vi.fn>).mockReturnValue(mockUserCache);
  return mockUserCache;
}

function makeNpcManagerMock(npc: { defeated?: boolean; inBattle?: boolean } | null) {
  const mockNpcManager = {
    getNpcById: vi.fn().mockReturnValue(npc),
    setInBattle: vi.fn(),
  };
  (NPCManager.getInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockNpcManager);
}

function makeBattleCacheMock(recentAttackees: number[] = []) {
  (getBattleCache as ReturnType<typeof vi.fn>).mockReturnValue({
    getRecentAttackees: vi.fn().mockResolvedValue(recentAttackees),
  });
}

async function postAttack(targetUserId: number, locale: string): Promise<{ status: number; body: { error?: string } }> {
  const sessionCookie = await createMockSessionCookie(ATTACKER_USER_ID);
  // Pass the full cookie string (session + locale) via additionalHeaders only,
  // leaving the sessionCookie param empty so createRequest does not overwrite it.
  const req = createRequest(
    'http://localhost:3000/api/attack',
    'POST',
    { targetUserId },
    undefined,
    { cookie: `${sessionCookie}; NEXT_LOCALE=${locale}` }
  );
  const res = await POST(req);
  const body = await res.json() as { error?: string };
  return { status: res.status, body };
}

// ---- Tests -------------------------------------------------------------------

describe('attack route — localized error messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeBattleCacheMock();
  });

  describe('NPC defeated', () => {
    beforeEach(() => {
      makeSessionMock(ATTACKER_USER_ID);
      makeNpcManagerMock({ defeated: true, inBattle: false });
    });

    it('attackRoute_npcDefeated_englishLocale_returnsEnglishError', async () => {
      const { status, body } = await postAttack(NPC_TARGET_ID, 'en');
      expect(status).toBe(400);
      expect(body.error).toBe('This NPC has already been defeated.');
    });

    it('attackRoute_npcDefeated_germanLocale_returnsGermanError', async () => {
      const { status, body } = await postAttack(NPC_TARGET_ID, 'de');
      expect(status).toBe(400);
      expect(body.error).toBe('Dieser NPC wurde bereits besiegt.');
    });
  });

  describe('NPC in battle', () => {
    beforeEach(() => {
      makeSessionMock(ATTACKER_USER_ID);
      makeNpcManagerMock({ defeated: false, inBattle: true });
    });

    it('attackRoute_npcInBattle_englishLocale_returnsEnglishError', async () => {
      const { status, body } = await postAttack(NPC_TARGET_ID, 'en');
      expect(status).toBe(400);
      expect(body.error).toBe('This NPC is already in battle.');
    });

    it('attackRoute_npcInBattle_germanLocale_returnsGermanError', async () => {
      const { status, body } = await postAttack(NPC_TARGET_ID, 'de');
      expect(status).toBe(400);
      expect(body.error).toBe('Dieser NPC befindet sich bereits in einem Kampf.');
    });
  });

  describe('NPC recently attacked', () => {
    beforeEach(() => {
      makeSessionMock(ATTACKER_USER_ID);
      makeUserCacheMock(5, 5);
      makeNpcManagerMock({ defeated: false, inBattle: false });
      makeBattleCacheMock([NPC_TARGET_ID]);
      (upsertNpcUser as ReturnType<typeof vi.fn>).mockResolvedValue({ createdNow: false });
    });

    it('attackRoute_npcRecentlyAttacked_englishLocale_doesNotApplyRecentCooldown', async () => {
      (initiateBattle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(400, 'Target is too far away (150.0 units, max 100)')
      );
      const { status, body } = await postAttack(NPC_TARGET_ID, 'en');
      expect(status).toBe(400);
      expect(body.error).toBe('Target is too far away.');
    });

    it('attackRoute_npcRecentlyAttacked_germanLocale_doesNotApplyRecentCooldown', async () => {
      (initiateBattle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(400, 'Target is too far away (150.0 units, max 100)')
      );
      const { status, body } = await postAttack(NPC_TARGET_ID, 'de');
      expect(status).toBe(400);
      expect(body.error).toBe('Das Ziel ist zu weit entfernt.');
    });
  });

  describe('level difference too large', () => {
    beforeEach(() => {
      makeSessionMock(ATTACKER_USER_ID);
      makeUserCacheMock(1, 10); // attacker level 1, target level 10 → difference > 3
    });

    it('attackRoute_levelTooFar_englishLocale_returnsEnglishError', async () => {
      const { status, body } = await postAttack(TARGET_USER_ID, 'en');
      expect(status).toBe(400);
      expect(body.error).toBe('Level difference too large to attack this target.');
    });

    it('attackRoute_levelTooFar_germanLocale_returnsGermanError', async () => {
      const { status, body } = await postAttack(TARGET_USER_ID, 'de');
      expect(status).toBe(400);
      expect(body.error).toBe('Stufenunterschied zu groß, um dieses Ziel anzugreifen.');
    });
  });

  describe('battleService rejection reasons', () => {
    beforeEach(() => {
      makeSessionMock(ATTACKER_USER_ID);
      makeUserCacheMock(5, 5); // same level — passes level check
    });

    const cases: Array<{
      serviceError: string;
      enMessage: string;
      deMessage: string;
    }> = [
      {
        serviceError: 'You are already in a battle',
        enMessage: 'You are already in a battle.',
        deMessage: 'Du befindest dich bereits in einem Kampf.',
      },
      {
        serviceError: 'Target is already in a battle',
        enMessage: 'Target is already in a battle.',
        deMessage: 'Das Ziel befindet sich bereits in einem Kampf.',
      },
      {
        serviceError: 'Both users must have ships to battle',
        enMessage: 'Both players must have ships to battle.',
        deMessage: 'Beide Spieler müssen ein Schiff haben, um zu kämpfen.',
      },
      {
        serviceError: 'You have attacked this player recently. Choose a different target.',
        enMessage: 'You have attacked this player recently. Choose a different target.',
        deMessage: 'Du hast diesen Spieler kürzlich angegriffen. Wähle ein anderes Ziel.',
      },
      {
        serviceError: 'Target is too far away (150.0 units, max 100)',
        enMessage: 'Target is too far away.',
        deMessage: 'Das Ziel ist zu weit entfernt.',
      },
      {
        serviceError: 'You need at least one weapon to attack',
        enMessage: 'You need at least one weapon to attack.',
        deMessage: 'Du brauchst mindestens eine Waffe, um anzugreifen.',
      },
    ];

    for (const { serviceError, enMessage, deMessage } of cases) {
      it(`attackRoute_${serviceError.slice(0, 30)}_englishLocale_returnsEnglishError`, async () => {
        (initiateBattle as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(400, serviceError));
        const { status, body } = await postAttack(TARGET_USER_ID, 'en');
        expect(status).toBe(400);
        expect(body.error).toBe(enMessage);
      });

      it(`attackRoute_${serviceError.slice(0, 30)}_germanLocale_returnsGermanError`, async () => {
        (initiateBattle as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(400, serviceError));
        const { status, body } = await postAttack(TARGET_USER_ID, 'de');
        expect(status).toBe(400);
        expect(body.error).toBe(deMessage);
      });
    }
  });
});
