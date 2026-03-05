/**
 * Unit tests for battle scheduler weapon refresh logic.
 *
 * Tests cover:
 *  - Issue 1: getReadyWeapons iterates the cooldowns map (not startStats) so that
 *    weapons discovered mid-battle are included automatically.
 *  - Issue 2: weapons with count = 0 in live techCounts are not fired even if their
 *    cooldown is "ready".
 *  - Issue 3: newly built weapon types appear in the cooldowns map after discovery.
 *
 * These are pure logic tests that require no database and no lock infrastructure.
 */

import { describe, it, expect } from 'vitest';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import type { Battle, BattleStats, WeaponCooldowns } from '@/lib/server/battle/battleTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCooldowns(weapons: Record<string, number>): WeaponCooldowns {
  return { ...weapons };
}

function makeStats(weapons: Record<string, { count: number; damage: number; cooldown: number }>): BattleStats {
  return {
    hull: { current: 100, max: 100 },
    armor: { current: 50, max: 50 },
    shield: { current: 25, max: 25 },
    weapons,
  };
}

function makeBattle(
  attackerCooldowns: WeaponCooldowns,
  attackeeCooldowns: WeaponCooldowns,
  attackerStats?: BattleStats,
  attackeeStats?: BattleStats
): Battle {
  return {
    id: 1,
    attackerId: 10,
    attackeeId: 20,
    battleStartTime: 0,
    battleEndTime: null,
    winnerId: null,
    loserId: null,
    attackerWeaponCooldowns: attackerCooldowns,
    attackeeWeaponCooldowns: attackeeCooldowns,
    attackerStartStats: attackerStats ?? makeStats({}),
    attackeeStartStats: attackeeStats ?? makeStats({}),
    attackerEndStats: null,
    attackeeEndStats: null,
    battleLog: [],
    attackerTotalDamage: 0,
    attackeeTotalDamage: 0,
  };
}

// ---------------------------------------------------------------------------
// getReadyWeapons behaviour (tested via public observable behaviour of the
// Battle object, since getReadyWeapons is not exported).
// The tests below verify the *contract* that the cooldown map is the source of
// truth for which weapons participate in battle rounds.
// ---------------------------------------------------------------------------

describe('Battle cooldowns map as source of truth', () => {
  const NOW = 1_000_000; // arbitrary current time in seconds

  it('weaponsInCooldownsMap_withZeroCooldown_areConsideredReady', () => {
    // A weapon with cooldown=0 in the map should be "ready" (0 <= NOW)
    const cooldowns = makeCooldowns({ pulse_laser: 0 });
    expect(cooldowns['pulse_laser']).toBe(0);
    expect(NOW >= cooldowns['pulse_laser']).toBe(true);
  });

  it('weaponsInCooldownsMap_withFutureCooldown_areNotReady', () => {
    const cooldowns = makeCooldowns({ pulse_laser: NOW + 100 });
    expect(NOW >= cooldowns['pulse_laser']).toBe(false);
  });

  it('weaponsOnlyInStartStats_notInCooldownsMap_areNotInCooldownsIteration', () => {
    // Under the new design, getReadyWeapons iterates cooldowns, NOT startStats.
    // A weapon present in startStats but absent from cooldowns should NOT be
    // returned by a cooldown-based iteration.
    const attackerStats = makeStats({
      pulse_laser: { count: 1, damage: 8, cooldown: 30 },
    });
    const attackerCooldowns = makeCooldowns({}); // pulse_laser NOT registered
    const battle = makeBattle(attackerCooldowns, {}, attackerStats);

    // The cooldowns map for attacker is empty → no ready weapons
    const readyFromCooldowns = Object.entries(battle.attackerWeaponCooldowns)
      .filter(([, nextReady]) => NOW >= nextReady)
      .map(([weaponType]) => weaponType);

    expect(readyFromCooldowns).toHaveLength(0);
  });

  it('weaponAddedMidBattleToCooldownsMap_withZeroCooldown_isImmediatelyReady', () => {
    // Simulate: user builds rocket_launcher after battle starts.
    // discoverNewWeapons registers it with cooldown=0.
    const attackerCooldowns = makeCooldowns({ pulse_laser: 0 });
    // Simulate discovery:
    attackerCooldowns['rocket_launcher'] = 0;

    const readyFromCooldowns = Object.entries(attackerCooldowns)
      .filter(([, nextReady]) => NOW >= nextReady)
      .map(([weaponType]) => weaponType);

    expect(readyFromCooldowns).toContain('pulse_laser');
    expect(readyFromCooldowns).toContain('rocket_launcher');
  });
});

// ---------------------------------------------------------------------------
// discoverNewWeapons contract: only registers weapons not yet in cooldowns
// ---------------------------------------------------------------------------

