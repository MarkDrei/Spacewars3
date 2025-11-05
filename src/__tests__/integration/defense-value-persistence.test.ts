// ---
// Defense Value Persistence Integration Test
// Validates that hull/armor/shield values persist correctly after battles
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserWorldCache, getUserWorldCache } from '../../lib/server/world/userWorldCache';
import * as BattleRepo from '../../lib/server/battle/battleRepo';
import * as battleService from '../../lib/server/battle/battleService';
import { createTestDatabase } from '../helpers/testDatabase';
import type { BattleStats, WeaponCooldowns } from '../../lib/server/battle/battleTypes';

describe('Defense Value Persistence After Battle', () => {
  
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
    await getUserWorldCache().shutdown();
  });

  it('defenseValues_afterBattleResolution_persistCorrectly', async () => {
    // === Phase 1: Setup ===
    const battleCache = getBattleCache();
    const cacheManager = getUserWorldCache();
    await cacheManager.initialize();

    // Initialize BattleCache manually for tests
    const db = await cacheManager.getDatabaseConnection();
    await battleCache.initialize(db);

    // Load users from cache
    const attacker = await cacheManager.getUserById(1);
    const defender = await cacheManager.getUserById(2);

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

    const battle = await BattleRepo.createBattle(
      attacker!.id,
      defender!.id,
      attackerStats,
      defenderStats,
      attackerCooldowns,
      defenderCooldowns
    );

    console.log(`Battle ${battle.id} created`);

    // Verify startStats are captured correctly
    expect(battle.attackerStartStats.hull.current).toBe(initialAttackerHull);
    expect(battle.attackeeStartStats.hull.current).toBe(initialDefenderHull);

    // === Phase 3: Process Battle Turns ===
    // Process first turn
    await battleService.updateBattle(battle.id);
    
    let currentBattle = await BattleRepo.getBattle(battle.id);
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
      await battleService.updateBattle(currentBattle.id);
      currentBattle = await BattleRepo.getBattle(currentBattle.id);
      iterations++;
    }

    expect(currentBattle?.battleEndTime).not.toBeNull();
    console.log(`Battle ended after ${iterations} iterations`);

    // === Phase 5: Verify Defense Values Persisted ===
    // Flush cache to ensure values are written to DB
    await cacheManager.flushAllToDatabase();

    // Clear cache and reload users from DB
    UserWorldCache.resetInstance();
    const freshCacheManager = getUserWorldCache();
    await freshCacheManager.initialize();

    // Load users again from database
    const reloadedAttacker = await freshCacheManager.getUserById(attacker!.id);
    const reloadedDefender = await freshCacheManager.getUserById(defender!.id);

    console.log(`Reloaded attacker hull: ${reloadedAttacker?.hullCurrent}`);
    console.log(`Reloaded defender hull: ${reloadedDefender?.hullCurrent}`);

    // Verify that defense values match the endStats from the battle
    const finalAttackerHull = currentBattle?.attackerEndStats?.hull.current ?? initialAttackerHull;
    const finalDefenderHull = currentBattle?.attackeeEndStats?.hull.current ?? initialDefenderHull;

    expect(reloadedAttacker?.hullCurrent).toBe(finalAttackerHull);
    expect(reloadedDefender?.hullCurrent).toBe(finalDefenderHull);

    // At least one user's hull should be 0 (they lost)
    const attackerDestroyed = reloadedAttacker?.hullCurrent === 0;
    const defenderDestroyed = reloadedDefender?.hullCurrent === 0;
    expect(attackerDestroyed || defenderDestroyed).toBe(true);

    console.log('✅ Defense values persisted correctly after battle');
  });
});
