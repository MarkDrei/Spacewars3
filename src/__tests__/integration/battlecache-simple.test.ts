// ---
// BattleCache Integration Tests - Phase 5 Validation
// Focused tests for BattleCache with existing APIs
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserWorldCache, getUserWorldCache } from '../../lib/server/world/userWorldCache';
import * as BattleRepo from '../../lib/server/battle/battleRepo';
import { createTestDatabase } from '../helpers/testDatabase';
import type { BattleStats, WeaponCooldowns } from '../../lib/server/battle/battleTypes';

describe('Phase 5: BattleCache Integration Testing', () => {
  
  beforeEach(async () => {
    // Import and reset the test database
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    await createTestDatabase();
    
    // Reset all caches to clean state
    BattleCache.resetInstance();
    UserWorldCache.resetInstance();
  });

  afterEach(async () => {
    // Clean shutdown
    try {
      await getBattleCache().shutdown();
      await getUserWorldCache().shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }
  });

  describe('Core BattleCache Functionality', () => {
    it('battleCache_createBattle_storesInCache', async () => {
      const battleCache = getBattleCache();
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      // Initialize BattleCache manually for tests
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

      // Use test user IDs (created by createTestDatabase)
      const attackerId = 1;
      const defenderId = 2;

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

      console.log('🚀 Creating battle for cache test...');
      
      const battle = await BattleRepo.createBattle(
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
      const cachedBattle = battleCache.getBattleUnsafe(battle.id);
      expect(cachedBattle).toBeDefined();
      expect(cachedBattle?.id).toBe(battle.id);
      expect(cachedBattle?.attackerId).toBe(attackerId);
      expect(cachedBattle?.attackeeId).toBe(defenderId);

      console.log('✅ Battle properly stored in cache');
    });

    it('battleCache_loadBattleIfNeeded_loadsFromDatabase', async () => {
      const battleCache = getBattleCache();
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      // Initialize BattleCache manually for tests
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

      const attackerId = 1;
      const defenderId = 2;

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
      const battle = await BattleRepo.createBattle(
        attackerId, defenderId, stats, stats, cooldowns, cooldowns
      );

      // Reset cache to force database load
      BattleCache.resetInstance();
      const freshCache = getBattleCache();

      console.log('🔄 Loading battle from database...');

      // Load battle (should come from database)
      const loadedBattle = await freshCache.loadBattleIfNeeded(battle.id);
      
      expect(loadedBattle).toBeDefined();
      expect(loadedBattle?.id).toBe(battle.id);
      expect(loadedBattle?.attackerId).toBe(attackerId);
      expect(loadedBattle?.attackeeId).toBe(defenderId);

      // Should now be in cache
      const cachedAfterLoad = freshCache.getBattleUnsafe(battle.id);
      expect(cachedAfterLoad).toBeDefined();
      expect(cachedAfterLoad?.id).toBe(battle.id);

      console.log('✅ Battle loaded from database and cached');
    });

    it('battleCache_getOngoingBattleForUser_findsUserBattle', async () => {
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      const battleCache = getBattleCache();
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

      const attackerId = 1;
      const defenderId = 2;

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
      const battle = await BattleRepo.createBattle(
        attackerId, defenderId, stats, stats, cooldowns, cooldowns
      );

      console.log('🔍 Finding ongoing battles for users...');

      // Both users should find the battle
      const attackerBattle = await BattleRepo.getOngoingBattleForUser(attackerId);
      const defenderBattle = await BattleRepo.getOngoingBattleForUser(defenderId);

      expect(attackerBattle?.id).toBe(battle.id);
      expect(defenderBattle?.id).toBe(battle.id);

      // Non-participant should not find the battle
      const outsiderBattle = await BattleRepo.getOngoingBattleForUser(99);
      expect(outsiderBattle).toBeNull();

      console.log('✅ User battle lookup working correctly');
    });

    it('battleCache_getActiveBattles_returnsAllActive', async () => {
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      const battleCache = getBattleCache();
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

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

      // Initially no active battles
      let activeBattles = await BattleRepo.getActiveBattles();
      expect(activeBattles).toHaveLength(0);

      console.log('🔄 Creating multiple battles...');

      // Create first battle
      const battle1 = await BattleRepo.createBattle(
        1, 2, stats, stats, cooldowns, cooldowns
      );

      activeBattles = await BattleRepo.getActiveBattles();
      expect(activeBattles).toHaveLength(1);
      expect(activeBattles[0].id).toBe(battle1.id);

      // Create second battle (need different users)
      const user3Stats = { ...stats }; // Copy stats
      const user4Stats = { ...stats };
      
      const battle2 = await BattleRepo.createBattle(
        3, 4, user3Stats, user4Stats, cooldowns, cooldowns
      );

      activeBattles = await BattleRepo.getActiveBattles();
      expect(activeBattles).toHaveLength(2);
      
      const battleIds = activeBattles.map(b => b.id);
      expect(battleIds).toContain(battle1.id);
      expect(battleIds).toContain(battle2.id);

      console.log('✅ Active battles tracking working correctly');
    });

    it('battleCache_addBattleEvent_updatesCache', async () => {
      const battleCache = getBattleCache();
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      // Initialize BattleCache manually for tests
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

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
      const battle = await BattleRepo.createBattle(
        1, 2, stats, stats, cooldowns, cooldowns
      );

      console.log('📝 Adding battle event...');

      // Add battle event
      await BattleRepo.addBattleEvent(battle.id, {
        timestamp: Date.now(),
        type: 'damage_dealt',
        actor: 'attacker',
        data: { damage: 10, target: 'defender' }
      });

      // Battle log should contain the event
      const updatedBattle = battleCache.getBattleUnsafe(battle.id);
      expect(updatedBattle?.battleLog).toHaveLength(1);
      expect(updatedBattle?.battleLog[0].type).toBe('damage_dealt');

      console.log('✅ Battle events working correctly');
    });

    it('battleCache_endBattle_removesFromCache', async () => {
      const battleCache = getBattleCache();
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      // Initialize BattleCache manually for tests
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

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

      // Create battle
      const battle = await BattleRepo.createBattle(
        1, 2, stats, stats, cooldowns, cooldowns
      );

      // Verify battle is in cache and active
      expect(battleCache.getBattleUnsafe(battle.id)).toBeDefined();
      
      const activeBefore = await BattleRepo.getActiveBattles();
      expect(activeBefore).toHaveLength(1);

      console.log('🏁 Ending battle...');

      // End battle
      await BattleRepo.endBattle(
        battle.id,
        1, // Winner
        2, // Loser
        stats, // Winner final stats
        defeatedStats // Loser final stats
      );

      // Battle should be removed from cache (completed battles aren't cached)
      expect(battleCache.getBattleUnsafe(battle.id)).toBeNull();

      // Should not appear in active battles
      const activeAfter = await BattleRepo.getActiveBattles();
      expect(activeAfter).toHaveLength(0);

      console.log('✅ Battle ending and cache removal working correctly');
    });
  });

  describe('Error Handling', () => {
    it('battleCache_nonExistentBattle_returnsNull', async () => {
      const battleCache = getBattleCache();

      console.log('🔍 Testing non-existent battle handling...');

      // Try to load non-existent battle
      const nonExistent = await battleCache.loadBattleIfNeeded(99999);
      expect(nonExistent).toBeNull();

      // Try to get from cache
      const notInCache = battleCache.getBattleUnsafe(99999);
      expect(notInCache).toBeNull();

      // Try to get ongoing battle for non-existent user
      const noBattle = await BattleRepo.getOngoingBattleForUser(99999);
      expect(noBattle).toBeNull();

      console.log('✅ Non-existent battle handling working correctly');
    });
  });

  describe('Persistence Testing', () => {
    it('battleCache_persistence_maintainsData', async () => {
      const cacheManager = getUserWorldCache();
      await cacheManager.initialize();

      // Initialize BattleCache manually for tests
      const battleCache = getBattleCache();
      const db = await cacheManager.getDatabaseConnection();
      await battleCache.initialize(db);

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

      console.log('💾 Testing battle persistence...');

      // Create battle
      const battle = await BattleRepo.createBattle(
        1, 2, stats, stats, cooldowns, cooldowns
      );

      // Add event
      await BattleRepo.addBattleEvent(battle.id, {
        timestamp: Date.now(),
        type: 'damage_dealt',
        actor: 'attacker',
        data: { damage: 15, target: 'defender' }
      });

      // Explicitly persist dirty battles before shutdown
      await battleCache.persistDirtyBattles();
      
      // Shut down cache (should persist data)
      await getBattleCache().shutdown();
      BattleCache.resetInstance();

      // Create fresh cache
      const newCache = getBattleCache();
      const newCacheManager = getUserWorldCache();
      await newCacheManager.initialize();

      // Battle should be loadable from database
      const persistedBattle = await newCache.loadBattleIfNeeded(battle.id);
      expect(persistedBattle).toBeDefined();
      expect(persistedBattle?.id).toBe(battle.id);
      expect(persistedBattle?.battleLog).toHaveLength(1);
      expect(persistedBattle?.battleLog[0].type).toBe('damage_dealt');

      console.log('✅ Battle persistence working correctly');
    });
  });
});