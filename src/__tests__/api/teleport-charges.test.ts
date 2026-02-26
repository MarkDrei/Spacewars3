import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';

describe('User.updateTeleportCharges', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  const defaultTechCounts = {
    pulse_laser: 5,
    auto_turret: 5,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: 5,
    kinetic_armor: 5,
    energy_shield: 5,
    missile_jammer: 0,
  };

  const BASE_TIME = 1000000;

  function createUser(teleportCharges = 0, teleportLastRegen = 0): User {
    return new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      BASE_TIME,
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      BASE_TIME, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      teleportCharges,
      teleportLastRegen
    );
  }

  beforeEach(() => {
    TimeMultiplierService.resetInstance();
    user = createUser();
  });

  afterEach(() => {
    TimeMultiplierService.resetInstance();
  });

  test('updateTeleportCharges_noTeleportResearch_doesNothing', () => {
    // Teleport at level 0 (default) - no charges possible
    user.teleportLastRegen = BASE_TIME;
    const now = BASE_TIME + 86400; // 24 hours later

    user.updateTeleportCharges(now);

    expect(user.teleportCharges).toBe(0);
    // timestamp should NOT be updated since we returned early
    expect(user.teleportLastRegen).toBe(BASE_TIME);
  });

  test('updateTeleportCharges_firstCall_initializesTimestampAndReturns', () => {
    // Set up user with teleport research (1 charge max)
    user.techTree.teleport = 1;
    user.teleportLastRegen = 0; // Default state: never been called
    user.teleportCharges = 0;

    const now = BASE_TIME + 50000;
    user.updateTeleportCharges(now);

    // Should initialize timestamp but NOT add charges
    expect(user.teleportLastRegen).toBe(now);
    expect(user.teleportCharges).toBe(0);
  });

  test('updateTeleportCharges_partialRecharge_addsFractionalCharge', () => {
    // User has 1 max charge, recharge time 86400s (default level 1)
    user.techTree.teleport = 1;
    user.teleportCharges = 0;
    user.teleportLastRegen = BASE_TIME;

    // 12 hours = 43200s elapsed → should gain 43200 / 86400 = 0.5 charges
    const now = BASE_TIME + 43200;
    user.updateTeleportCharges(now);

    expect(user.teleportCharges).toBeCloseTo(0.5);
    expect(user.teleportLastRegen).toBe(now);
  });

  test('updateTeleportCharges_elapsedTime_correctGain', () => {
    // User has 2 max charges, recharge time 86400s
    user.techTree.teleport = 2;
    user.teleportCharges = 0;
    user.teleportLastRegen = BASE_TIME;

    // 24 hours = 86400s elapsed → should gain exactly 1 charge
    const now = BASE_TIME + 86400;
    user.updateTeleportCharges(now);

    expect(user.teleportCharges).toBeCloseTo(1.0);
  });

  test('updateTeleportCharges_fullCharges_doesNotExceedMax', () => {
    // User already has max charges
    user.techTree.teleport = 2;
    user.teleportCharges = 2; // Already at max
    user.teleportLastRegen = BASE_TIME;

    const now = BASE_TIME + 86400; // 24 more hours
    user.updateTeleportCharges(now);

    // Should not exceed max
    expect(user.teleportCharges).toBe(2);
  });

  test('updateTeleportCharges_nearMaxCharges_clampedAtMax', () => {
    // User has 1.8 charges, max is 2
    user.techTree.teleport = 2;
    user.teleportCharges = 1.8;
    user.teleportLastRegen = BASE_TIME;

    // Enough time to add > 0.2 charges
    const now = BASE_TIME + 50000; // ~0.578 charges would be added
    user.updateTeleportCharges(now);

    // Should be capped at 2 (max)
    expect(user.teleportCharges).toBe(2);
  });

  test('updateTeleportCharges_timeMultiplier_appliesCorrectly', () => {
    // Set 2x time multiplier
    TimeMultiplierService.getInstance().setMultiplier(2, 5);

    user.techTree.teleport = 2;
    user.teleportCharges = 0;
    user.teleportLastRegen = BASE_TIME;

    // 12 hours real time = 24 hours game time with 2x multiplier
    // 24h game time / 24h recharge = 1 charge
    const now = BASE_TIME + 43200; // 12 real hours
    user.updateTeleportCharges(now);

    expect(user.teleportCharges).toBeCloseTo(1.0);
  });

  test('updateTeleportCharges_zeroElapsed_doesNothing', () => {
    user.techTree.teleport = 1;
    user.teleportCharges = 0;
    user.teleportLastRegen = BASE_TIME;

    // No time elapsed
    user.updateTeleportCharges(BASE_TIME);

    expect(user.teleportCharges).toBe(0);
  });

  test('updateTeleportCharges_calledFromUpdateStats_chargesAccumulate', () => {
    // updateStats should call updateTeleportCharges internally
    user.techTree.teleport = 1;
    user.teleportCharges = 0;
    user.teleportLastRegen = BASE_TIME;

    // 24 hours elapsed
    user.updateStats(BASE_TIME + 86400);

    // Should have accumulated charges
    expect(user.teleportCharges).toBeCloseTo(1.0);
  });

  test('updateTeleportCharges_improvedRechargeSpeed_accumulates2xFaster', () => {
    // Level 2 recharge speed: 86400 * 0.9 = 77760s per charge
    user.techTree.teleport = 1;
    user.techTree.teleportRechargeSpeed = 2;
    user.teleportCharges = 0;
    user.teleportLastRegen = BASE_TIME;

    // 77760s elapsed → exactly 1 charge
    const now = BASE_TIME + 77760;
    user.updateTeleportCharges(now);

    expect(user.teleportCharges).toBeCloseTo(1.0);
  });
});
