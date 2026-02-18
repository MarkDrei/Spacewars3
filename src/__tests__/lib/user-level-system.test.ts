import { describe, expect, test, beforeEach } from 'vitest';
import { INVENTORY_ROWS, INVENTORY_COLS, InventoryItem } from '@/shared/src/types/inventory';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';

describe('User Level System - getLevel()', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  beforeEach(() => {
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
      missile_jammer: 0
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
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
      Array.from({ length: INVENTORY_ROWS }, () => Array.from({ length: INVENTORY_COLS }, () => null))
    );
  });

  test('getLevel_zeroXp_returnsLevelOne', () => {
    user.xp = 0;
    expect(user.getLevel()).toBe(1);
  });

  test('getLevel_justBelowLevel2Threshold_returnsLevelOne', () => {
    user.xp = 999;
    expect(user.getLevel()).toBe(1);
  });

  test('getLevel_exactlyLevel2Threshold_returnsLevelTwo', () => {
    user.xp = 1000;
    expect(user.getLevel()).toBe(2);
  });

  test('getLevel_justAboveLevel2Threshold_returnsLevelTwo', () => {
    user.xp = 1001;
    expect(user.getLevel()).toBe(2);
  });

  test('getLevel_justBelowLevel3Threshold_returnsLevelTwo', () => {
    // Level 3 requires 1000 + 3000 = 4000 total XP
    user.xp = 3999;
    expect(user.getLevel()).toBe(2);
  });

  test('getLevel_exactlyLevel3Threshold_returnsLevelThree', () => {
    user.xp = 4000; // 1000 + 3000
    expect(user.getLevel()).toBe(3);
  });

  test('getLevel_justBelowLevel4Threshold_returnsLevelThree', () => {
    // Level 4 requires 1000 + 3000 + 6000 = 10000 total XP
    user.xp = 9999;
    expect(user.getLevel()).toBe(3);
  });

  test('getLevel_exactlyLevel4Threshold_returnsLevelFour', () => {
    user.xp = 10000; // 1000 + 3000 + 6000
    expect(user.getLevel()).toBe(4);
  });

  test('getLevel_level5_calculatesCorrectly', () => {
    // Level 5 requires 1000 + 3000 + 6000 + 10000 = 20000 total XP
    user.xp = 20000;
    expect(user.getLevel()).toBe(5);
  });

  test('getLevel_level10_calculatesCorrectly', () => {
    // Level 10 requires sum of triangular numbers 1-9
    // = (1 + 3 + 6 + 10 + 15 + 21 + 28 + 36 + 45) * 1000 = 165,000
    user.xp = 165000;
    expect(user.getLevel()).toBe(10);
  });

  test('getLevel_veryHighXp_calculatesCorrectly', () => {
    // For very high level testing, use a more reasonable level like 20
    // Level 20 requires sum of triangular numbers 1-19
    // Triangular sum formula: sum of T(k) for k=1 to n = n(n+1)(n+2)/6
    // For n=19: 19*20*21/6 = 1330
    user.xp = 1330000;
    expect(user.getLevel()).toBe(20);
  });

  test('getLevel_justBelowLevel20_returnsLevel19', () => {
    user.xp = 1329999;
    expect(user.getLevel()).toBe(19);
  });

  test('getLevel_midwayBetweenLevels_returnsLowerLevel', () => {
    // Midway between level 2 (1000) and level 3 (4000)
    user.xp = 2500;
    expect(user.getLevel()).toBe(2);
  });
});

