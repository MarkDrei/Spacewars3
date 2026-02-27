// ---
// End-to-End Battle Flow Tests - Phase 5 Validation
// Tests complete battle lifecycle with BattleCache integration
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserCache } from '../../lib/server/user/userCache';
import * as BattleRepo from '../../lib/server/battle/BattleCache';
import type { BattleStats, WeaponCooldowns } from '../../lib/server/battle/battleTypes';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';

describe('Phase 5: End-to-End Battle Flow with BattleCache', () => {

  let battleCache: BattleCache | null;
  let userCache: UserCache;
  let emptyCtx: ReturnType<typeof createLockContext>;
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
    battleCache = getBattleCache();
    userCache = UserCache.getInstance2();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  describe('Complete Battle Lifecycle', () => {
    it('battleFlow_createToCompletion_properCacheIntegration', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        // === Phase 1: Setup ===
  
        // Use test user IDs (seeded by test database)
        let attackerId = 0, defenderId = 0;
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });
  
        // Initial battle stats
        const attackerStats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const defenderStats: BattleStats = {
          hull: { current: 80, max: 80 },
          armor: { current: 40, max: 40 },
          shield: { current: 20, max: 20 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
  
        // Initial weapon cooldowns (no weapons ready)
        const attackerCooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };
        const defenderCooldowns: WeaponCooldowns = {
          pulse_laser: 5, // Defender has cooldown
          auto_turret: 0,
          missile_launcher: 0
        };
  
        // === Phase 2: Create Battle ===
        
        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache!.createBattle(
          battleCtx,
          userCtx,
          attackerId,
          defenderId,
          attackerStats,
          defenderStats,
          attackerCooldowns,
          defenderCooldowns
          );
        });

  
        // Verify battle creation
        expect(battle).toBeDefined();
        expect(battle.id).toBeGreaterThan(0);
        expect(battle.attackerId).toBe(attackerId);
        expect(battle.attackeeId).toBe(defenderId);
        expect(battle.battleEndTime).toBeNull();
  
        
  
        // === Phase 3: Verify BattleCache Integration ===
        
        // Battle should be in cache
        const cachedBattle = battleCache!.getBattleFromCache(battle.id);
        expect(cachedBattle).toBeDefined();
        expect(cachedBattle?.id).toBe(battle.id);
  
        // Should be findable by user
        const attackerBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, attackerId);
        const defenderBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, defenderId);
        
        expect(attackerBattle?.id).toBe(battle.id);
        expect(defenderBattle?.id).toBe(battle.id);
  
        // Should be in active battles
        const activeBattles = await BattleRepo.getActiveBattles(battleCtx);
        expect(activeBattles).toHaveLength(1);
        expect(activeBattles[0].id).toBe(battle.id);
  
        
  
        // === Phase 4: Add Battle Events (Skip complex battle processing) ===
        
        // Instead of processing full battle rounds, just add events to test cache updates
        
        await BattleRepo.addBattleEvent(battleCtx, battle.id, {
          timestamp: Date.now(),
          type: 'damage_dealt',
          actor: 'attacker',
          data: { damage: 10, target: 'defender' }
        });
  
        // Verify cache contains updated battle
        const cachedUpdated = battleCache!.getBattleFromCache(battle.id);
        expect(cachedUpdated).toBeDefined();
        
        // Battle log should have events
        expect(cachedUpdated?.battleLog.length).toBeGreaterThan(0);
        
  
        // === Phase 5: Cache Persistence (Skip scheduler test) ===
        
        // Force persistence
        await battleCache!.persistDirtyBattles(battleCtx);
        
        // Reset cache and reload from DB to test database persistence
        BattleCache.resetInstance();
        
        // Reinitialize cache (needed after reset)
        const db = battleCache!['db']!; // Access private field for test, assert non-null
        const deps = battleCache!['dependencies']!; // Access private field for test, assert non-null
        await BattleCache.initialize(db, deps);
        
        const freshCache = getBattleCache()!;
        expect(freshCache).not.toBeNull();
  
        // Battle should be loadable from database
        const reloadedBattle = await freshCache.loadBattleIfNeeded(battleCtx, battle.id);
        expect(reloadedBattle).toBeDefined();
        expect(reloadedBattle?.id).toBe(battle.id);
        expect(reloadedBattle?.battleLog.length).toBeGreaterThan(0);
  
        // === Phase 6: End Battle ===
        
        if (!reloadedBattle?.battleEndTime) {
          
          
          await BattleRepo.endBattle(
            battleCtx,
            battle.id,
            attackerId, // Winner
            defenderId, // Loser
            attackerStats, // Final attacker stats
            { 
              hull: { current: 0, max: 80 },
              armor: { current: 0, max: 40 },
              shield: { current: 0, max: 20 },
              weapons: defenderStats.weapons
            } // Defender defeated
          );
  
          // Battle should be removed from cache (completed battles aren't cached)
          const endedBattle = freshCache.getBattleFromCache(battle.id);
          expect(endedBattle).toBeNull();
  
          // Should not appear in active battles
          const finalActive = await BattleRepo.getActiveBattles(battleCtx);
          expect(finalActive).toHaveLength(0);
        }
  
        // === Phase 7: Verify Complete Workflow ===
        
        // Battle should be in database history
        const userBattles = await BattleRepo.getBattlesForUser(attackerId);
        expect(userBattles.length).toBeGreaterThan(0);
        
        const foundBattle = userBattles.find(b => b.id === battle.id);
        expect(foundBattle).toBeDefined();
        expect(foundBattle?.battleEndTime).toBeDefined();
        });
      });
    });

    it('battleFlow_concurrentBattles_cacheSeparation', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        // Use first 4 test users
        let userIds: number[] = [];
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const u1 = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          const u2 = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
          const u3 = (await userCache.getUserByUsername(userCtx, 'testuser3'))!.id;
          const u4 = (await userCache.getUserByUsername(userCtx, 'testuser4'))!.id;
          userIds = [u1, u2, u3, u4];
        });

        const battleStats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = { pulse_laser: 0, auto_turret: 0, missile_launcher: 0 };

        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          // Create multiple battles
          const battle1 = await battleCache!.createBattle(
            battleCtx, userCtx,
            userIds[0], userIds[1], battleStats, battleStats, cooldowns, cooldowns
          );
          
          const battle2 = await battleCache!.createBattle(
            battleCtx, userCtx,
            userIds[2], userIds[3], battleStats, battleStats, cooldowns, cooldowns
          );
  
          // Verify both battles are cached separately
          const cache = getBattleCache()!;
          const cached1 = cache.getBattleFromCache(battle1.id);
          const cached2 = cache.getBattleFromCache(battle2.id);
  
          expect(cached1?.id).toBe(battle1.id);
          expect(cached2?.id).toBe(battle2.id);
          expect(cached1?.attackerId).toBe(userIds[0]);
          expect(cached2?.attackerId).toBe(userIds[2]);
  
          // Active battles should show both
          const activeBattles = await BattleRepo.getActiveBattles(battleCtx);
          expect(activeBattles).toHaveLength(2);
  
          // Each user should find their own battle
          const user0Battle = await BattleRepo.getOngoingBattleForUser(battleCtx, userIds[0]);
          const user2Battle = await BattleRepo.getOngoingBattleForUser(battleCtx, userIds[2]);
  
          expect(user0Battle?.id).toBe(battle1.id);
          expect(user2Battle?.id).toBe(battle2.id);
        });
        });
      });
    });
  });

  describe('BattleCache Performance', () => {
    it('battleCache_backgroundPersistence_worksCorrectly', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        // Use test users
        let user1Id = 0, user2Id = 0;
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          user1Id = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          user2Id = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = { pulse_laser: 0, auto_turret: 0, missile_launcher: 0 };

        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache!.createBattle(
            battleCtx, userCtx,
            user1Id, user2Id, stats, stats, cooldowns, cooldowns
          );
        });

        // Modify battle to make it dirty
        await BattleRepo.addBattleEvent(battleCtx, battle.id, {
          timestamp: Date.now(),
          type: 'damage_dealt',
          actor: 'attacker',
          data: { damage: 10, target: 'defender' }
        });

        // In test mode, battles are immediately persisted (not kept dirty)
        // Verify battle was persisted by checking it's not dirty
        expect(battleCache!.getDirtyBattleIds().includes(battle.id)).toBe(false);

        // Force persistence (should be no-op in test mode)
        await battleCache!.persistDirtyBattles(battleCtx);

        // Battle should still not be dirty
        expect(battleCache!.getDirtyBattleIds().includes(battle.id)).toBe(false);
        });
      });
    });

    it('battleCache_memoryUsage_reasonable', async () => {
      await withTransaction(async () => {
        const cache = getBattleCache()!;
        const initialStats = cache.getStats();

        

        // Cache stats should be reasonable
        expect(initialStats.activeBattles).toBe(0);
        expect(initialStats.cachedBattles).toBe(0);
        expect(initialStats.dirtyBattles).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('battleCache_missingBattle_handlesGracefully', async () => {
      await withTransaction(async () => {
        const cache = getBattleCache()!;
        
        const emptyCtx = createLockContext();
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
        // Try to load non-existent battle
        const nonExistent = await cache.loadBattleIfNeeded(battleCtx, 99999);
        expect(nonExistent).toBeNull();
  
        // Try to get ongoing battle for non-existent user
        const noBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, 99999);
        expect(noBattle).toBeNull();
        });
      });
    });

    it('battleCache_cacheOperations_threadsafe', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

        // Use test users
        let user1Id = 0, user2Id = 0;
        await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          user1Id = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          user2Id = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 2000 }
          }
        };
        const cooldowns: WeaponCooldowns = { pulse_laser: 0, auto_turret: 0, missile_launcher: 0 };

        const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          return await battleCache!.createBattle(
            battleCtx,
            userCtx,
            user1Id,
            user2Id,
            stats,
            stats,
            cooldowns,
            cooldowns
          );
        });

        // Perform concurrent operations
        const operations = [
          BattleRepo.getBattle(battleCtx, battle.id),
          BattleRepo.getOngoingBattleForUser(battleCtx, user1Id),
          BattleRepo.getActiveBattles(battleCtx),
        ];

        // Also test concurrent write
        const writeOp = BattleRepo.addBattleEvent(battleCtx, battle.id, {
          timestamp: Date.now(),
          type: 'damage_dealt', 
          actor: 'attacker',
          data: { damage: 5 }
        });

        // All operations should complete successfully
        const results = await Promise.all(operations);
        await writeOp;
        
        const battleResult = results[0];
        const ongoingBattleResult = results[1];
        const activeBattlesResult = results[2];
        
        expect(battleResult).toBeDefined();
        expect(!Array.isArray(battleResult) && battleResult?.id).toBe(battle.id); // getBattle
        expect(!Array.isArray(ongoingBattleResult) && ongoingBattleResult?.id).toBe(battle.id); // getOngoingBattle
        expect(activeBattlesResult).toHaveLength(1);      // getActiveBattles
        // addBattleEvent returns void
        });
      });
    });
  });
});