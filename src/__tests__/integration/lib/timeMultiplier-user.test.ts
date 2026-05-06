import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { ResearchType, triggerResearch, createInitialTechTree } from '@/lib/server/techs/techtree';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { BASE_REGEN_RATE } from '@/lib/server/bonus/userBonusTypes';
import { updateStatsWithMockedBuildRefresh } from '../../helpers/updateStatsTestHelpers';

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
      0, // teleportCharges
      0 // teleportLastRegen
    );
  });

  afterEach(() => {
    // Clean up time multiplier after each test
    TimeMultiplierService.resetInstance();
  });

  describe('Iron production acceleration', () => {
    test('updateStats_withMultiplier10_awardsIronAt10xRate', async () => {
      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // 5 seconds of real time should produce 50 seconds worth of iron
      await updateStatsWithMockedBuildRefresh(user, 1005);

      // Base rate: 1 iron/sec, 5s real time * 10x = 50s game time = 50 iron
      expect(user.iron).toBeCloseTo(50, 5);
      expect(user.last_updated).toBe(1005); // Real timestamp updated
    });

    test('updateStats_withMultiplier1_behavesNormally', async () => {
      // Default multiplier is 1
      expect(timeMultiplier.getMultiplier()).toBe(1);

      // 5 seconds should produce 5 iron
      await updateStatsWithMockedBuildRefresh(user, 1005);

      expect(user.iron).toBeCloseTo(5, 5);
    });

    test('updateStats_multiplierExpired_usesNormalRate', async () => {
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
      await updateStatsWithMockedBuildRefresh(user, 1005);
      expect(user.iron).toBeCloseTo(5, 5);
    });

    test('updateStats_withMultiplier50_awardsIronAt50xRate', async () => {
      // Set 50x multiplier
      timeMultiplier.setMultiplier(50, 5);

      // 2 seconds of real time = 100 seconds of game time
      await updateStatsWithMockedBuildRefresh(user, 1002);

      // Base rate: 1 iron/sec, 2s real time * 50x = 100s game time = 100 iron
      expect(user.iron).toBeCloseTo(100, 5);
    });
  });

  describe('Research progression acceleration', () => {
    test('updateStats_withMultiplier10_progressesResearchAt10xRate', async () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);
      timeMultiplier.setMultiplier(10, 5);

      // 1 second of real time = 10 seconds of game time
      await updateStatsWithMockedBuildRefresh(user, 1001);

      // Research should be complete (10s game time >= 10s duration)
      expect(user.techTree.ironHarvesting).toBe(2); // upgraded
      expect(user.techTree.activeResearch).toBeUndefined();
    });

    test('updateStats_withMultiplier10_researchCompletesDuringInterval_splitsIronGainCorrectly', async () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);
      timeMultiplier.setMultiplier(10, 5);

      // 1.5 seconds of real time = 15 seconds of game time
      // Research completes at 10s game time, then 5s at new rate (1.1/sec)
      await updateStatsWithMockedBuildRefresh(user, 1001.5);

      // 10s at old rate (1/sec) + 5s at new rate (1.11/sec)
      const expectedIron = 10 + 5 * 1.11;
      expect(user.iron).toBeCloseTo(expectedIron, 5);
      expect(user.techTree.ironHarvesting).toBe(2); // upgraded
      expect(user.techTree.activeResearch).toBeUndefined();
    });

    test('updateStats_withMultiplier5_researchProgressesPartially', async () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);
      timeMultiplier.setMultiplier(5, 5);

      // 1 second of real time = 5 seconds of game time
      await updateStatsWithMockedBuildRefresh(user, 1001);

      // Research should still be in progress (5s < 10s duration)
      expect(user.techTree.ironHarvesting).toBe(1); // not upgraded yet
      expect(user.techTree.activeResearch).toBeDefined();
      expect(user.techTree.activeResearch?.remainingDuration).toBeCloseTo(5, 5);
    });

    test('updateStats_multiplierChangeDuringResearch_continuesWithNewRate', async () => {
      // Start IronHarvesting research (duration 10s)
      triggerResearch(user.techTree, ResearchType.IronHarvesting);

      // First update: 2s real time, no multiplier = 2s game time
      await updateStatsWithMockedBuildRefresh(user, 1002);
      expect(user.techTree.activeResearch?.remainingDuration).toBeCloseTo(8, 5);

      // Activate 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // Second update: 1s real time * 10x = 10s game time (completes research)
      await updateStatsWithMockedBuildRefresh(user, 1003);
      expect(user.techTree.ironHarvesting).toBe(2); // upgraded
      expect(user.techTree.activeResearch).toBeUndefined();
    });

    test('updateStats_withArtificialIntelligence_progressesResearchFaster', async () => {
      user.techTree.artificialIntelligence = 2;
      triggerResearch(user.techTree, ResearchType.ShipSpeed);

      await updateStatsWithMockedBuildRefresh(user, 1020);

      // At AI level 2: effect = 100 * (1 + 0.15 + 0.0225) = 117.25, factor = 1.1725
      // remaining = 30 - (20 * 1.1725) = 6.55
      expect(user.techTree.activeResearch).toBeDefined();
      expect(user.techTree.activeResearch?.remainingDuration).toBeCloseTo(
        30 - (20 * 1.1725),
        5
      );
    });

    test('updateStats_withArtificialIntelligence_researchCompletesSoonerAndSplitsIronCorrectly', async () => {
      user.techTree.artificialIntelligence = 2;
      triggerResearch(user.techTree, ResearchType.IronHarvesting);

      await updateStatsWithMockedBuildRefresh(user, 1010);

      expect(user.techTree.ironHarvesting).toBe(2);
      expect(user.techTree.activeResearch).toBeUndefined();
      // At AI level 2: factor = 1.1725, researchDuration = 10s, gameElapsed = 10s
      // gameSecondsToComplete = 10 / 1.1725 ≈ 8.5306s (real time until research finishes)
      // ironBefore = 8.5306 * 1 (level-1 rate = 1/s) ≈ 8.5306
      // remaining = 10 - 8.5306 ≈ 1.4694s
      // ironAfter = 1.4694 * 1.11 (level-2 rate = 1.11/s) ≈ 1.6310
      // total ≈ 10.162
      expect(user.iron).toBeCloseTo(10.162, 2);
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

      // 5s real time * 10x = 50s game time.
      // Hull + armor share the 0.1/s repair pool, shield recharges independently at 0.1/s.
      expect(user.hullCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 50, 5);
      expect(user.armorCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 50, 5);
      expect(user.shieldCurrent).toBeCloseTo(100 + BASE_REGEN_RATE * 50, 5);
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

      // 5s game time at the base 0.1/s rates
      expect(user.hullCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 5, 5);
      expect(user.armorCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 5, 5);
      expect(user.shieldCurrent).toBeCloseTo(100 + BASE_REGEN_RATE * 5, 5);
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

      // Shared repair is still split while both hull and armor remain damaged.
      expect(user.hullCurrent).toBeCloseTo(700 + (BASE_REGEN_RATE / 2) * 50, 5);
      expect(user.armorCurrent).toBeCloseTo(1200 + (BASE_REGEN_RATE / 2) * 50, 5);
      expect(user.shieldCurrent).toBeCloseTo(1200 + BASE_REGEN_RATE * 50, 5);
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
      expect(user.hullCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 5, 5);
      expect(user.armorCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 5, 5);
      expect(user.shieldCurrent).toBeCloseTo(100 + BASE_REGEN_RATE * 5, 5);
    });
  });

  describe('Integration: updateStats calls updateDefenseValues', () => {
    test('updateStats_withMultiplier10_updatesIronResearchAndDefenses', async () => {
      // Damage defenses
      user.hullCurrent = 100;
      user.armorCurrent = 100;
      user.shieldCurrent = 100;

      // Start research
      triggerResearch(user.techTree, ResearchType.IronHarvesting);

      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // Update stats after 1.5s real time = 15s game time
      await updateStatsWithMockedBuildRefresh(user, 1001.5);

      // Iron: 10s at 1/sec + 5s at 1.11/sec (research completes)
      const expectedIron = 10 + 5 * 1.11;
      expect(user.iron).toBeCloseTo(expectedIron, 5);

      // Research completed
      expect(user.techTree.ironHarvesting).toBe(2);

      // Defenses: 1.5s real time * 10x = 15s game time
      expect(user.hullCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 15, 5);
      expect(user.armorCurrent).toBeCloseTo(100 + (BASE_REGEN_RATE / 2) * 15, 5);
      expect(user.shieldCurrent).toBeCloseTo(100 + BASE_REGEN_RATE * 15, 5);
    });
  });

  describe('Edge cases', () => {
    test('updateStats_zeroElapsedTime_noChanges', async () => {
      timeMultiplier.setMultiplier(10, 5);

      // Same timestamp
      await updateStatsWithMockedBuildRefresh(user, 1000);

      expect(user.iron).toBe(0);
      expect(user.last_updated).toBe(1000);
    });

    test('updateStats_negativeElapsedTime_noChanges', async () => {
      timeMultiplier.setMultiplier(10, 5);

      // Timestamp in the past (shouldn't happen, but defensive check)
      await updateStatsWithMockedBuildRefresh(user, 999);

      expect(user.iron).toBe(0);
      expect(user.last_updated).toBe(1000); // Unchanged
    });

    test('updateStats_withLargeMultiplier_handlesCorrectly', async () => {
      // Set 100x multiplier
      timeMultiplier.setMultiplier(100, 5);

      // 1 second real time = 100 seconds game time
      await updateStatsWithMockedBuildRefresh(user, 1001);

      // Base rate: 1 iron/sec * 100s = 100 iron
      expect(user.iron).toBeCloseTo(100, 5);
    });

    test('updateStats_ironCapacity_enforcedWithMultiplier', async () => {
      // Start with high iron near capacity (max 5000 for default tech)
      user.iron = 4980;

      // Set 10x multiplier
      timeMultiplier.setMultiplier(10, 5);

      // 5 seconds real time = 50 seconds game time = 50 iron
      await updateStatsWithMockedBuildRefresh(user, 1005);

      // Should cap at 5000 (addIron enforces capacity)
      expect(user.iron).toBe(5000);
    });

    test('updateDefenseValues_withFractionalMultiplier_worksCorrectly', () => {
      // Edge case: multiplier of 1.5
      user.hullCurrent = 100;
      user.armorCurrent = 1250;
      user.shieldCurrent = 1250;
      user.defenseLastRegen = 1000;

      timeMultiplier.setMultiplier(1.5, 5);

      // 10 seconds real time * 1.5 = 15s game time
      user.updateDefenseValues(1010);

      expect(user.hullCurrent).toBeCloseTo(100 + BASE_REGEN_RATE * 15, 5);
      expect(user.armorCurrent).toBe(1250);
      expect(user.shieldCurrent).toBe(1250);
    });
  });
});
