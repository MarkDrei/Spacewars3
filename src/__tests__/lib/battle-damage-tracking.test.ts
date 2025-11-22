// ---
// Battle Damage Tracking Tests
// NOTE: These tests are now deprecated as defense values are tracked in User objects via cache
// The tests have been updated to reflect the new architecture where:
// - startStats and endStats are "write once" snapshots
// - Defense values are tracked in User objects during battle
// ---

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BattleEngine } from '../../lib/server/battle/battleEngine';
import type { Battle, BattleStats } from '../../lib/server/battle/battleTypes';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { userCache } from '@/lib/server/user/userCache';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';
import { getDatabase } from '@/lib/server/database';

// Mock save callback for test users
const mockSaveCallback = vi.fn().mockResolvedValue(undefined);

/**
 * Helper to create a test user for battle testing
 */
function createTestUser(
  id: number,
  username: string,
  hullCurrent: number = 500,
  armorCurrent: number = 500,
  shieldCurrent: number = 500
): User {
  const defaultTechCounts: TechCounts = {
    pulse_laser: 5,
    auto_turret: 0,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    kinetic_armor: 1,
    energy_shield: 1,
    missile_jammer: 0,
    ship_hull: 1
  };

  return new User(
    id,
    username,
    'password_hash',
    1000,
    Math.floor(Date.now() / 1000),
    createInitialTechTree(),
    mockSaveCallback,
    defaultTechCounts,
    hullCurrent,
    armorCurrent,
    shieldCurrent,
    Math.floor(Date.now() / 1000),
    true, // inBattle
    null // currentBattleId
  );
}

describe('Battle Damage Tracking', () => {
  beforeEach(async () => {
    // Reset cache manager for each test
    userCache.resetInstance();

    const db = await getDatabase();
    await userCache.intialize2(db, {}, {
      persistenceIntervalMs: 30000,
      enableAutoPersistence: false,
      logStats: false
    });
    const cache = userCache.getInstance2();
    
    // Note: We don't call initialize() because we don't want to connect to the database
    // Instead, we'll directly populate the cache with test users
    
    // Create mock users for battle testing
    const attacker = createTestUser(1, 'attacker');
    const defender = createTestUser(2, 'defender');
    
    // Pre-populate cache with test users (using USER_LOCK)
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      cache.setUserUnsafe(userCtx, attacker);
      cache.setUserUnsafe(userCtx, defender);
    });
  });

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

  it('damageTracking_attackerFires_damageAccumulates', async () => {
    // Arrange
    const battle = createTestBattle();
    const engine = new BattleEngine(battle);
    const currentTime = battle.battleStartTime;

    const emptyCtx = createLockContext();
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
      // Act - Attacker fires weapon (async now)
      await engine.executeTurn(battleCtx, currentTime);
  
      // Assert - Total damage should be tracked in battle object
      const updatedBattle = engine.getBattle();
      // Damage depends on weapon specs (5 weapons with configured damage)
      expect(updatedBattle.attackerTotalDamage).toBeGreaterThan(0);
      expect(updatedBattle.attackeeTotalDamage).toBe(0);
    });
  });

  it('damageTracking_multipleRounds_damageAccumulates', async () => {
    // Arrange
    const battle = createTestBattle();
    const engine = new BattleEngine(battle);
    const baseTime = battle.battleStartTime;

    const emptyCtx = createLockContext();
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
      // Act - Execute multiple turns with proper cooldown management (async now)
      const event1 = await engine.executeTurn(battleCtx, baseTime); // Attacker fires
      expect(event1).not.toBeNull();
      const firstAttackerDamage = engine.getBattle().attackerTotalDamage;
      expect(firstAttackerDamage).toBeGreaterThan(0);
      
      // Weapon cooldown is now set to baseTime, so need to wait cooldown period
      const event2 = await engine.executeTurn(battleCtx, baseTime + 10); // Enough time for both to be ready
      expect(event2).not.toBeNull();
      
      const event3 = await engine.executeTurn(battleCtx, baseTime + 20); // Another turn
      expect(event3).not.toBeNull();
  
      // Assert - Damage accumulates over multiple rounds
      const updatedBattle = engine.getBattle();
      // At least 3 shots were fired, so total damage should be at least firstAttackerDamage
      const totalDamage = updatedBattle.attackerTotalDamage + updatedBattle.attackeeTotalDamage;
      expect(totalDamage).toBeGreaterThanOrEqual(firstAttackerDamage);
      expect(totalDamage).toBeGreaterThan(0);
    });

  });

  it('damageTracking_newBattle_startsAtZero', () => {
    // Arrange
    const battle = createTestBattle();
    
    // Assert
    expect(battle.attackerTotalDamage).toBe(0);
    expect(battle.attackeeTotalDamage).toBe(0);
  });

  it('damageTracking_damageApplied_totalUpdated', async () => {
    // Arrange
    const battle = createTestBattle();
    const engine = new BattleEngine(battle);
    const initialShieldCurrent = battle.attackeeStartStats.shield.current;

    const emptyCtx = createLockContext();
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
      // Act (async now)
      await engine.executeTurn(battleCtx, battle.battleStartTime);

      // Assert - startStats should remain unchanged (initial snapshot)
      const updatedBattle = engine.getBattle();
      expect(updatedBattle.attackeeStartStats.shield.current).toBe(initialShieldCurrent);

      // Assert - endStats are NOT populated during battle (only at battle end)
      // Defense values are tracked in User objects via cache during battle
      expect(updatedBattle.attackeeEndStats).toBeNull();

      // Total damage should still be tracked in battle object
      expect(updatedBattle.attackerTotalDamage).toBeGreaterThan(0);
    });
  });
});
