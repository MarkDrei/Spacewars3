// ---
// Battle Defense Persistence Test - Verify defense values persist after battle ends
// Tests that hull/armor/shield values are not reset to max after battle completion
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache } from '../../lib/server/BattleCache';
import { TypedCacheManager, getTypedCacheManager } from '../../lib/server/typedCacheManager';
import * as battleService from '../../lib/server/battleService';
import { createTestDatabase } from '../helpers/testDatabase';
import { User } from '../../lib/server/user';
import { createLockContext } from '../../lib/server/typedLocks';
import { BattleRepo } from '../../lib/server/battleRepo';
import type { BattleStats } from '../../shared/battleTypes';

describe('Battle Defense Persistence', () => {
  
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

  it('defenseValues_afterBattleEnds_notResetToMax', { timeout: 15000 }, async () => {
    console.log('🧪 Testing defense value persistence after battle ends...');
    
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
    
    // Record initial defense values
    const attackerInitialHull = attacker.hullCurrent;
    const defenderInitialHull = defender.hullCurrent;
    
    console.log(`📊 Attacker initial hull: ${attackerInitialHull}`);
    console.log(`📊 Defender initial hull: ${defenderInitialHull}`);
    
    // Calculate max values
    const attackerMaxHull = attacker.techCounts.ship_hull * 100;
    const defenderMaxHull = defender.techCounts.ship_hull * 100;
    
    // Verify users start at less than max
    expect(attackerInitialHull).toBeLessThan(attackerMaxHull);
    expect(defenderInitialHull).toBeLessThan(defenderMaxHull);
    
    // Create battle stats manually with specific damaged values
    const attackerDamagedHull = attackerInitialHull - 100; // Remove 100 hull
    const defenderDamagedHull = 50; // Set to low hull
    
    const attackerStats: BattleStats = {
      hull: { current: attacker.hullCurrent, max: attackerMaxHull },
      armor: { current: attacker.armorCurrent, max: attacker.techCounts.kinetic_armor * 100 },
      shield: { current: attacker.shieldCurrent, max: attacker.techCounts.energy_shield * 100 },
      weapons: {}
    };
    
    const defenderStats: BattleStats = {
      hull: { current: defender.hullCurrent, max: defenderMaxHull },
      armor: { current: defender.armorCurrent, max: defender.techCounts.kinetic_armor * 100 },
      shield: { current: defender.shieldCurrent, max: defender.techCounts.energy_shield * 100 },
      weapons: {}
    };
    
    // Create battle directly through BattleRepo
    const battle = await BattleRepo.createBattle(
      attacker.id,
      defender.id,
      attackerStats,
      defenderStats,
      {},
      {}
    );
    
    console.log(`⚔️ Battle ${battle.id} created`);
    
    // CRITICAL: Apply damage to User objects in cache (not just battle stats)
    // This is the new architecture - User defense values are the source of truth
    const damageCtx = createLockContext();
    const damageUserCtx = await cacheManager.acquireUserLock(damageCtx);
    
    try {
      const attackerInCache = cacheManager.getUserUnsafe(attacker.id, damageUserCtx);
      const defenderInCache = cacheManager.getUserUnsafe(defender.id, damageUserCtx);
      
      if (!attackerInCache || !defenderInCache) {
        throw new Error('Users not in cache for damage application');
      }
      
      // Apply damage to attacker
      attackerInCache.hullCurrent = attackerDamagedHull;
      cacheManager.updateUserUnsafe(attackerInCache, damageUserCtx);
      
      // Set defender to 0 hull (they will lose)
      defenderInCache.hullCurrent = 0;
      cacheManager.updateUserUnsafe(defenderInCache, damageUserCtx);
      
      console.log(`💥 Simulated damage - Attacker hull: ${attackerDamagedHull}, Defender hull: 0`);
    } finally {
      damageUserCtx.dispose();
    }
    
    // Call resolveBattle to end the battle and update user defense values
    await battleService.resolveBattle(battle.id, attacker.id);
    
    console.log('✅ Battle ended');
    
    // Re-load users from cache to check they weren't reset
    console.log('🔄 Checking users in cache...');
    
    const ctx2 = createLockContext();
    const userCtx2 = await cacheManager.acquireUserLock(ctx2);
    
    let attackerAfter: User | null = null;
    let defenderAfter: User | null = null;
    
    try {
      attackerAfter = cacheManager.getUserUnsafe(attacker.id, userCtx2);
      defenderAfter = cacheManager.getUserUnsafe(defender.id, userCtx2);
    } finally {
      userCtx2.dispose();
    }
    
    if (!attackerAfter || !defenderAfter) {
      throw new Error('Users not found in cache after battle');
    }
    
    console.log(`📊 Attacker after battle - Hull: ${attackerAfter.hullCurrent} (expected: ${attackerDamagedHull})`);
    console.log(`📊 Defender after battle - Hull: ${defenderAfter.hullCurrent} (expected: 0 since they lost)`);
    
    // CRITICAL: Verify defense values are NOT reset to max or initial values
    expect(attackerAfter.hullCurrent).toBe(attackerDamagedHull);
    expect(attackerAfter.hullCurrent).not.toBe(attackerMaxHull);
    expect(attackerAfter.hullCurrent).not.toBe(attackerInitialHull);
    
    // Defender was set to 0 hull to make them lose
    expect(defenderAfter.hullCurrent).toBe(0);
    expect(defenderAfter.hullCurrent).not.toBe(defenderMaxHull);
    expect(defenderAfter.hullCurrent).not.toBe(defenderInitialHull);
    
    console.log('✅ Defense values correctly persisted after battle (not reset to max)');
  });
});