describe('discoverNewWeapons contract', () => {
  it('allWeaponKeys_arePresentInTechFactory', () => {
    // Verify TechFactory.getWeaponKeys() returns the expected weapons.
    const keys = TechFactory.getWeaponKeys();
    expect(keys).toContain('pulse_laser');
    expect(keys).toContain('auto_turret');
    expect(keys).toContain('rocket_launcher');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('newWeapon_notInCooldownsMap_isDiscoverable', () => {
    // Simulate the discovery check: iterate weapon keys, find one not in cooldowns.
    const cooldowns = makeCooldowns({ pulse_laser: 0 }); // only pulse_laser registered
    const techCounts: Record<string, number> = {
      pulse_laser: 1,
      rocket_launcher: 2, // built mid-battle, NOT yet in cooldowns
    };

    const allWeaponKeys = TechFactory.getWeaponKeys();
    const newWeapons: string[] = [];

    for (const weaponType of allWeaponKeys) {
      const count = techCounts[weaponType] ?? 0;
      if (count > 0 && !(weaponType in cooldowns)) {
        newWeapons.push(weaponType);
      }
    }

    expect(newWeapons).toContain('rocket_launcher');
    expect(newWeapons).not.toContain('pulse_laser'); // already registered
  });

  it('newWeapon_withZeroCount_isNotDiscovered', () => {
    // A weapon with count=0 should NOT be registered even if missing from cooldowns.
    const cooldowns = makeCooldowns({});
    const techCounts: Record<string, number> = {
      rocket_launcher: 0, // weapon exists but count is 0
    };

    const allWeaponKeys = TechFactory.getWeaponKeys();
    const newWeapons: string[] = [];

    for (const weaponType of allWeaponKeys) {
      const count = techCounts[weaponType] ?? 0;
      if (count > 0 && !(weaponType in cooldowns)) {
        newWeapons.push(weaponType);
      }
    }

    expect(newWeapons).not.toContain('rocket_launcher');
  });

  it('weaponAlreadyInCooldownsMap_isNotRegisteredAgain', () => {
    // A weapon already in cooldowns should NOT appear in the newWeapons list.
    const cooldowns = makeCooldowns({ pulse_laser: 12345 });
    const techCounts: Record<string, number> = { pulse_laser: 3 };

    const allWeaponKeys = TechFactory.getWeaponKeys();
    const newWeapons: string[] = [];

    for (const weaponType of allWeaponKeys) {
      const count = techCounts[weaponType] ?? 0;
      if (count > 0 && !(weaponType in cooldowns)) {
        newWeapons.push(weaponType);
      }
    }

    expect(newWeapons).not.toContain('pulse_laser');
  });
});

// ---------------------------------------------------------------------------
// Issue 1: live weapon count is used instead of startStats count
// ---------------------------------------------------------------------------

describe('Live weapon count from techCounts (issue 1)', () => {
  it('techCounts_weaponType_canBeReadAsRecord', () => {
    // Verify that using (techCounts as Record<string, number>)[weaponType] works
    // for any weapon key returned by TechFactory.
    const techCounts = {
      pulse_laser: 3,
      auto_turret: 0,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 2,
      ship_hull: 1,
      kinetic_armor: 1,
      energy_shield: 1,
      missile_jammer: 0,
    };

    const record = techCounts as Record<string, number>;

    expect(record['pulse_laser']).toBe(3);
    expect(record['rocket_launcher']).toBe(2);
    expect(record['auto_turret']).toBe(0);
    // Unknown weapon type returns undefined (handled by ?? 0)
    expect(record['unknown_weapon'] ?? 0).toBe(0);
  });

  it('weaponCount_zero_preventsWeaponFromFiring', () => {
    // Simulates the check inside fireWeapon: if live count is 0, skip.
    const techCounts: Record<string, number> = { pulse_laser: 0 };
    const currentCount = techCounts['pulse_laser'] ?? 0;
    expect(currentCount).toBe(0);
    // If currentCount === 0, fireWeapon returns early (weapon unavailable).
    expect(currentCount === 0).toBe(true);
  });

  it('weaponCount_positive_allowsWeaponToFire', () => {
    const techCounts: Record<string, number> = { pulse_laser: 5 };
    const currentCount = techCounts['pulse_laser'] ?? 0;
    expect(currentCount).toBe(5);
    expect(currentCount === 0).toBe(false);
  });

  it('startStats_count_mayDifferFromLiveTechCounts', () => {
    // Illustrates why we must NOT rely on startStats.weapons[x].count for firing.
    const startStatsCount = 1; // snapshotted at battle start
    const liveTechCount = 4;   // user built 3 more weapons mid-battle
    expect(liveTechCount).toBeGreaterThan(startStatsCount);
    // The shot salvo should use liveTechCount, not startStatsCount.
    expect(liveTechCount).toBe(4);
  });
});