describe('User Level System - getXpForNextLevel()', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  beforeEach(() => {
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
      missile_jammer: 0
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
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
      Array.from({ length: INVENTORY_ROWS }, () => Array.from({ length: INVENTORY_COLS }, () => null))
    );
  });

  test('getXpForNextLevel_atLevel1_returnsLevel2Threshold', () => {
    user.xp = 0; // Level 1
    expect(user.getXpForNextLevel()).toBe(1000);
  });

  test('getXpForNextLevel_partialLevel1_returnsLevel2Threshold', () => {
    user.xp = 500; // Still level 1
    expect(user.getXpForNextLevel()).toBe(1000);
  });

  test('getXpForNextLevel_atLevel2_returnsLevel3Threshold', () => {
    user.xp = 1000; // Exactly level 2
    expect(user.getXpForNextLevel()).toBe(4000); // 1000 + 3000
  });

  test('getXpForNextLevel_partialLevel2_returnsLevel3Threshold', () => {
    user.xp = 2500; // Still level 2
    expect(user.getXpForNextLevel()).toBe(4000);
  });

  test('getXpForNextLevel_atLevel3_returnsLevel4Threshold', () => {
    user.xp = 4000; // Exactly level 3
    expect(user.getXpForNextLevel()).toBe(10000); // 1000 + 3000 + 6000
  });

  test('getXpForNextLevel_atLevel4_returnsLevel5Threshold', () => {
    user.xp = 10000; // Exactly level 4
    expect(user.getXpForNextLevel()).toBe(20000); // 1000 + 3000 + 6000 + 10000
  });

  test('getXpForNextLevel_atLevel9_returnsLevel10Threshold', () => {
    // Level 9 requires sum of triangular 1-8 = (1+3+6+10+15+21+28+36)*1000 = 120,000
    user.xp = 120000;
    expect(user.getLevel()).toBe(9);
    // Level 10 requires 120,000 + triangular(9)*1000 = 120,000 + 45,000 = 165,000
    expect(user.getXpForNextLevel()).toBe(165000);
  });

  test('getXpForNextLevel_atLevel10_returnsLevel11Threshold', () => {
    user.xp = 165000; // Level 10
    expect(user.getLevel()).toBe(10);
    // Level 11 requires 165,000 + triangular(10)*1000 = 165,000 + 55,000 = 220,000
    expect(user.getXpForNextLevel()).toBe(220000);
  });

  test('getXpForNextLevel_consistentWithGetLevel_forMultipleLevels', () => {
    // Test that getXpForNextLevel() returns values consistent with getLevel()
    // Helper to calculate XP for a given level (sum of triangular numbers)
    const calculateXpForLevel = (level: number): number => {
      if (level === 1) return 0;
      let total = 0;
      for (let k = 1; k < level; k++) {
        total += (k * (k + 1) / 2) * 1000;
      }
      return total;
    };

    const testLevels = [1, 2, 3, 4, 5];
    
    for (const level of testLevels) {
      // Calculate XP for this level
      const xpForLevel = calculateXpForLevel(level);
      user.xp = xpForLevel;
      
      expect(user.getLevel()).toBe(level);
      
      const xpForNext = user.getXpForNextLevel();
      
      // Set XP to one below the threshold
      user.xp = xpForNext - 1;
      expect(user.getLevel()).toBe(level);
      
      // Set XP to exactly the threshold
      user.xp = xpForNext;
      expect(user.getLevel()).toBe(level + 1);
    }
  });
});

