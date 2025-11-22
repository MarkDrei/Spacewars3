// ---
// Battle Defense Persistence Test - Verify defense values persist after battle ends
// Tests that hull/armor/shield values are not reset to max after battle completion
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserWorldCache, getUserWorldCache } from '../../lib/server/world/userWorldCache';
import * as battleService from '../../lib/server/battle/battleService';
import { createTestDatabase } from '../helpers/testDatabase';
import { User } from '../../lib/server/world/user';
import { BattleRepo } from '../../lib/server/battle/BattleCache';
import { BATTLE_LOCK, USER_LOCK } from '../../lib/server/typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import type { BattleStats } from '../../lib/server/battle/battleTypes';

describe('Battle Defense Persistence', () => {
  
  beforeEach(async () => {
    const { resetTestDatabase } = await import('../../lib/server/database');
    resetTestDatabase();
    
    await createTestDatabase();
    
    // Reset all caches
    BattleCache.resetInstance();
    UserWorldCache.resetInstance();
  });

  afterEach(async () => {
    await getUserWorldCache().shutdown();
  });

  it('defenseValues_afterBattleEnds_notResetToMax', { timeout: 15000 }, async () => {
    console.log('🧪 Testing defense value persistence after battle ends...');
    
    const userWorldCache = getUserWorldCache();
    await userWorldCache.initialize();
    
    // Initialize BattleCache
    const battleCache = BattleCache.getInstance();
    const db = await userWorldCache.getDatabaseConnection();
    await battleCache.initialize(db);
    
    // Get test users (seeded by test database)
    let attacker: User | null = null;
    let defender: User | null = null;
    
    await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      attacker = await userWorldCache.getUserByIdWithLock(userContext, 1);
      defender = await userWorldCache.getUserByIdWithLock(userContext, 2);
    });
    
    if (!attacker || !defender) {
      throw new Error('Test users not found');
    }
    
    // TypeScript now knows these are not null
    const attackerUser = attacker as User;
    const defenderUser = defender as User;
    
    // Record initial defense values
    const attackerInitialHull = attackerUser.hullCurrent;
    const defenderInitialHull = defenderUser.hullCurrent;
    
    console.log(`📊 Attacker initial hull: ${attackerInitialHull}`);
    console.log(`📊 Defender initial hull: ${defenderInitialHull}`);
    
    // Calculate max values
    const attackerMaxHull = attackerUser.techCounts.ship_hull * 100;
    const defenderMaxHull = defenderUser.techCounts.ship_hull * 100;
    
    // Verify users start at less than max
    expect(attackerInitialHull).toBeLessThan(attackerMaxHull);
    expect(defenderInitialHull).toBeLessThan(defenderMaxHull);
    
    // Create battle stats manually with specific damaged values
    const attackerDamagedHull = attackerInitialHull - 100; // Remove 100 hull
    const defenderDamagedHull = 50; // Set to low hull
    
    const attackerStats: BattleStats = {
      hull: { current: attackerUser.hullCurrent, max: attackerMaxHull },
      armor: { current: attackerUser.armorCurrent, max: attackerUser.techCounts.kinetic_armor * 100 },
      shield: { current: attackerUser.shieldCurrent, max: attackerUser.techCounts.energy_shield * 100 },
      weapons: {}
    };
    
    const defenderStats: BattleStats = {
      hull: { current: defenderUser.hullCurrent, max: defenderMaxHull },
      armor: { current: defenderUser.armorCurrent, max: defenderUser.techCounts.kinetic_armor * 100 },
      shield: { current: defenderUser.shieldCurrent, max: defenderUser.techCounts.energy_shield * 100 },
      weapons: {}
    };
    
    const emptyCtx = createLockContext();
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
      // Create battle directly through BattleCache
      const battleCache = getBattleCache();
      const battle = await battleCache.createBattle(
        battleCtx,
        attackerUser.id,
        defenderUser.id,
        attackerStats,
        defenderStats,
        {},
        {}
      );
      
      console.log(`⚔️ Battle ${battle.id} created`);
      
      // Apply damage to User objects in cache (not just battle stats)
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (damageUserCtx) => {
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
      });

      // Call resolveBattle to end the battle and update user defense values
      await battleService.resolveBattle(battleCtx, battle.id, attackerUser.id);
    });
    
    
    console.log('✅ Battle ended');
    
    // Re-load users from cache to check they weren't reset
    console.log('🔄 Checking users in cache...');
    
    let attackerAfter: User | null = null;
    let defenderAfter: User | null = null;
    
    await createLockContext().useLockWithAcquire(USER_LOCK, async (userCtx2) => {
      attackerAfter = await userWorldCache.getUserByIdWithLock(userCtx2, attackerUser.id);
      defenderAfter = await userWorldCache.getUserByIdWithLock(userCtx2, defenderUser.id);
      
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
    });
    
    console.log('✅ Defense values correctly persisted after battle (not reset to max)');
  });
});
