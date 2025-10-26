// ---
// Battle Damage Tracking Tests
// ---

import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../lib/server/battle';
import type { Battle, BattleStats } from '../../shared/battleTypes';

describe('Battle Damage Tracking', () => {
  /**
   * Helper to create a test battle
   */
  function createTestBattle(): Battle {
    const attackerStats: BattleStats = {
      hull: { current: 500, max: 500 },
      armor: { current: 500, max: 500 },
      shield: { current: 500, max: 500 },
      weapons: {
        pulse_laser: { count: 5, damage: 10, cooldown: 5 }
      }
    };

    const attackeeStats: BattleStats = {
      hull: { current: 500, max: 500 },
      armor: { current: 500, max: 500 },
      shield: { current: 500, max: 500 },
      weapons: {
        pulse_laser: { count: 5, damage: 10, cooldown: 5 }
      }
    };

    return {
      id: 1,
      attackerId: 1,
      attackeeId: 2,
      battleStartTime: Math.floor(Date.now() / 1000),
      battleEndTime: null,
      winnerId: null,
      loserId: null,
      attackerWeaponCooldowns: { pulse_laser: 0 },
      attackeeWeaponCooldowns: { pulse_laser: 0 },
      attackerStartStats: attackerStats,
      attackeeStartStats: attackeeStats,
      attackerEndStats: null,
      attackeeEndStats: null,
      battleLog: [],
      attackerTotalDamage: 0,
      attackeeTotalDamage: 0
    };
  }

  it('damageTracking_attackerFires_damageAccumulates', () => {
    // Arrange
    const battle = createTestBattle();
    const engine = new BattleEngine(battle);
    const currentTime = battle.battleStartTime;

    // Act - Attacker fires weapon
    engine.executeTurn(currentTime);

    // Assert
    const updatedBattle = engine.getBattle();
    // Damage depends on weapon specs (5 weapons with configured damage)
    expect(updatedBattle.attackerTotalDamage).toBeGreaterThan(0);
    expect(updatedBattle.attackeeTotalDamage).toBe(0);
  });

  it('damageTracking_multipleRounds_damageAccumulates', () => {
    // Arrange
    const battle = createTestBattle();
    const engine = new BattleEngine(battle);
    const baseTime = battle.battleStartTime;

    // Act - Execute multiple turns with proper cooldown management
    const event1 = engine.executeTurn(baseTime); // Attacker fires
    expect(event1).not.toBeNull();
    const firstAttackerDamage = engine.getBattle().attackerTotalDamage;
    expect(firstAttackerDamage).toBeGreaterThan(0);
    
    // Weapon cooldown is now set to baseTime, so need to wait cooldown period
    const event2 = engine.executeTurn(baseTime + 10); // Enough time for both to be ready
    expect(event2).not.toBeNull();
    
    const event3 = engine.executeTurn(baseTime + 20); // Another turn
    expect(event3).not.toBeNull();

    // Assert - Damage accumulates over multiple rounds
    const updatedBattle = engine.getBattle();
    // At least 3 shots were fired, so total damage should be at least firstAttackerDamage
    const totalDamage = updatedBattle.attackerTotalDamage + updatedBattle.attackeeTotalDamage;
    expect(totalDamage).toBeGreaterThanOrEqual(firstAttackerDamage);
    expect(totalDamage).toBeGreaterThan(0);
  });

  it('damageTracking_newBattle_startsAtZero', () => {
    // Arrange
    const battle = createTestBattle();
    
    // Assert
    expect(battle.attackerTotalDamage).toBe(0);
    expect(battle.attackeeTotalDamage).toBe(0);
  });

  it('damageTracking_damageApplied_totalUpdated', () => {
    // Arrange
    const battle = createTestBattle();
    const engine = new BattleEngine(battle);
    const initialShieldCurrent = battle.attackeeStartStats.shield.current;

    // Act
    engine.executeTurn(battle.battleStartTime);

    // Assert - startStats should remain unchanged (initial snapshot)
    const updatedBattle = engine.getBattle();
    expect(updatedBattle.attackeeStartStats.shield.current).toBe(initialShieldCurrent);
    
    // Assert - endStats should be created and reflect damage
    expect(updatedBattle.attackeeEndStats).not.toBeNull();
    expect(updatedBattle.attackeeEndStats!.shield.current).toBeLessThan(initialShieldCurrent);
    
    // And total damage was tracked
    expect(updatedBattle.attackerTotalDamage).toBeGreaterThan(0);
  });
});
