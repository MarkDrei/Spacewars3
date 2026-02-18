import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { INVENTORY_ROWS, INVENTORY_COLS, InventoryItem } from '@/shared/src/types/inventory';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { ResearchType, triggerResearch, createInitialTechTree } from '@/lib/server/techs/techtree';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';

describe('User.updateStats with time multiplier', () => {
  let user: User;
  let timeMultiplier: TimeMultiplierService;
  const dummySave: SaveUserCallback = async () => { /* no-op for testing */ };

  beforeEach(() => {
    // Reset time multiplier before each test
    TimeMultiplierService.resetInstance();
    timeMultiplier = TimeMultiplierService.getInstance();

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

  afterEach(() => {
    // Clean up time multiplier after each test
    TimeMultiplierService.resetInstance();
  });

  describe('Iron production acceleration', () => {
    test('updateStats_withMultiplier10_awardsIronAt10xRate', () => {
      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // 5 seconds of real time should produce 50 seconds worth of iron
      user.updateStats(1005);

      // Base rate: 1 iron/sec, 5s real time * 10x = 50s game time = 50 iron
      expect(user.iron).toBeCloseTo(50, 5);
      expect(user.last_updated).toBe(1005); // Real timestamp updated
    });

    test('updateStats_withMultiplier1_behavesNormally', () => {
      // Default multiplier is 1
      expect(timeMultiplier.getMultiplier()).toBe(1);

      // 5 seconds should produce 5 iron
      user.updateStats(1005);

      expect(user.iron).toBeCloseTo(5, 5);
    });

    test('updateStats_multiplierExpired_usesNormalRate', () => {
      // Set multiplier with very short duration
      const now = Date.now();
      timeMultiplier.setMultiplier(10, 0.0001); // ~6ms duration

      // Wait for expiration
      const waitUntil = now + 100; // 100ms
      while (Date.now() < waitUntil) {
        // busy wait
      }

      // Multiplier should have expired
      expect(timeMultiplier.getMultiplier()).toBe(1);

      // Update stats - should use normal rate
      user.updateStats(1005);
      expect(user.iron).toBeCloseTo(5, 5);
    });

    test('updateStats_withMultiplier50_awardsIronAt50xRate', () => {
      // Set 50x multiplier
      timeMultiplier.setMultiplier(50, 5);

      // 2 seconds of real time = 100 seconds of game time
      user.updateStats(1002);

      // Base rate: 1 iron/sec, 2s real time * 50x = 100s game time = 100 iron
      expect(user.iron).toBeCloseTo(100, 5);
    });
  });

  describe('Research progression acceleration', () => {
    test('updateStats_withMultiplier10_progressesResearchAt10xRate', () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);
      timeMultiplier.setMultiplier(10, 5);

      // 1 second of real time = 10 seconds of game time
      user.updateStats(1001);

      // Research should be complete (10s game time >= 10s duration)
      expect(user.techTree.ironHarvesting).toBe(2); // upgraded
      expect(user.techTree.activeResearch).toBeUndefined();
    });

    test('updateStats_withMultiplier10_researchCompletesDuringInterval_splitsIronGainCorrectly', () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);
      timeMultiplier.setMultiplier(10, 5);

      // 1.5 seconds of real time = 15 seconds of game time
      // Research completes at 10s game time, then 5s at new rate (1.1/sec)
      user.updateStats(1001.5);

      // 10s at old rate (1/sec) + 5s at new rate (1.1/sec)
      const expectedIron = 10 + 5 * 1.1;
      expect(user.iron).toBeCloseTo(expectedIron, 5);
      expect(user.techTree.ironHarvesting).toBe(2); // upgraded
      expect(user.techTree.activeResearch).toBeUndefined();
    });

    test('updateStats_withMultiplier5_researchProgressesPartially', () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);
      timeMultiplier.setMultiplier(5, 5);

      // 1 second of real time = 5 seconds of game time
      user.updateStats(1001);

      // Research should still be in progress (5s < 10s duration)
      expect(user.techTree.ironHarvesting).toBe(1); // not upgraded yet
      expect(user.techTree.activeResearch).toBeDefined();
      expect(user.techTree.activeResearch?.remainingDuration).toBeCloseTo(5, 5);
    });

    test('updateStats_multiplierChangeDuringResearch_continuesWithNewRate', () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);

      // First update: 2s real time, no multiplier = 2s game time
      user.updateStats(1002);
      expect(user.techTree.activeResearch?.remainingDuration).toBeCloseTo(8, 5);

      // Activate 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // Second update: 1s real time * 10x = 10s game time (completes research)
      user.updateStats(1003);
      expect(user.techTree.ironHarvesting).toBe(2); // upgraded
      expect(user.techTree.activeResearch).toBeUndefined();
    });
  });

  describe('Defense regeneration acceleration', () => {
    test('updateDefenseValues_withMultiplier10_regeneratesAt10xRate', () => {
      // Damage defenses first
      user.hullCurrent = 100;
      user.armorCurrent = 100;
      user.shieldCurrent = 100;
      user.defenseLastRegen = 1000;

      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // Update defense values after 5 seconds real time
      user.updateDefenseValues(1005);

      // 5s real time * 10x = 50s game time = 50 points regenerated
      expect(user.hullCurrent).toBe(150);
      expect(user.armorCurrent).toBe(150);
      expect(user.shieldCurrent).toBe(150);
      expect(user.defenseLastRegen).toBe(1005); // Real timestamp updated
    });

    test('updateDefenseValues_withMultiplier1_regeneratesNormally', () => {
      // Damage defenses first
      user.hullCurrent = 100;
      user.armorCurrent = 100;
      user.shieldCurrent = 100;
      user.defenseLastRegen = 1000;

      // Default multiplier is 1
      expect(timeMultiplier.getMultiplier()).toBe(1);

      // Update after 5 seconds
      user.updateDefenseValues(1005);

      // 5s regeneration
      expect(user.hullCurrent).toBe(105);
      expect(user.armorCurrent).toBe(105);
      expect(user.shieldCurrent).toBe(105);
    });

    test('updateDefenseValues_withMultiplier10_capsAtMaximum', () => {
      // Damage defenses close to max
      // Max values: hull=750 (5*150), armor=1250 (5*250), shield=1250 (5*250)
      user.hullCurrent = 700;
      user.armorCurrent = 1200;
      user.shieldCurrent = 1200;
      user.defenseLastRegen = 1000;

      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // Update after 5 seconds real time = 50s game time
      user.updateDefenseValues(1005);

      // Should cap at max, not exceed
      expect(user.hullCurrent).toBe(750);
      expect(user.armorCurrent).toBe(1250);
      expect(user.shieldCurrent).toBe(1250);
    });

    test('updateDefenseValues_multiplierExpired_usesNormalRate', () => {
      // Damage defenses
      user.hullCurrent = 100;
      user.armorCurrent = 100;
      user.shieldCurrent = 100;
      user.defenseLastRegen = 1000;

      // Set multiplier with very short duration
      const now = Date.now();
      timeMultiplier.setMultiplier(10, 0.0001); // ~6ms

      // Wait for expiration
      const waitUntil = now + 100;
      while (Date.now() < waitUntil) {
        // busy wait
      }

      // Multiplier should have expired
      expect(timeMultiplier.getMultiplier()).toBe(1);

      // Update defenses - should use normal rate
      user.updateDefenseValues(1005);
      expect(user.hullCurrent).toBe(105);
      expect(user.armorCurrent).toBe(105);
      expect(user.shieldCurrent).toBe(105);
    });
  });

  describe('Integration: updateStats calls updateDefenseValues', () => {
    test('updateStats_withMultiplier10_updatesIronResearchAndDefenses', () => {
      // Damage defenses
      user.hullCurrent = 100;
      user.armorCurrent = 100;
      user.shieldCurrent = 100;

      // Start research
      triggerResearch(user.techTree, ResearchType.IronHarvesting);

      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // Update stats after 1.5s real time = 15s game time
      user.updateStats(1001.5);

      // Iron: 10s at 1/sec + 5s at 1.1/sec (research completes)
      const expectedIron = 10 + 5 * 1.1;
      expect(user.iron).toBeCloseTo(expectedIron, 5);

      // Research completed
      expect(user.techTree.ironHarvesting).toBe(2);

      // Defenses: 1.5s real time * 10x = 15 points regenerated
      expect(user.hullCurrent).toBe(115);
      expect(user.armorCurrent).toBe(115);
      expect(user.shieldCurrent).toBe(115);
    });
  });

  describe('Edge cases', () => {
    test('updateStats_zeroElapsedTime_noChanges', () => {
      timeMultiplier.setMultiplier(10, 5);

      // Same timestamp
      user.updateStats(1000);

      expect(user.iron).toBe(0);
      expect(user.last_updated).toBe(1000);
    });

    test('updateStats_negativeElapsedTime_noChanges', () => {
      timeMultiplier.setMultiplier(10, 5);

      // Timestamp in the past (shouldn't happen, but defensive check)
      user.updateStats(999);

      expect(user.iron).toBe(0);
      expect(user.last_updated).toBe(1000); // Unchanged
    });

    test('updateStats_withLargeMultiplier_handlesCorrectly', () => {
      // Set 100x multiplier
      timeMultiplier.setMultiplier(100, 5);

      // 1 second real time = 100 seconds game time
      user.updateStats(1001);

      // Base rate: 1 iron/sec * 100s = 100 iron
      expect(user.iron).toBeCloseTo(100, 5);
    });

    test('updateStats_ironCapacity_enforcedWithMultiplier', () => {
      // Start with high iron near capacity (max 5000 for default tech)
      user.iron = 4980;

      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // 5 seconds real time = 50 seconds game time = 50 iron
      user.updateStats(1005);

      // Should cap at 5000 (addIron enforces capacity)
      expect(user.iron).toBe(5000);
    });

    test('updateDefenseValues_withFractionalMultiplier_worksCorrectly', () => {
      // Edge case: multiplier of 1.5
      user.hullCurrent = 100;
      user.defenseLastRegen = 1000;

      timeMultiplier.setMultiplier(1.5, 5);

      // 10 seconds real time * 1.5 = 15s game time
      user.updateDefenseValues(1010);

      expect(user.hullCurrent).toBe(115);
    });
  });
});