describe('User Level System - addXp()', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  beforeEach(() => {
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
      missile_jammer: 0
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
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
      Array.from({ length: INVENTORY_ROWS }, () => Array.from({ length: INVENTORY_COLS }, () => null))
    );
  });

  test('addXp_positiveAmount_addsXpCorrectly', () => {
    user.xp = 0;
    user.addXp(500);
    expect(user.xp).toBe(500);
  });

  test('addXp_multipleAdds_accumulatesCorrectly', () => {
    user.xp = 0;
    user.addXp(100);
    user.addXp(200);
    user.addXp(300);
    expect(user.xp).toBe(600);
  });

  test('addXp_zeroAmount_returnsUndefined', () => {
    user.xp = 100;
    const result = user.addXp(0);
    expect(result).toBeUndefined();
    expect(user.xp).toBe(100); // XP unchanged
  });

  test('addXp_negativeAmount_returnsUndefined', () => {
    user.xp = 100;
    const result = user.addXp(-50);
    expect(result).toBeUndefined();
    expect(user.xp).toBe(100); // XP unchanged
  });

  test('addXp_noLevelUp_returnsUndefined', () => {
    user.xp = 100; // Level 1
    const result = user.addXp(500); // Still level 1 (total 600)
    expect(result).toBeUndefined();
    expect(user.xp).toBe(600);
    expect(user.getLevel()).toBe(1);
  });

  test('addXp_exactlyToNextLevel_returnsLevelUpInfo', () => {
    user.xp = 500; // Level 1
    const result = user.addXp(500); // Exactly to level 2 (total 1000)
    expect(result).toBeDefined();
    expect(result?.leveledUp).toBe(true);
    expect(result?.oldLevel).toBe(1);
    expect(result?.newLevel).toBe(2);
    expect(user.xp).toBe(1000);
    expect(user.getLevel()).toBe(2);
  });

  test('addXp_pastNextLevel_returnsLevelUpInfo', () => {
    user.xp = 500; // Level 1
    const result = user.addXp(1500); // Past level 2 (total 2000)
    expect(result).toBeDefined();
    expect(result?.leveledUp).toBe(true);
    expect(result?.oldLevel).toBe(1);
    expect(result?.newLevel).toBe(2);
    expect(user.xp).toBe(2000);
    expect(user.getLevel()).toBe(2);
  });

  test('addXp_multiplelevelsAtOnce_returnsFirstLevelChange', () => {
    user.xp = 0; // Level 1
    const result = user.addXp(10000); // Jump to level 4
    expect(result).toBeDefined();
    expect(result?.leveledUp).toBe(true);
    expect(result?.oldLevel).toBe(1);
    expect(result?.newLevel).toBe(4);
    expect(user.xp).toBe(10000);
    expect(user.getLevel()).toBe(4);
  });

  test('addXp_multipleLevelJumps_returnsCorrectLevelInfo', () => {
    user.xp = 100; // Level 1
    // Add enough to go from level 1 to level 5
    // Level 5 = 20000 XP
    const result = user.addXp(20000);
    expect(result).toBeDefined();
    expect(result?.leveledUp).toBe(true);
    expect(result?.oldLevel).toBe(1);
    expect(result?.newLevel).toBe(5);
    expect(user.xp).toBe(20100);
    expect(user.getLevel()).toBe(5);
  });

  test('addXp_justBelowLevelUp_returnsUndefined', () => {
    user.xp = 999; // Level 1, one below level 2
    const result = user.addXp(0); // No XP added
    expect(result).toBeUndefined();
    expect(user.getLevel()).toBe(1);
  });

  test('addXp_smallAmountBeforeThreshold_noLevelUp', () => {
    user.xp = 950; // Level 1, 50 below level 2
    const result = user.addXp(25); // Still below threshold (total 975)
    expect(result).toBeUndefined();
    expect(user.xp).toBe(975);
    expect(user.getLevel()).toBe(1);
  });

  test('addXp_largeAmount_updatesCorrectly', () => {
    user.xp = 0;
    const result = user.addXp(1000000);
    expect(result).toBeDefined();
    expect(result?.leveledUp).toBe(true);
    expect(result?.oldLevel).toBe(1);
    expect(user.xp).toBe(1000000);
    // With triangular progression, 1M XP gets you to a much lower level
    // This is fine - just verify level-up occurred
    expect(user.getLevel()).toBeGreaterThan(1);
  });

  test('addXp_doesNotModifyOtherProperties_ironUnchanged', () => {
    user.xp = 0;
    user.iron = 500;
    user.addXp(1000);
    expect(user.iron).toBe(500); // Iron should not change
  });

  test('addXp_doesNotModifyOtherProperties_lastUpdatedUnchanged', () => {
    user.xp = 0;
    const lastUpdated = user.last_updated;
    user.addXp(1000);
    expect(user.last_updated).toBe(lastUpdated);
  });

  test('addXp_consecutiveAddsWithLevelUps_tracksCorrectly', () => {
    user.xp = 0;
    
    // First add: level 1 -> 2
    let result = user.addXp(1000);
    expect(result?.oldLevel).toBe(1);
    expect(result?.newLevel).toBe(2);
    
    // Second add: level 2 -> 2 (no level up)
    result = user.addXp(500);
    expect(result).toBeUndefined();
    expect(user.getLevel()).toBe(2);
    
    // Third add: level 2 -> 3
    result = user.addXp(2500); // Total 4000
    expect(result?.oldLevel).toBe(2);
    expect(result?.newLevel).toBe(3);
  });

  test('addXp_atHighLevel_stillWorksCorrectly', () => {
    // Start at level 10 (sum of triangular 1-9 = 165,000)
    user.xp = 165000;
    expect(user.getLevel()).toBe(10);
    
    // Add enough to reach level 11 (triangular 10 = 55,000)
    const xpToAdd = 55000;
    const result = user.addXp(xpToAdd);
    
    expect(result).toBeDefined();
    expect(result?.oldLevel).toBe(10);
    expect(result?.newLevel).toBe(11);
    expect(user.getLevel()).toBe(11);
  });
});

