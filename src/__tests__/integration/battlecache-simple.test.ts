// ---
// BattleCache Integration Tests - Phase 5 Validation
// Focused tests for BattleCache with existing APIs
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

describe('Phase 5: BattleCache Integration Testing', () => {
  let battleCache: BattleCache;
  let emptyCtx: ReturnType<typeof createLockContext>;

  beforeEach(async () => {
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
    battleCache = getBattleCache();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  describe('Core BattleCache Functionality', () => {
    it('battleCache_createBattle_storesInCache', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        // Use test user IDs (created by createTestDatabase)
        let attackerId = 0, defenderId = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        // Define valid BattleStats with complete structure
        const attackerStats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 },
            auto_turret: { count: 0, damage: 5, cooldown: 2 }
          }
        };
        const defenderStats: BattleStats = {
          hull: { current: 80, max: 80 },
          armor: { current: 40, max: 40 },
          shield: { current: 20, max: 20 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };

        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        const battle = await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
          return await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
            return await battleCache.createBattle(
              battleContext,
              userContext,
              attackerId,
              defenderId,
              attackerStats,
              defenderStats,
              cooldowns,
              cooldowns
            );
          });
        });

        // Verify battle creation
        expect(battle).toBeDefined();
        expect(battle.id).toBeGreaterThan(0);
        expect(battle.attackerId).toBe(attackerId);
        expect(battle.attackeeId).toBe(defenderId);

        // Verify battle is in cache
        const cachedBattle = battleCache.getBattleFromCache(battle.id);
        expect(cachedBattle).toBeDefined();
        expect(cachedBattle?.id).toBe(battle.id);
        expect(cachedBattle?.attackerId).toBe(attackerId);
        expect(cachedBattle?.attackeeId).toBe(defenderId);
      });
    });

    it('battleCache_loadBattleIfNeeded_loadsFromDatabase', async () => {
      await withTransaction(async () => {
        const emptyCtx = createLockContext();
        let attackerId = 0, defenderId = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        // Create battle
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
            const battleCache = BattleCache.getInstance();
            const battle = await battleCache.createBattle(
              battleCtx, userContext, attackerId, defenderId, stats, stats, cooldowns, cooldowns
            );
    
            // Reset cache to force database load
            BattleCache.resetInstance();
            const freshCache = getBattleCache();
    
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
          });
        });
      });
    });

    it('battleCache_getOngoingBattleForUser_findsUserBattle', async () => {
      await withTransaction(async () => {
        let attackerId = 0, defenderId = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          // Create battle
          const battleCache = BattleCache.getInstance();

          await battleCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
            const battle = await battleCache.createBattle(
              battleCtx, userContext, attackerId, defenderId, stats, stats, cooldowns, cooldowns
            );
      
            // Both users should find the battle
            const attackerBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, attackerId);
            const defenderBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, defenderId);
      
            expect(attackerBattle?.id).toBe(battle.id);
            expect(defenderBattle?.id).toBe(battle.id);
      
            // Non-participant should not find the battle
            const outsiderBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, 99);
            expect(outsiderBattle).toBeNull();
          });
        });
      });
    });

    it('battleCache_getActiveBattles_returnsAllActive', async () => {
      await withTransaction(async () => {
        let user1Id = 0, user2Id = 0, user3Id = 0, user4Id = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          user1Id = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          user2Id = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
          user3Id = (await userCache.getUserByUsername(userCtx, 'testuser3'))!.id;
          user4Id = (await userCache.getUserByUsername(userCtx, 'testuser4'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {

          // Initially no active battles
          let activeBattles = await BattleRepo.getActiveBattles(battleCtx);
          expect(activeBattles).toHaveLength(0);

          const battleCache = BattleCache.getInstance();

          await battleCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
            // Create first battle
            const battle1 = await battleCache.createBattle(
              battleCtx, userContext, user1Id, user2Id, stats, stats, cooldowns, cooldowns
            );
      
            activeBattles = await BattleRepo.getActiveBattles(battleCtx);
            expect(activeBattles).toHaveLength(1);
            expect(activeBattles[0].id).toBe(battle1.id);
      
            // Create second battle (need different users)
            const user3Stats = { ...stats }; // Copy stats
            const user4Stats = { ...stats };
            
            const battle2 = await battleCache.createBattle(
              battleCtx, userContext, user3Id, user4Id, user3Stats, user4Stats, cooldowns, cooldowns
            );
      
            activeBattles = await BattleRepo.getActiveBattles(battleCtx);
            expect(activeBattles).toHaveLength(2);
            
            const battleIds = activeBattles.map(b => b.id);
            expect(battleIds).toContain(battle1.id);
            expect(battleIds).toContain(battle2.id);
          });

        });
      });
    });

    it('battleCache_addBattleEvent_updatesCache', async () => {
      await withTransaction(async () => {
        let attackerId = 0, defenderId = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
            const battleCache = BattleCache.getInstance();
            // Create battle
            const battle = await battleCache.createBattle(
              battleCtx, userContext, attackerId, defenderId, stats, stats, cooldowns, cooldowns
            );
      
            // Add battle event
            await BattleRepo.addBattleEvent(battleCtx, battle.id, {
              timestamp: Date.now(),
              type: 'damage_dealt',
              actor: 'attacker',
              data: { damage: 10, target: 'defender' }
            });
      
            // Battle log should contain the event
            const updatedBattle = battleCache.getBattleFromCache(battle.id);
            expect(updatedBattle?.battleLog).toHaveLength(1);
            expect(updatedBattle?.battleLog[0].type).toBe('damage_dealt');
          });
        });
      });
    });

    it('battleCache_endBattle_removesFromCache', async () => {
      await withTransaction(async () => {
        let attackerId = 0, defenderId = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const defeatedStats: BattleStats = {
          hull: { current: 0, max: 100 },
          armor: { current: 0, max: 50 },
          shield: { current: 0, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };


        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          const battleCache = BattleCache.getInstance();

          await battleCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
            // Create battle
            const battle = await battleCache.createBattle(
              battleCtx, userContext, attackerId, defenderId, stats, stats, cooldowns, cooldowns
            );
    
            // Verify battle is in cache and active
            expect(battleCache.getBattleFromCache(battle.id)).toBeDefined();
    
            const activeBefore = await BattleRepo.getActiveBattles(battleCtx);
            expect(activeBefore).toHaveLength(1);
    
            // End battle
            await BattleRepo.endBattle(
              battleCtx,
              battle.id,
              attackerId, // Winner
              defenderId, // Loser
              stats, // Winner final stats
              defeatedStats // Loser final stats
            );
    
            // Battle should be removed from cache (completed battles aren't cached)
            expect(battleCache.getBattleFromCache(battle.id)).toBeNull();
    
            // Should not appear in active battles
            const activeAfter = await BattleRepo.getActiveBattles(battleCtx);
            expect(activeAfter).toHaveLength(0);
          });

        });
      });
    });
  });

  describe('Error Handling', () => {
    it('battleCache_nonExistentBattle_returnsNull', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          // Try to load non-existent battle
          const nonExistent = await battleCache.loadBattleIfNeeded(battleCtx, 99999);
          expect(nonExistent).toBeNull();
    
          // Try to get from cache
          const notInCache = battleCache.getBattleFromCache(99999);
          expect(notInCache).toBeNull();
    
          // Try to get ongoing battle for non-existent user
          const noBattle = await BattleRepo.getOngoingBattleForUser(battleCtx, 99999);
          expect(noBattle).toBeNull();
        });
      });
    });
  });

  describe('Persistence Testing', () => {
    it('battleCache_persistence_maintainsData', async () => {
      await withTransaction(async () => {
        let attackerId = 0, defenderId = 0;
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const userCache = UserCache.getInstance2();
          attackerId = (await userCache.getUserByUsername(userCtx, 'a'))!.id;
          defenderId = (await userCache.getUserByUsername(userCtx, 'dummy'))!.id;
        });

        const stats: BattleStats = {
          hull: { current: 100, max: 100 },
          armor: { current: 50, max: 50 },
          shield: { current: 25, max: 25 },
          weapons: {
            pulse_laser: { count: 1, damage: 10, cooldown: 3 }
          }
        };
        const cooldowns: WeaponCooldowns = {
          pulse_laser: 0,
          auto_turret: 0,
          missile_launcher: 0
        };

        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          const battleCache = BattleCache.getInstance();

          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            // Create battle
            const battle = await battleCache.createBattle(
              battleCtx, userCtx, attackerId, defenderId, stats, stats, cooldowns, cooldowns
            );
      
            // Add event
            await BattleRepo.addBattleEvent(battleCtx, battle.id, {
              timestamp: Date.now(),
              type: 'damage_dealt',
              actor: 'attacker',
              data: { damage: 15, target: 'defender' }
            });
      
            // Explicitly persist dirty battles before shutdown
            await battleCache.persistDirtyBattles(battleCtx);
            
            // Shut down cache (should persist data)
            await getBattleCache().shutdown();
            BattleCache.resetInstance();
      
            // Create fresh cache
            const newCache = getBattleCache();
      
            // Battle should be loadable from database
            const persistedBattle = await newCache.loadBattleIfNeeded(battleCtx, battle.id);
            expect(persistedBattle).toBeDefined();
            expect(persistedBattle?.id).toBe(battle.id);
            expect(persistedBattle?.battleLog).toHaveLength(1);
            expect(persistedBattle?.battleLog[0].type).toBe('damage_dealt');
          });
        });
      });
    });
  });
});