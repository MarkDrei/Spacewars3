// ---
// BattleCache Integration Tests - Phase 5 Validation
// Focused tests for BattleCache with existing APIs
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import * as BattleRepo from '../../lib/server/battle/BattleCache';
import type { BattleStats, WeaponCooldowns } from '../../lib/server/battle/battleTypes';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { getDatabase } from '@/lib/server/database';
import { after } from 'node:test';

describe('Phase 5: BattleCache Integration Testing', () => {
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  describe('Core BattleCache Functionality', () => {

    let battleCache: BattleCache;
    let emptyCtx: ReturnType<typeof createLockContext>;

    beforeEach(async () => {
      emptyCtx = createLockContext();
      battleCache = getBattleCache();
    });

    it('battleCache_createBattle_storesInCache', async () => {
      const emptyCtx = createLockContext();
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        // Use test user IDs (created by createTestDatabase)
        const attackerId = 1;
        const defenderId = 2;

        // Define valid BattleStats with current/max structure
        const attackerStats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const defenderStats: BattleStats = {
          hull: { current: 80, max: 80 },
          armor: { current: 40, max: 40 },
          shield: { current: 20, max: 20 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };

        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        console.log('🚀 Creating battle for cache test...');

        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const battle = await battleCache.createBattle(
            battleCtx,
            userCtx,
            attackerId,
            defenderId,
            attackerStats,
            defenderStats,
            cooldowns,
            cooldowns
          );
  
          // Verify battle creation
          expect(battle).toBeDefined();
          expect(battle.id).toBeGreaterThan(0);
          expect(battle.attackerId).toBe(attackerId);
          expect(battle.attackeeId).toBe(defenderId);
  
          console.log('✅ Battle created with ID:', battle.id);
  
          // Verify battle is in cache
          const cachedBattle = battleCache.getBattleFromCache(battle.id);
          expect(cachedBattle).toBeDefined();
          expect(cachedBattle?.id).toBe(battle.id);
          expect(cachedBattle?.attackerId).toBe(attackerId);
          expect(cachedBattle?.attackeeId).toBe(defenderId);
  
          console.log('✅ Battle properly stored in cache');
        });
        
      });
    });

    it('battleCache_loadBattleIfNeeded_loadsFromDatabase', async () => {
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        const attackerId = 1;
        const defenderId = 2;

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache.createBattle(
            battleCtx,
            userCtx,
            attackerId,
            defenderId,
            stats,
            stats,
            cooldowns,
            cooldowns
          );
        });

        // Reset cache to force database load
        BattleCache.resetInstance();
        const freshCache = getBattleCache();

        console.log('🔄 Loading battle from database...');

        // Load battle (should come from database)
        const loadedBattle = await freshCache.loadBattleIfNeeded(battleCtx, battle.id);

        expect(loadedBattle).toBeDefined();
        expect(loadedBattle?.id).toBe(battle.id);
        expect(loadedBattle?.attackerId).toBe(attackerId);
        expect(loadedBattle?.attackeeId).toBe(defenderId);
      

        // Should now be in cache
        const cachedAfterLoad = freshCache.getBattleFromCache(battle.id);
        expect(cachedAfterLoad).toBeDefined();
        expect(cachedAfterLoad?.id).toBe(battle.id);

        console.log('✅ Battle loaded from database and cached');
      });
    });

    it('battleCache_getOngoingBattleForUser_findsUserBattle', async () => {
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        const attackerId = 1;
        const defenderId = 2;

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        // Create battle
        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache.createBattle(
            battleCtx,
            userCtx,
            attackerId,
            defenderId,
            stats,
            stats,
            cooldowns,
            cooldowns
          );
        });

        console.log('🔍 Finding ongoing battles for users...');

        // Both users should find the battle
        const attackerBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, attackerId);
        const defenderBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, defenderId);

        expect(attackerBattle?.id).toBe(battle.id);
        expect(defenderBattle?.id).toBe(battle.id);

        // Non-participant should not find the battle
        const outsiderBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, 99);
        expect(outsiderBattle).toBeNull();

        console.log('✅ User battle lookup working correctly');
      });
    });

    it('battleCache_getActiveBattles_returnsAllActive', async () => {
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        // Initially no active battles
        let activeBattles = await BattleRepo.getActiveBattles(battleCtx);
        expect(activeBattles).toHaveLength(0);

        console.log('🔄 Creating multiple battles...');

        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          // Create first battle
          const battle1 = await battleCache.createBattle(
            battleCtx, userCtx,
            1, 2, stats, stats, cooldowns, cooldowns
          );
  
          activeBattles = await BattleRepo.getActiveBattles(battleCtx);
          expect(activeBattles).toHaveLength(1);
          expect(activeBattles[0].id).toBe(battle1.id);
  
          // Create second battle
          const battle2 = await battleCache.createBattle(
            battleCtx, userCtx,
            3, 4, stats, stats, cooldowns, cooldowns
          );
  
          activeBattles = await BattleRepo.getActiveBattles(battleCtx);
          expect(activeBattles).toHaveLength(2);
          
          const battleIds = activeBattles.map(b => b.id);
          expect(battleIds).toContain(battle1.id);
          expect(battleIds).toContain(battle2.id);
  
        });

      });
    });

    it('battleCache_addBattleEvent_marksBattleDirty', async () => {
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        // Create battle
        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache.createBattle(
            battleCtx,
            userCtx,
            1,
            2,
            stats,
            stats,
            cooldowns,
            cooldowns
          );
        });

        // Initially not dirty (just created)
        const initialDirtyBattles = battleCache.getDirtyBattleIds();
        console.log('🧹 Initial dirty battles:', initialDirtyBattles.length);

        // Add battle event
        await BattleRepo.addBattleEvent(battleCtx, battle.id, {
          timestamp: Date.now(),
          type: 'damage_dealt',
          actor: 'attacker',
          data: { damage: 10, target: 'defender' }
        });

        // Battle should now be dirty
        const dirtyAfterEvent = battleCache.getDirtyBattleIds();
        expect(dirtyAfterEvent).toContain(battle.id);

        // Battle log should contain the event
        const updatedBattle = battleCache.getBattleFromCache(battle.id);
        expect(updatedBattle?.battleLog).toHaveLength(1);
        expect(updatedBattle?.battleLog[0].type).toBe('damage_dealt');

        console.log('✅ Battle events and dirty tracking working correctly');
      });
    });

    it('battleCache_endBattle_removesFromCache', async () => {
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const defeatedStats: BattleStats = {
          hull: { current: 0, max: 100 },
          armor: { current: 0, max: 50 },
          shield: { current: 0, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        // Create battle
        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache.createBattle(
            battleCtx,
            userCtx,
            1,
            2,
            stats,
            stats,
            cooldowns,
            cooldowns
          );
        });

        // Verify battle is in cache and active
        expect(battleCache.getBattleFromCache(battle.id)).toBeDefined();
        
        const activeBefore = await BattleRepo.getActiveBattles(battleCtx);
        expect(activeBefore).toHaveLength(1);

        console.log('🏁 Ending battle...');

        // End battle
        await BattleRepo.endBattle(
          battleCtx,
          battle.id,
          1, // Winner
          2, // Loser
          stats, // Winner final stats
          defeatedStats // Loser final stats
        );

        // Battle should be removed from cache (completed battles aren't cached)
        expect(battleCache.getBattleFromCache(battle.id)).toBeNull();

        // Should not appear in active battles
        const activeAfter = await BattleRepo.getActiveBattles(battleCtx);
        expect(activeAfter).toHaveLength(0);

        console.log('✅ Battle ending and cache removal working correctly');
      });
    });
  });

  describe('Error Handling', () => {
    it('battleCache_nonExistentBattle_returnsNull', async () => {
      const battleCache = getBattleCache();

      console.log('🔍 Testing non-existent battle handling...');

      await createLockContext().useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
        // Try to load non-existent battle
        const nonExistent = await battleCache.loadBattleIfNeeded(battleContext, 99999);
        expect(nonExistent).toBeNull();
  
        // Try to get from cache
        const notInCache = battleCache.getBattleFromCache(99999);
        expect(notInCache).toBeNull();
  
        // Try to get ongoing battle for non-existent user
        const noBattle = await BattleRepo.getOngoingBattleForUser(battleContext, 99999);
        expect(noBattle).toBeNull();
      });

      console.log('✅ Non-existent battle handling working correctly');
    });
  });

  describe('Cache Statistics', () => {
    
    let battleCache: BattleCache;
    let emptyCtx: ReturnType<typeof createLockContext>;

    beforeEach(async () => {
      emptyCtx = createLockContext();
      
      // Initialize BattleCache manually for tests
      battleCache = getBattleCache();
      const db = await getDatabase()
      initializeIntegrationTestServer()
    });

    afterEach(async () => {
      await shutdownIntegrationTestServer();
    });

    it('battleCache_statistics_accurateTracking', async () => {
      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        // Initial stats
        let stats = battleCache.getStats();
        expect(stats.cachedBattles).toBe(0);
        expect(stats.activeBattles).toBe(0);
        expect(stats.dirtyBattles).toBe(0);

        console.log('📊 Initial cache stats:', stats);

        const battleStats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 }
        ,
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache.createBattle(
            battleCtx,
            userCtx,
            1,
            2,
            battleStats,
            battleStats,
            cooldowns,
            cooldowns
          );
        });

        // Stats should update
        stats = battleCache.getStats();
        expect(stats.cachedBattles).toBe(1);
        expect(stats.activeBattles).toBe(1);
        // dirtyBattles depends on internal state

        console.log('📊 Stats after battle creation:', stats);
        console.log('✅ Cache statistics tracking working correctly');
      });
    });
  });
});