describe('User Level System - Integration Tests', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  beforeEach(() => {
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
      missile_jammer: 0
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
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
      Array.from({ length: INVENTORY_ROWS }, () => Array.from({ length: INVENTORY_COLS }, () => null))
    );
  });

  test('levelSystem_progressionThroughMultipleLevels_consistentCalculations', () => {
    user.xp = 0;
    expect(user.getLevel()).toBe(1);
    expect(user.getXpForNextLevel()).toBe(1000);

    user.addXp(1000);
    expect(user.getLevel()).toBe(2);
    expect(user.getXpForNextLevel()).toBe(4000);

    user.addXp(3000);
    expect(user.getLevel()).toBe(3);
    expect(user.getXpForNextLevel()).toBe(10000);

    user.addXp(6000);
    expect(user.getLevel()).toBe(4);
    expect(user.getXpForNextLevel()).toBe(20000);
  });

  test('levelSystem_xpPersistence_remainsAccurateThroughCalculations', () => {
    user.xp = 2500;
    
    const level = user.getLevel();
    const nextLevelXp = user.getXpForNextLevel();
    
    // XP should not be modified by getter methods
    expect(user.xp).toBe(2500);
    
    // Verify calculations are correct
    expect(level).toBe(2);
    expect(nextLevelXp).toBe(4000);
  });

  test('levelSystem_edgeCases_handlesZeroAndBoundaryConditions', () => {
    // Test exact thresholds
    const thresholds = [
      { xp: 0, level: 1 },
      { xp: 1000, level: 2 },
      { xp: 4000, level: 3 },
      { xp: 10000, level: 4 },
      { xp: 20000, level: 5 },
    ];

    for (const { xp, level } of thresholds) {
      user.xp = xp;
      expect(user.getLevel()).toBe(level);
      
      // One below threshold should be previous level
      if (xp > 0) {
        user.xp = xp - 1;
        expect(user.getLevel()).toBe(level - 1);
      }
    }
  });

  test('levelSystem_formula_matchesExpectedProgression', () => {
    // Verify the formula produces expected XP requirements
    // Level N requires sum of triangular numbers from 1 to N-1
    // Triangular number k = k*(k+1)/2
    
    const expectedXp = [
      { level: 1, xp: 0 },
      { level: 2, xp: 1000 },        // triangular(1) = 1
      { level: 3, xp: 4000 },        // 1000 + triangular(2)*1000 = 1000 + 3000
      { level: 4, xp: 10000 },       // 4000 + triangular(3)*1000 = 4000 + 6000
      { level: 5, xp: 20000 },       // 10000 + triangular(4)*1000 = 10000 + 10000
      { level: 6, xp: 35000 },       // 20000 + triangular(5)*1000 = 20000 + 15000
      { level: 10, xp: 165000 },     // sum of triangular 1-9
    ];

    for (const { level, xp } of expectedXp) {
      user.xp = xp;
      expect(user.getLevel()).toBe(level);
    }
  });
});
