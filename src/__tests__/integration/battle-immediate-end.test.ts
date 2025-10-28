// ---
// Test to reproduce: Battles ending immediately with 0 defense values
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache } from '../../lib/server/battle/BattleCache';
import { TypedCacheManager, getTypedCacheManager } from '../../lib/server/typedCacheManager';
import * as battleService from '../../lib/server/battle/battleService';
import { createTestDatabase } from '../helpers/testDatabase';
import { User } from '../../lib/server/user';
import { createLockContext } from '../../lib/server/typedLocks';
import type { BattleStats } from '../../shared/battleTypes';

describe('Battle Immediate End Issue', () => {
  
  beforeEach(async () => {
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    await createTestDatabase();
    
    // Reset all caches
    BattleCache.resetInstance();
    TypedCacheManager.resetInstance();
  });

  afterEach(async () => {
    await getTypedCacheManager().shutdown();
  });

  it('battleStartStats_withZeroDefense_autoRecovery', { timeout: 15000 }, async () => {
    console.log('🧪 Testing auto-recovery of 0 defense values...');
    
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Initialize BattleCache
    const battleCache = BattleCache.getInstance();
    const db = await cacheManager.getDatabaseConnection();
    await battleCache.initialize(db);
    
    // Get test users (seeded by test database)
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    
    let attacker: User | null = null;
    let defender: User | null = null;
    
    try {
      const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
      try {
        attacker = await cacheManager.loadUserFromDbUnsafe(1, dbCtx);
        defender = await cacheManager.loadUserFromDbUnsafe(2, dbCtx);
        
        if (!attacker || !defender) {
          throw new Error('Test users not found');
        }
        
        // Cache the users
        cacheManager.setUserUnsafe(attacker, userCtx);
        cacheManager.setUserUnsafe(defender, userCtx);
        
      } finally {
        dbCtx.dispose();
      }
    } finally {
      userCtx.dispose();
    }
    
    console.log(`📊 Attacker defense: Hull=${attacker.hullCurrent}, Armor=${attacker.armorCurrent}, Shield=${attacker.shieldCurrent}`);
    console.log(`📊 Defender defense: Hull=${defender.hullCurrent}, Armor=${defender.armorCurrent}, Shield=${defender.shieldCurrent}`);
    console.log(`📊 Attacker tech counts: Hull=${attacker.techCounts.ship_hull}, Armor=${attacker.techCounts.kinetic_armor}, Shield=${attacker.techCounts.energy_shield}`);
    console.log(`📊 Defender tech counts: Hull=${defender.techCounts.ship_hull}, Armor=${defender.techCounts.kinetic_armor}, Shield=${defender.techCounts.energy_shield}`);
    
    // Verify initial defense values are NOT zero
    expect(attacker.hullCurrent).toBeGreaterThan(0);
    expect(defender.hullCurrent).toBeGreaterThan(0);
    
    // Now simulate the bug - set defense values to 0 but keep tech counts
    const bugCtx = createLockContext();
    const bugUserCtx = await cacheManager.acquireUserLock(bugCtx);
    
    try {
      const attackerInCache = cacheManager.getUserUnsafe(attacker.id, bugUserCtx);
      const defenderInCache = cacheManager.getUserUnsafe(defender.id, bugUserCtx);
      
      if (!attackerInCache || !defenderInCache) {
        throw new Error('Users not in cache');
      }
      
      // Simulate the bug: defense values are 0
      attackerInCache.hullCurrent = 0;
      attackerInCache.armorCurrent = 0;
      attackerInCache.shieldCurrent = 0;
      cacheManager.updateUserUnsafe(attackerInCache, bugUserCtx);
      
      defenderInCache.hullCurrent = 0;
      defenderInCache.armorCurrent = 0;
      defenderInCache.shieldCurrent = 0;
      cacheManager.updateUserUnsafe(defenderInCache, bugUserCtx);
      
      console.log('💥 Simulated bug - Both players now have 0 defense values');
    } finally {
      bugUserCtx.dispose();
    }
    
    // Try to initiate battle - should auto-recover defense values
    console.log('⚔️ Attempting to initiate battle (should trigger auto-recovery)...');
    try {
      const battle = await battleService.initiateBattle(attacker, defender);
      
      console.log(`⚔️ Battle ${battle.id} created`);
      console.log(`📊 Battle stats - Attacker hull: ${battle.attackerStartStats.hull.current}/${battle.attackerStartStats.hull.max}`);
      console.log(`📊 Battle stats - Defender hull: ${battle.attackeeStartStats.hull.current}/${battle.attackeeStartStats.hull.max}`);
      
      // After auto-recovery, defense values should be restored to max/2
      const expectedAttackerHull = attacker.techCounts.ship_hull * 50;
      const expectedDefenderHull = defender.techCounts.ship_hull * 50;
      
      // Battle stats should show recovered values, not 0
      expect(battle.attackerStartStats.hull.current).toBe(expectedAttackerHull);
      expect(battle.attackeeStartStats.hull.current).toBe(expectedDefenderHull);
      
      // Use BattleEngine to check battle is NOT over immediately
      const { BattleEngine } = await import('../../lib/server/battle/battle');
      const battleEngine = new BattleEngine(battle);
      const isOver = await battleEngine.isBattleOver();
      
      console.log(`🔍 Is battle over immediately? ${isOver}`);
      
      // Battle should NOT be over immediately after recovery
      expect(isOver).toBe(false);
      
      console.log('✅ Auto-recovery successful: Defense values restored before battle start');
      
    } catch (error) {
      console.error('❌ Error initiating battle:', error);
      throw error;
    }
  });

  it('battleStartStats_calculatedFromTechCounts_shouldNotBeZero', { timeout: 15000 }, async () => {
    console.log('🧪 Testing that defense values are calculated correctly from tech counts...');
    
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Initialize BattleCache
    const battleCache = BattleCache.getInstance();
    const db = await cacheManager.getDatabaseConnection();
    await battleCache.initialize(db);
    
    // Get test users
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    
    let attacker: User | null = null;
    let defender: User | null = null;
    
    try {
      const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
      try {
        attacker = await cacheManager.loadUserFromDbUnsafe(1, dbCtx);
        defender = await cacheManager.loadUserFromDbUnsafe(2, dbCtx);
        
        if (!attacker || !defender) {
          throw new Error('Test users not found');
        }
        
        // Cache the users
        cacheManager.setUserUnsafe(attacker, userCtx);
        cacheManager.setUserUnsafe(defender, userCtx);
        
      } finally {
        dbCtx.dispose();
      }
    } finally {
      userCtx.dispose();
    }
    
    // Verify tech counts are not 0
    expect(attacker.techCounts.ship_hull).toBeGreaterThan(0);
    expect(attacker.techCounts.kinetic_armor).toBeGreaterThan(0);
    expect(attacker.techCounts.energy_shield).toBeGreaterThan(0);
    
    expect(defender.techCounts.ship_hull).toBeGreaterThan(0);
    expect(defender.techCounts.kinetic_armor).toBeGreaterThan(0);
    expect(defender.techCounts.energy_shield).toBeGreaterThan(0);
    
    // Verify defense values are correctly calculated from tech counts
    const expectedAttackerHull = attacker.techCounts.ship_hull * 50; // max/2
    const expectedDefenderHull = defender.techCounts.ship_hull * 50;
    
    console.log(`📊 Expected attacker hull (from tech count): ${expectedAttackerHull}`);
    console.log(`📊 Actual attacker hull: ${attacker.hullCurrent}`);
    console.log(`📊 Expected defender hull (from tech count): ${expectedDefenderHull}`);
    console.log(`📊 Actual defender hull: ${defender.hullCurrent}`);
    
    // Defense values should be > 0 if tech counts are > 0
    expect(attacker.hullCurrent).toBeGreaterThan(0);
    expect(defender.hullCurrent).toBeGreaterThan(0);
    
    console.log('✅ Defense values are correctly calculated from tech counts');
  });
});
