// ---
// Battle Defense Persistence Test - Verify defense values persist after battle ends
// Tests that hull/armor/shield values are not reset to max after battle completion
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserCache } from '../../lib/server/user/userCache';
import * as battleService from '../../lib/server/battle/battleService';
import { User } from '../../lib/server/user/user';
import { BATTLE_LOCK, USER_LOCK } from '../../lib/server/typedLocks';
import { createLockContext} from '@markdrei/ironguard-typescript-locks';
import type { BattleStats } from '../../lib/server/battle/battleTypes';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { TechService } from '../../lib/server/techs/TechService';

describe('Battle Defense Persistence', () => {

  let userWorldCache: UserCache;
  let emptyCtx: ReturnType<typeof createLockContext>;
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
    userWorldCache = UserCache.getInstance2();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('defenseValues_afterBattleEnds_notResetToMax', { timeout: 15000 }, async () => {
    await withTransaction(async () => {
      console.log('🧪 Testing defense value persistence after battle ends...');
      
      // Get test users (seeded by test database)
      let attacker: User | null = null;
      let defender: User | null = null;
      
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        // Use usernames instead of hardcoded IDs 1 and 2 to be robust against sequence changes
        attacker = await userWorldCache.getUserByUsername(userContext, 'a');
        defender = await userWorldCache.getUserByUsername(userContext, 'dummy');
      });
      
      if (!attacker || !defender) {
        throw new Error(`Test users not found (attacker=${attacker?.id}, defender=${defender?.id})`);
      }
      
      // TypeScript now knows these are not null
      const attackerUser = attacker as User;
      const defenderUser = defender as User;
      
      // Record initial defense values
      const attackerInitialHull = attackerUser.hullCurrent;
      const defenderInitialHull = defenderUser.hullCurrent;
      
      console.log(`📊 Attacker initial hull: ${attackerInitialHull}`);
      console.log(`📊 Defender initial hull: ${defenderInitialHull}`);
      
      // Calculate max values using TechService (includes research factors)
      const attackerMaxStats = TechService.calculateMaxDefense(attackerUser.techCounts, attackerUser.techTree);
      const defenderMaxStats = TechService.calculateMaxDefense(defenderUser.techCounts, defenderUser.techTree);
      
      console.log(`📊 Attacker max hull: ${attackerMaxStats.hull}`);
      console.log(`📊 Defender max hull: ${defenderMaxStats.hull}`);
      
      // Set defense values to half of max to test persistence
      attackerUser.hullCurrent = Math.floor(attackerMaxStats.hull / 2);
      attackerUser.armorCurrent = Math.floor(attackerMaxStats.armor / 2);
      attackerUser.shieldCurrent = Math.floor(attackerMaxStats.shield / 2);
      defenderUser.hullCurrent = Math.floor(defenderMaxStats.hull / 2);
      defenderUser.armorCurrent = Math.floor(defenderMaxStats.armor / 2);
      defenderUser.shieldCurrent = Math.floor(defenderMaxStats.shield / 2);
      
      // Update initial values after modification
      const attackerInitialHull2 = attackerUser.hullCurrent;
      const defenderInitialHull2 = defenderUser.hullCurrent;
      
      console.log(`📊 Attacker initial hull (after set): ${attackerInitialHull2}`);
      console.log(`📊 Defender initial hull (after set): ${defenderInitialHull2}`);
      
      // Verify users now start at less than max
      expect(attackerInitialHull2).toBeLessThan(attackerMaxStats.hull);
      expect(defenderInitialHull2).toBeLessThan(defenderMaxStats.hull);
      
      // Create battle stats manually with specific damaged values
      const attackerDamagedHull = attackerInitialHull2 - 100; // Remove 100 hull
      
      const attackerStats: BattleStats = {
        hull: { current: attackerUser.hullCurrent, max: attackerMaxStats.hull },
        armor: { current: attackerUser.armorCurrent, max: attackerMaxStats.armor },
        shield: { current: attackerUser.shieldCurrent, max: attackerMaxStats.shield },
        weapons: {}
      };
      
      const defenderStats: BattleStats = {
        hull: { current: defenderUser.hullCurrent, max: defenderMaxStats.hull },
        armor: { current: defenderUser.armorCurrent, max: defenderMaxStats.armor },
        shield: { current: defenderUser.shieldCurrent, max: defenderMaxStats.shield },
        weapons: {}
      };
      
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        const battle = await emptyCtx.useLockWithAcquire(USER_LOCK, async (damageUserCtx) => {
          // Create battle directly through BattleCache
          const battleCache = getBattleCache();
          const battle = await battleCache.createBattle(
            battleCtx,
            damageUserCtx,
            attackerUser.id,
            defenderUser.id,
            attackerStats,
            defenderStats,
            {},
            {}
          );
          
          console.log(`⚔️ Battle ${battle.id} created`);
          
          // Apply damage to User objects in cache (not just battle stats)
          const attackerInCache = await userWorldCache.getUserByIdWithLock(damageUserCtx, attackerUser.id);
          const defenderInCache = await userWorldCache.getUserByIdWithLock(damageUserCtx, defenderUser.id);
          
          if (!attackerInCache || !defenderInCache) {
            throw new Error('Users not found for damage application');
          }
          
          // Apply damage to attacker
          attackerInCache.hullCurrent = attackerDamagedHull;
          userWorldCache.updateUserInCache(damageUserCtx, attackerInCache);
          
          // Set defender to 0 hull (they will lose)
          defenderInCache.hullCurrent = 0;
          userWorldCache.updateUserInCache(damageUserCtx, defenderInCache);
          
          console.log(`💥 Simulated damage - Attacker hull: ${attackerDamagedHull}, Defender hull: 0`);
          return battle;
        });

        // Call resolveBattle to end the battle and update user defense values
        await battleService.resolveBattle(battleCtx, battle.id, attackerUser.id);

        console.log(`💥 Battle resolved`);
      });
      
      
      console.log('✅ Battle ended');
      
      // Re-load users from cache to check they weren't reset
      console.log('🔄 Checking users in cache...');
      
      let attackerAfter: User | null = null;
      let defenderAfter: User | null = null;
      
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx2) => {
        attackerAfter = await userWorldCache.getUserByIdWithLock(userCtx2, attackerUser.id);
        defenderAfter = await userWorldCache.getUserByIdWithLock(userCtx2, defenderUser.id);
        
        if (!attackerAfter || !defenderAfter) {
          throw new Error('Users not found in cache after battle');
        }
        
        console.log(`📊 Attacker after battle - Hull: ${attackerAfter.hullCurrent} (expected: ${attackerDamagedHull})`);
        console.log(`📊 Defender after battle - Hull: ${defenderAfter.hullCurrent} (expected: 0 since they lost)`);
        
        // CRITICAL: Verify defense values are NOT reset to max
        expect(attackerAfter.hullCurrent).toBe(attackerDamagedHull);
        expect(attackerAfter.hullCurrent).not.toBe(attackerMaxStats.hull);
        // Don't check initial hull as it may have changed due to regeneration
        
        // Defender was set to 0 hull to make them lose
        expect(defenderAfter.hullCurrent).toBe(0);
        expect(defenderAfter.hullCurrent).not.toBe(defenderMaxStats.hull);
        // Don't check initial hull as it was intentionally set to 0 during battle
      });
      
      console.log('✅ Defense values correctly persisted after battle (not reset to max)');
    });
  });
});
