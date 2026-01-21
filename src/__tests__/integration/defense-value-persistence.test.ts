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
import { UserCache } from '@/lib/server/user/userCache';
import { withTransaction } from '../helpers/transactionHelper';
import { TechService } from '../../lib/server/techs/TechService';
import { getDatabase } from '../../lib/server/database';

describe('Defense Value Persistence After Battle', () => {
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('defenseValues_afterBattleResolution_persistCorrectly', { timeout: 30000 }, async () => {
    await withTransaction(async () => {
      // === Phase 1: Setup ===
      const battleCache = getBattleCache();
      const emptyCtx = createLockContext();
      const userWorldCache = UserCache.getInstance2();
      let attackerId = 0, defenderId = 0;
      let initialAttackerHull = 0, initialDefenderHull = 0;
      let attackerStats: BattleStats, defenderStats: BattleStats;
      let attackerCooldowns: WeaponCooldowns, defenderCooldowns: WeaponCooldowns;

      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
        // 1. Get initial stats (Scope 1 for USER_LOCK)
        await battleContext.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          // Load users from cache
          const attacker = await userWorldCache.getUserByUsername(userCtx, 'a');
          const defender = await userWorldCache.getUserByUsername(userCtx, 'dummy');
      
          expect(attacker).not.toBeNull();
          expect(defender).not.toBeNull();
          attackerId = attacker!.id;
          defenderId = defender!.id;
      
          // Record initial defense values
          initialAttackerHull = attacker!.hullCurrent;
          initialDefenderHull = defender!.hullCurrent;
      
          console.log(`Initial attacker hull: ${initialAttackerHull}`);
          console.log(`Initial defender hull: ${initialDefenderHull}`);
      
          // Calculate max values using TechService
          const attackerMaxStats = TechService.calculateMaxDefense(attacker!.techCounts, attacker!.techTree);
          const defenderMaxStats = TechService.calculateMaxDefense(defender!.techCounts, defender!.techTree);

          attackerStats = {
            hull: { current: attacker!.hullCurrent, max: attackerMaxStats.hull },
            armor: { current: attacker!.armorCurrent, max: attackerMaxStats.armor },
            shield: { current: attacker!.shieldCurrent, max: attackerMaxStats.shield },
            weapons: { pulse_laser: { count: 5, damage: 100, cooldown: 0 } }
          };
          defenderStats = {
            hull: { current: defender!.hullCurrent, max: defenderMaxStats.hull },
            armor: { current: defender!.armorCurrent, max: defenderMaxStats.armor },
            shield: { current: defender!.shieldCurrent, max: defenderMaxStats.shield },
            weapons: { pulse_laser: { count: 1, damage: 10, cooldown: 0 } }
          };
          attackerCooldowns = { pulse_laser: 0 };
          defenderCooldowns = { pulse_laser: 5 };
        });

        // 2. Create Battle (Scope 2 for USER_LOCK)
        await getBattleCacheInitialized();
        const battle = await battleContext.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache.createBattle(
            battleContext,
            userCtx,
            attackerId,
            defenderId,
            attackerStats,
            defenderStats,
            attackerCooldowns,
            defenderCooldowns
          );
        });
        
        console.log(`Battle ${battle.id} created`);
    
        // Verify startStats
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
    
        // If battle hasn't ended, endStats should still be null
        if (!currentBattle?.battleEndTime) {
           expect(currentBattle?.attackerEndStats).toBeNull();
           expect(currentBattle?.attackeeEndStats).toBeNull();
        }

        // === Phase 4: Resolve Battle ===
        let iterations = 1;
        const maxIterations = 50;
        
        while (currentBattle && !currentBattle.battleEndTime && iterations < maxIterations) {
          await battleService.updateBattle(battleContext, currentBattle.id);
          
          await battleContext.useLockWithAcquire(USER_LOCK, async (userCtx) => {
             const d = await userWorldCache.getUserById(userCtx, defenderId);
             console.log(`Iter ${iterations}: Defender hull: ${d?.hullCurrent}, Shield: ${d?.shieldCurrent}, Armor: ${d?.armorCurrent}`);
          });

          currentBattle = await BattleRepo.getBattle(battleContext, currentBattle.id);
          iterations++;
        }
    
        expect(currentBattle?.battleEndTime).not.toBeNull();
        console.log(`Battle ended after ${iterations} iterations`);
    
        // === Phase 5: Verify Defense Values Persisted ===
        // Flush cache to ensure values are written to DB
        await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
          await userWorldCache.flushAllToDatabase(userContext);
        });

        const loadUserDefenses = async (userId: number) => {
          const db = await getDatabase();
          const result = await db.query(
            'SELECT hull_current FROM users WHERE id = $1',
            [userId]
          );
          if (result.rows.length === 0) {
            throw new Error(`User ${userId} not found in database`);
          }
          return result.rows[0] as { hull_current: number };
        };

        const [reloadedAttacker, reloadedDefender] = await Promise.all([
          loadUserDefenses(attackerId),
          loadUserDefenses(defenderId)
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
});
