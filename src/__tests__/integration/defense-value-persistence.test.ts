// ---
// Defense Value Persistence Integration Test
// Validates that hull/armor/shield values persist correctly after battles
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBattleCache, getBattleCacheInitialized } from '../../lib/server/battle/BattleCache';
import * as BattleRepo from '../../lib/server/battle/BattleCache';
import * as battleService from '../../lib/server/battle/battleService';
import type { BattleStats, WeaponCooldowns } from '../../lib/server/battle/battleTypes';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { getDatabase } from '@/lib/server/database';
import { UserCache } from '@/lib/server/user/userCache';

describe('Defense Value Persistence After Battle', () => {
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('defenseValues_afterBattleResolution_persistCorrectly', async () => {
    // === Phase 1: Setup ===
    const battleCache = getBattleCache();
    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();

    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
        // Load users from cache
        const attacker = await userWorldCache.getUserById(battleContext, 1);
        const defender = await userWorldCache.getUserById(battleContext, 2);
    
        expect(attacker).not.toBeNull();
        expect(defender).not.toBeNull();
    
        // Record initial defense values
        const initialAttackerHull = attacker!.hullCurrent;
        const initialDefenderHull = defender!.hullCurrent;
    
        console.log(`Initial attacker hull: ${initialAttackerHull}`);
        console.log(`Initial defender hull: ${initialDefenderHull}`);
    
        // === Phase 2: Create Battle ===
        const attackerStats: BattleStats = {
          hull: { current: initialAttackerHull, max: 500 },
          armor: { current: 250, max: 500 },
          shield: { current: 250, max: 500 },
          weapons: {
            pulse_laser: { count: 5, damage: 100, cooldown: 2 }
          }
        };
        
        const defenderStats: BattleStats = {
          hull: { current: initialDefenderHull, max: 500 },
          armor: { current: 250, max: 500 },
          shield: { current: 250, max: 500 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2 }
          }
        };
    
        const attackerCooldowns: WeaponCooldowns = { pulse_laser: 0 };
        const defenderCooldowns: WeaponCooldowns = { pulse_laser: 5 };
    
      await getBattleCacheInitialized();
      const battle = await battleContext.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        return await battleCache.createBattle(
          battleContext,
          userCtx,
          attacker!.id,
          defender!.id,
          attackerStats,
          defenderStats,
          attackerCooldowns,
          defenderCooldowns
        );
      });
    
        console.log(`Battle ${battle.id} created`);
    
        // Verify startStats are captured correctly
        expect(battle.attackerStartStats.hull.current).toBe(initialAttackerHull);
        expect(battle.attackeeStartStats.hull.current).toBe(initialDefenderHull);
    
        // === Phase 3: Process Battle Turns ===
        // Process first turn
        await battleService.updateBattle(battleContext, battle.id);
        
        let currentBattle = await BattleRepo.getBattle(battleContext, battle.id);
        console.log(`After first update - Battle ended: ${currentBattle?.battleEndTime !== null}`);
        console.log(`After first update - Attacker end hull: ${currentBattle?.attackerEndStats?.hull.current}`);
        console.log(`After first update - Defender end hull: ${currentBattle?.attackeeEndStats?.hull.current}`);
    
        // Verify that startStats remain unchanged
        expect(currentBattle?.attackerStartStats.hull.current).toBe(initialAttackerHull);
        expect(currentBattle?.attackeeStartStats.hull.current).toBe(initialDefenderHull);
    
        // Verify that endStats exist and show damage
        expect(currentBattle?.attackerEndStats).not.toBeNull();
        expect(currentBattle?.attackeeEndStats).not.toBeNull();
        
        // At least one side should have taken damage
        const attackerTookDamage = (currentBattle?.attackerEndStats?.hull.current ?? initialAttackerHull) < initialAttackerHull;
        const defenderTookDamage = (currentBattle?.attackeeEndStats?.hull.current ?? initialDefenderHull) < initialDefenderHull;
        expect(attackerTookDamage || defenderTookDamage).toBe(true);
    
        // === Phase 4: Resolve Battle (if not already ended) ===
        // Continue battle until someone wins
        let iterations = 1;
        const maxIterations = 50;
        
        while (currentBattle && !currentBattle.battleEndTime && iterations < maxIterations) {
          await battleService.updateBattle(battleContext, currentBattle.id);
          currentBattle = await BattleRepo.getBattle(battleContext, currentBattle.id);
          iterations++;
        }
    
        expect(currentBattle?.battleEndTime).not.toBeNull();
        console.log(`Battle ended after ${iterations} iterations`);
    
        // === Phase 5: Verify Defense Values Persisted ===
        // Flush cache to ensure values are written to DB
        await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
          await userWorldCache.flushAllToDatabaseWithLock(userContext);
        });

        const loadUserDefenses = async (userId: number) => {
          const db = await getDatabase();
          return await new Promise<{ hull_current: number }>((resolve, reject) => {
            db.get(
              'SELECT hull_current FROM users WHERE id = ?',
              [userId],
              (err, row) => {
                if (err) {
                  reject(err);
                  return;
                }
                if (!row) {
                  reject(new Error(`User ${userId} not found in database`));
                  return;
                }
                resolve(row as { hull_current: number });
              }
            );
          });
        };

        const [reloadedAttacker, reloadedDefender] = await Promise.all([
          loadUserDefenses(attacker!.id),
          loadUserDefenses(defender!.id)
        ]);

        console.log(`Reloaded attacker hull: ${reloadedAttacker.hull_current}`);
        console.log(`Reloaded defender hull: ${reloadedDefender.hull_current}`);

        const finalAttackerHull = currentBattle?.attackerEndStats?.hull.current ?? initialAttackerHull;
        const finalDefenderHull = currentBattle?.attackeeEndStats?.hull.current ?? initialDefenderHull;

        expect(reloadedAttacker.hull_current).toBe(finalAttackerHull);
        expect(reloadedDefender.hull_current).toBe(finalDefenderHull);

        const attackerDestroyed = reloadedAttacker.hull_current === 0;
        const defenderDestroyed = reloadedDefender.hull_current === 0;
        expect(attackerDestroyed || defenderDestroyed).toBe(true);
    
    });

  });
});
