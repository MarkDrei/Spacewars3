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

// helper to patch user iron directly in cache
async function setUserIron(ctx: ReturnType<typeof createLockContext>, userId: number, amount: number) {
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const userCache = UserCache.getInstance2();
    const user = await userCache.getUserByIdWithLock(userCtx, userId);
    if (!user) throw new Error('user not found');
    user.iron = amount;
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
        weapons: {}
      };
      const defenderStats: BattleStats = {
        hull: { current: 0, max: 100 },
        armor: { current: 0, max: 50 },
        shield: { current: 0, max: 25 },
        weapons: {}
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
        attackerId = att!.id;
        defenderId = def!.id;
        // set a low capacity on attacker
        att!.techTree.ironCapacity = 1; // assuming effect=5000? but we will reduce iron to near cap
        att!.iron = att!.getMaxIronCapacity() - 50; // leave 50 capacity
        def!.iron = 200;
        await userCache.updateUserInCache(userCtx, att!);
        await userCache.updateUserInCache(userCtx, def!);
      });

      // prepare battle same as before
      const attackerStats: BattleStats = {
        hull: { current: 100, max: 100 },
        armor: { current: 50, max: 50 },
        shield: { current: 25, max: 25 },
        weapons: {}
      };
      const defenderStats: BattleStats = {
        hull: { current: 0, max: 100 },
        armor: { current: 0, max: 50 },
        shield: { current: 0, max: 25 },
        weapons: {}
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
});
