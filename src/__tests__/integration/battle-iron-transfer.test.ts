// ---
// Battle iron transfer integration tests
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BATTLE_LOCK, USER_LOCK } from '../../lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserCache } from '../../lib/server/user/userCache';
import * as battleService from '../../lib/server/battle/battleService';
import { BattleStats } from '../../lib/server/battle/battleTypes';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';

// helper to patch user iron directly in cache
async function setUserIron(ctx: ReturnType<typeof createLockContext>, userId: number, amount: number) {
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const userCache = UserCache.getInstance2();
    const user = await userCache.getUserByIdWithLock(userCtx, userId);
    if (!user) throw new Error('user not found');
    user.iron = amount;
    // Prevent passive iron regeneration from changing exact battle-transfer assertions.
    user.last_updated = Math.floor(Date.now() / 1000) + 60;
    await userCache.updateUserInCache(userCtx, user);
  });
}

describe('Battle iron transfer', () => {
  let emptyCtx: ReturnType<typeof createLockContext>;
  let battleCache: ReturnType<typeof getBattleCache>;
  let userCache: UserCache;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
    battleCache = getBattleCache();
    userCache = UserCache.getInstance2();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('winnerReceivesLoserIron_upToCapacity_andMessageReflected', async () => {
    await withTransaction(async () => {
      // grab two existing users 'a' and 'dummy' from seed
      let attackerId: number = 0;
      let defenderId: number = 0;
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const att = await userCache.getUserByUsername(userCtx, 'a');
        const def = await userCache.getUserByUsername(userCtx, 'dummy');
        expect(att).not.toBeNull();
        expect(def).not.toBeNull();
        attackerId = att!.id;
        defenderId = def!.id;
      });

      // set iron values (ids were populated above)
      await setUserIron(emptyCtx, attackerId, 100);
      await setUserIron(emptyCtx, defenderId, 200);

      // prepare battle
      const attackerStats: BattleStats = {
        hull: { current: 100, max: 100 },
        armor: { current: 50, max: 50 },
        shield: { current: 25, max: 25 },
      };
      const defenderStats: BattleStats = {
        hull: { current: 0, max: 100 },
        armor: { current: 0, max: 50 },
        shield: { current: 0, max: 25 },
      };

      const cooldowns: Record<string, number> = {};

      let battleId: number;
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const battle = await battleCache!.createBattle(
            battleCtx,
            userCtx,
            attackerId,
            defenderId,
            attackerStats,
            defenderStats,
            cooldowns,
            {}
          );
          battleId = battle.id;
        });
      });

      // resolve battle as attacker winner
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleService.resolveBattle(battleCtx, battleId!, attackerId, defenderId);
      });

      // verify iron updated
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const winner = await userCache.getUserByIdWithLock(userCtx, attackerId);
        const loser = await userCache.getUserByIdWithLock(userCtx, defenderId);
        expect(winner?.iron).toBe(300); // 100 + 200
        expect(loser?.iron).toBe(0);
      });

      // verify messages contain the correct amount
      const msgCache = (await import('../../lib/server/messages/MessageCache')).MessageCache.getInstance();
      const [winnerMsgs, loserMsgs] = await Promise.all([
        msgCache.getMessagesForUser(emptyCtx, attackerId),
        msgCache.getMessagesForUser(emptyCtx, defenderId)
      ]);
      expect(winnerMsgs.some(m => m.message.includes('gained 200 iron'))).toBe(true);
      expect(loserMsgs.some(m => m.message.includes('lost 200 iron'))).toBe(true);
    });
  });

  it('winnerCapacityLimitsTransfer', async () => {
    await withTransaction(async () => {
      let attackerId: number = 0;
      let defenderId: number = 0;
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const att = await userCache.getUserByUsername(userCtx, 'a');
        const def = await userCache.getUserByUsername(userCtx, 'dummy');
        const frozenLastUpdated = Math.floor(Date.now() / 1000) + 60;
        attackerId = att!.id;
        defenderId = def!.id;
        // set a low capacity on attacker
        att!.techTree.ironCapacity = 1; // assuming effect=5000? but we will reduce iron to near cap
        att!.iron = att!.getMaxIronCapacity() - 50; // leave 50 capacity
        att!.last_updated = frozenLastUpdated;
        def!.iron = 200;
        def!.last_updated = frozenLastUpdated;
        await userCache.updateUserInCache(userCtx, att!);
        await userCache.updateUserInCache(userCtx, def!);
      });

      // prepare battle same as before
      const attackerStats: BattleStats = {
        hull: { current: 100, max: 100 },
        armor: { current: 50, max: 50 },
        shield: { current: 25, max: 25 },
      };
      const defenderStats: BattleStats = {
        hull: { current: 0, max: 100 },
        armor: { current: 0, max: 50 },
        shield: { current: 0, max: 25 },
      };
      const cooldowns: Record<string, number> = {};

      let battleId: number;
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const battle = await battleCache!.createBattle(
            battleCtx,
            userCtx,
            attackerId,
            defenderId,
            attackerStats,
            defenderStats,
            cooldowns,
            {}
          );
          battleId = battle.id;
        });
      });

      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleService.resolveBattle(battleCtx, battleId!, attackerId, defenderId);
      });

      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const winner = await userCache.getUserByIdWithLock(userCtx, attackerId);
        const loser = await userCache.getUserByIdWithLock(userCtx, defenderId);
        // winner should have gained max 50 iron
        expect(winner!.iron).toBe(winner!.getMaxIronCapacity());
        expect(loser!.iron).toBe(200 - 50);
      });
    });
  });

  it('winnerAboveBaseCapacityWithLevelBonus_transfersUpToBonusedCapacity', async () => {
    await withTransaction(async () => {
      let attackerId: number = 0;
      let defenderId: number = 0;

      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const att = await userCache.getUserByUsername(userCtx, 'a');
        const def = await userCache.getUserByUsername(userCtx, 'dummy');
        const frozenLastUpdated = Math.floor(Date.now() / 1000) + 60;
        expect(att).not.toBeNull();
        expect(def).not.toBeNull();

        attackerId = att!.id;
        defenderId = def!.id;

        att!.addXp(1000); // level 2 => storage capacity bonus applies
        att!.iron = 5600; // above base cap (5000), below bonused cap (5750)
        att!.last_updated = frozenLastUpdated;
        def!.iron = 200;
        def!.last_updated = frozenLastUpdated;

        await userCache.updateUserInCache(userCtx, att!);
        await userCache.updateUserInCache(userCtx, def!);
      });

      const attackerStats: BattleStats = {
        hull: { current: 100, max: 100 },
        armor: { current: 50, max: 50 },
        shield: { current: 25, max: 25 },
      };
      const defenderStats: BattleStats = {
        hull: { current: 0, max: 100 },
        armor: { current: 0, max: 50 },
        shield: { current: 0, max: 25 },
      };
      const cooldowns: Record<string, number> = {};

      let battleId: number;
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const battle = await battleCache!.createBattle(
            battleCtx,
            userCtx,
            attackerId,
            defenderId,
            attackerStats,
            defenderStats,
            cooldowns,
            {}
          );
          battleId = battle.id;
        });
      });

      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleService.resolveBattle(battleCtx, battleId!, attackerId, defenderId);
      });

      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const winner = await userCache.getUserByIdWithLock(userCtx, attackerId);
        const loser = await userCache.getUserByIdWithLock(userCtx, defenderId);

        expect(winner).not.toBeNull();
        expect(loser).not.toBeNull();

        const winnerBonuses = await userCache.getBonusesByUserIdWithLock(userCtx, attackerId);

        expect(winner!.iron).toBe(winnerBonuses.ironStorageCapacity);
        expect(loser!.iron).toBe(50);
      });

      const msgCache = (await import('../../lib/server/messages/MessageCache')).MessageCache.getInstance();
      const [winnerMsgs, loserMsgs] = await Promise.all([
        msgCache.getMessagesForUser(emptyCtx, attackerId),
        msgCache.getMessagesForUser(emptyCtx, defenderId)
      ]);

      expect(winnerMsgs.some(m => m.message.includes('gained 150 iron'))).toBe(true);
      expect(loserMsgs.some(m => m.message.includes('lost 150 iron'))).toBe(true);
      expect(winnerMsgs.some(m => m.message.includes('gained -'))).toBe(false);
    });
  });

  it('npcWins_playerLosesAllIron_messageReflected', async () => {
    await withTransaction(async () => {
      // The NPC is the attacker (winner), the player is the defender (loser)
      let playerId: number = 0;
      let npcId: number = 0;
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const player = await userCache.getUserByUsername(userCtx, 'a');
        expect(player).not.toBeNull();
        playerId = player!.id;
      });

      // Use a deterministic NPC id (owner=playerId, index=0).
      const { npcUserId } = await import('@/lib/server/npc/npcConstants');
      npcId = npcUserId(playerId, 0);

      // Seed the ship row first so upsertNpcUser can safely point ship_id at it.
      const db = await getDatabase();
      await db.query(
        'INSERT INTO space_objects (id, type, x, y, speed, angle, last_position_update_ms, picture_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
        [npcId, 'player_ship', 4000, 4000, 0, 0, Date.now(), 1]
      );

      // Upsert NPC user into DB and cache.
      const { upsertNpcUser } = await import('@/lib/server/npc/npcCombat');
      const mockNpc = {
        id: npcId,
        ownerId: playerId,
        npcIndex: 0,
        level: 1,
        orbitAngleDeg: 0,
        defeated: false,
        defeatTime: null,
        npcUserCreated: false,
        inBattle: false,
        lastUpdateMs: Date.now(),
      };
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        await upsertNpcUser(mockNpc, userCtx);
      });

      // Give the player 500 iron and ensure the NPC does not receive it.
      await setUserIron(emptyCtx, playerId, 500);
      await setUserIron(emptyCtx, npcId, 50);

      const attackerStats: BattleStats = {
        hull: { current: 100, max: 100 },
        armor: { current: 50, max: 50 },
        shield: { current: 25, max: 25 },
      };
      const defenderStats: BattleStats = {
        hull: { current: 0, max: 100 },
        armor: { current: 0, max: 50 },
        shield: { current: 0, max: 25 },
      };

      let battleId: number;
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const battle = await battleCache!.createBattle(
            battleCtx,
            userCtx,
            npcId,      // NPC is attacker
            playerId,   // player is defender (loser)
            attackerStats,
            defenderStats,
            {},
            {}
          );
          battleId = battle.id;
        });
      });

      // NPC wins — player is the loser
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        await battleService.resolveBattle(battleCtx, battleId!, npcId, playerId);
      });

      // Player should have zero iron and the NPC should not gain the missing iron.
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const player = await userCache.getUserByIdWithLock(userCtx, playerId);
        const npc = await userCache.getUserByIdWithLock(userCtx, npcId);
        expect(player!.iron).toBe(0);
        expect(npc!.iron).toBe(50);
      });

      // Player should receive a defeat message mentioning iron lost
      const msgCache = (await import('@/lib/server/messages/MessageCache')).MessageCache.getInstance();
      const playerMsgs = await msgCache.getMessagesForUser(emptyCtx, playerId);
      expect(playerMsgs.some(m => m.message.includes('lost 500 iron'))).toBe(true);
    });
  });
});
