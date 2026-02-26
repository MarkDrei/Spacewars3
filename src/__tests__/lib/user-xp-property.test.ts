import { describe, expect, test } from 'vitest';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';

describe('User XP Property', () => {
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };
  
  const defaultTechCounts: TechCounts = {
    pulse_laser: 5,
    auto_turret: 5,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: 5,
    kinetic_armor: 5,
    energy_shield: 5,
    missile_jammer: 0
  };

  test('constructor_withZeroXp_initializesXpToZero', () => {
    // Arrange & Act
    const user = new User(
      1,
      'testuser',
      'hash',
      100, // iron
      0, // xp
      1000, // last_updated
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0  // teleportLastRegen
    );

    // Assert
    expect(user.xp).toBe(0);
  });

  test('constructor_withPositiveXp_initializesXpCorrectly', () => {
    // Arrange & Act
    const user = new User(
      1,
      'testuser',
      'hash',
      100, // iron
      5000, // xp
      1000, // last_updated
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0  // teleportLastRegen
    );

    // Assert
    expect(user.xp).toBe(5000);
  });

  test('constructor_withLargeXp_initializesCorrectly', () => {
    // Arrange & Act
    const user = new User(
      1,
      'testuser',
      'hash',
      100, // iron
      999999, // xp
      1000, // last_updated
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0  // teleportLastRegen
    );

    // Assert
    expect(user.xp).toBe(999999);
  });

  test('xpProperty_isNumber_typeCheck', () => {
    // Arrange
    const user = new User(
      1,
      'testuser',
      'hash',
      100, // iron
      1500, // xp
      1000, // last_updated
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0  // teleportLastRegen
    );

    // Assert
    expect(typeof user.xp).toBe('number');
  });

  test('xpProperty_canBeModified_inPlace', () => {
    // Arrange
    const user = new User(
      1,
      'testuser',
      'hash',
      100, // iron
      1000, // xp
      1000, // last_updated
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0  // teleportLastRegen
    );

    // Act
    user.xp += 500;

    // Assert
    expect(user.xp).toBe(1500);
  });

  test('xpProperty_independentOfOtherProperties_noSideEffects', () => {
    // Arrange
    const user = new User(
      1,
      'testuser',
      'hash',
      100, // iron
      1000, // xp
      1000, // last_updated
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0  // teleportLastRegen
    );

    const originalIron = user.iron;
    const originalLastUpdated = user.last_updated;

    // Act
    user.xp = 5000;

    // Assert
    expect(user.xp).toBe(5000);
    expect(user.iron).toBe(originalIron); // Iron unchanged
    expect(user.last_updated).toBe(originalLastUpdated); // Timestamp unchanged
  });
});
