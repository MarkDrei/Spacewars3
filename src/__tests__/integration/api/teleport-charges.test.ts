import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { TechCounts } from '@/lib/server/techs/TechFactory';

/**
 * Create a minimal TechCounts for unit tests
 */
function createTestTechCounts(): TechCounts {
  return {
    pulse_laser: 1,
    auto_turret: 0,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: 1,
    kinetic_armor: 0,
    energy_shield: 0,
    missile_jammer: 0,
  };
}

/**
 * Create a test User with controllable state.
 */
function createTestUser(overrides: {
  teleportCharges?: number;
  teleportLastRegen?: number;
  teleportLevel?: number;
  teleportRechargeSpeedLevel?: number;
}): User {
  const techTree = createInitialTechTree();

  if (overrides.teleportLevel !== undefined) {
    techTree.teleport = overrides.teleportLevel;
  }
  if (overrides.teleportRechargeSpeedLevel !== undefined) {
    techTree.teleportRechargeSpeed = overrides.teleportRechargeSpeedLevel;
  }

  return new User(
    1,                        // id
    'testuser',               // username
    'hash',                   // password_hash
    1000,                     // iron
    0,                        // xp
    Math.floor(Date.now() / 1000), // last_updated
    techTree,                 // techTree
    async () => {},           // saveCallback
    createTestTechCounts(),   // techCounts
    100,                      // hullCurrent
    50,                       // armorCurrent
    25,                       // shieldCurrent
    Math.floor(Date.now() / 1000), // defenseLastRegen
    false,                    // inBattle
    null,                     // currentBattleId
    [],                       // buildQueue
    null,                     // buildStartSec
    overrides.teleportCharges ?? 0,      // teleportCharges
    overrides.teleportLastRegen ?? 0,    // teleportLastRegen
    undefined                 // ship_id
  );
}

describe('updateTeleportCharges', () => {
  beforeEach(() => {
    TimeMultiplierService.resetInstance();
  });

  afterEach(() => {
    TimeMultiplierService.resetInstance();
  });

  test('updateTeleportCharges_noTeleportResearch_doesNothing', () => {
    // Level 0 → getResearchEffect returns 0 for constant type with baseValue=1:
    // effect = baseValue + value * (level - 1) = 1 + 1 * (0 - 1) = 0
    // So maxCharges = 0, method returns early.
    const user = createTestUser({ teleportLevel: 0, teleportCharges: 0, teleportLastRegen: 1000 });

    user.updateTeleportCharges(2000);

    // Charges should remain 0, lastRegen unchanged since method returned early
    expect(user.teleportCharges).toBe(0);
    expect(user.teleportLastRegen).toBe(1000);
  });

  test('updateTeleportCharges_firstCall_initializesLastRegen', () => {
    // When teleportLastRegen is 0, it should be set to now without adding charges
    const user = createTestUser({ teleportLevel: 1, teleportCharges: 0, teleportLastRegen: 0 });

    const now = 5000;
    user.updateTeleportCharges(now);

    expect(user.teleportLastRegen).toBe(now);
    expect(user.teleportCharges).toBe(0); // No charges accumulated on first call
  });

  test('updateTeleportCharges_accumulates_correctly', () => {
    // Level 1 → 1 max charge, recharge speed level 1 → 86400 seconds per charge
    // With time multiplier = 1: 86400 seconds elapsed → gain exactly 1 charge
    const rechargeTimeSec = 86400;
    const lastRegen = 1000;
    const elapsed = rechargeTimeSec; // exactly one full recharge period
    const now = lastRegen + elapsed;

    const user = createTestUser({
      teleportLevel: 1,
      teleportRechargeSpeedLevel: 1,
      teleportCharges: 0,
      teleportLastRegen: lastRegen,
    });

    user.updateTeleportCharges(now);

    // Should have gained exactly 1 charge (clamped to max of 1)
    expect(user.teleportCharges).toBeCloseTo(1, 5);
    expect(user.teleportLastRegen).toBe(now);
  });

  test('updateTeleportCharges_clampsToMaxCharges', () => {
    // Level 2 → 2 max charges, but already at 1.9 charges
    // Even if we pass enough time, cannot exceed max
    const rechargeTimeSec = 86400;
    const lastRegen = 1000;
    const elapsed = rechargeTimeSec * 10; // lots of time
    const now = lastRegen + elapsed;

    const user = createTestUser({
      teleportLevel: 2,
      teleportRechargeSpeedLevel: 1,
      teleportCharges: 1.9,
      teleportLastRegen: lastRegen,
    });

    user.updateTeleportCharges(now);

    // Max charges is 2 (at level 2)
    expect(user.teleportCharges).toBe(2);
  });

  test('updateTeleportCharges_timeMultiplier_appliedCorrectly', () => {
    // With a 2x time multiplier, charge accumulation should double
    TimeMultiplierService.getInstance().setMultiplier(2, 60);

    const rechargeTimeSec = 86400;
    const lastRegen = 1000;
    // Half the normal time elapsed, but 2x multiplier = equivalent to full recharge
    const elapsed = rechargeTimeSec / 2;
    const now = lastRegen + elapsed;

    const user = createTestUser({
      teleportLevel: 3,
      teleportRechargeSpeedLevel: 1,
      teleportCharges: 0,
      teleportLastRegen: lastRegen,
    });

    user.updateTeleportCharges(now);

    // With 2x multiplier and half time elapsed: 0.5 * 2 / 1 = 1.0 charges
    expect(user.teleportCharges).toBeCloseTo(1.0, 5);
  });

  test('updateTeleportCharges_zeroElapsed_doesNothing', () => {
    const user = createTestUser({
      teleportLevel: 1,
      teleportCharges: 0.5,
      teleportLastRegen: 5000,
    });

    user.updateTeleportCharges(5000); // same time = 0 elapsed

    expect(user.teleportCharges).toBe(0.5); // unchanged
  });

  test('updateTeleportCharges_partialRecharge_fractionalCharge', () => {
    // Half the recharge time elapsed → should gain 0.5 charges
    const rechargeTimeSec = 86400;
    const lastRegen = 1000;
    const elapsed = rechargeTimeSec / 2; // half recharge period
    const now = lastRegen + elapsed;

    const user = createTestUser({
      teleportLevel: 2,
      teleportRechargeSpeedLevel: 1,
      teleportCharges: 0,
      teleportLastRegen: lastRegen,
    });

    user.updateTeleportCharges(now);

    expect(user.teleportCharges).toBeCloseTo(0.5, 5);
  });
});
