// ---
// Tests for XP and level calculation methods in User class
// ---

import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';

describe('XP and Level Calculation', () => {
  let mockUser: User;
  const mockTechTree = createInitialTechTree();
  const mockTechCounts: TechCounts = {
    pulse_laser: 0,
    auto_turret: 0,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: 0,
    kinetic_armor: 0,
    energy_shield: 0,
    missile_jammer: 0,
  };
  const mockSaveCallback = async () => {};

  beforeEach(() => {
    // Create a fresh user with 0 XP for each test
    mockUser = new User(
      1,
      'testuser',
      'hash',
      1000,
      0, // Start with 0 XP
      Date.now() / 1000,
      mockTechTree,
      mockSaveCallback,
      mockTechCounts,
      100,
      100,
      100,
      Date.now() / 1000,
      false,
      null,
      [],
      null,
    );
  });

  describe('getLevel()', () => {
    it('getLevel_zeroXp_returnsLevel1', () => {
      mockUser.xp = 0;
      expect(mockUser.getLevel()).toBe(1);
    });

    it('getLevel_999Xp_returnsLevel1', () => {
      mockUser.xp = 999;
      expect(mockUser.getLevel()).toBe(1);
    });

    it('getLevel_1000Xp_returnsLevel2', () => {
      mockUser.xp = 1000;
      expect(mockUser.getLevel()).toBe(2);
    });

    it('getLevel_3999Xp_returnsLevel2', () => {
      mockUser.xp = 3999;
      expect(mockUser.getLevel()).toBe(2);
    });

    it('getLevel_4000Xp_returnsLevel3', () => {
      mockUser.xp = 4000;
      expect(mockUser.getLevel()).toBe(3);
    });

    it('getLevel_9999Xp_returnsLevel4', () => {
      mockUser.xp = 9999;
      expect(mockUser.getLevel()).toBe(4);
    });

    it('getLevel_10000Xp_returnsLevel4', () => {
      mockUser.xp = 10000;
      expect(mockUser.getLevel()).toBe(4);
    });

    it('getLevel_21000Xp_returnsLevel7', () => {
      // Level 7 = 0+1000+2000+3000+4000+5000+6000 = 21000 XP
      mockUser.xp = 21000;
      expect(mockUser.getLevel()).toBe(7);
    });

    it('getLevel_20999Xp_returnsLevel6', () => {
      // Just below level 7 threshold
      mockUser.xp = 20999;
      expect(mockUser.getLevel()).toBe(6);
    });

    it('getLevel_veryHighXp_calculatesCorrectly', () => {
      // Level 10 = sum from 1 to 9 of (i × 1000) = 45000 XP
      mockUser.xp = 45000;
      expect(mockUser.getLevel()).toBe(10);
    });
  });

  describe('getXpForNextLevel()', () => {
    it('getXpForNextLevel_level1_returns1000', () => {
      mockUser.xp = 0;
      expect(mockUser.getXpForNextLevel()).toBe(1000);
    });

    it('getXpForNextLevel_level1High_returns1000', () => {
      mockUser.xp = 999;
      expect(mockUser.getXpForNextLevel()).toBe(1000);
    });

    it('getXpForNextLevel_level2_returns3000', () => {
      // Level 3 = 1000 + 2000 = 3000 total XP
      mockUser.xp = 1000;
      expect(mockUser.getXpForNextLevel()).toBe(3000);
    });

    it('getXpForNextLevel_level3_returns6000', () => {
      // Level 4 = 1000 + 2000 + 3000 = 6000 total XP
      mockUser.xp = 3000;
      expect(mockUser.getXpForNextLevel()).toBe(6000);
    });

    it('getXpForNextLevel_level4_returns10000', () => {
      // Level 5 = 1000+2000+3000+4000 = 10000 total XP
      mockUser.xp = 6000; // Level 4
      expect(mockUser.getXpForNextLevel()).toBe(10000);
    });

    it('getXpForNextLevel_consistentWithGetLevel', () => {
      // Test that the threshold returned by getXpForNextLevel matches getLevel behavior
      mockUser.xp = 1000;
      const nextLevelXp = mockUser.getXpForNextLevel();
      expect(nextLevelXp).toBe(3000);
      
      mockUser.xp = nextLevelXp - 1;
      expect(mockUser.getLevel()).toBe(2);
      
      mockUser.xp = nextLevelXp;
      expect(mockUser.getLevel()).toBe(3);
    });
  });

  describe('addXp()', () => {
    it('addXp_positiveAmount_addsXp', () => {
      mockUser.xp = 0;
      const result = mockUser.addXp(500);
      expect(mockUser.xp).toBe(500);
      expect(result).toBeUndefined(); // No level up
    });

    it('addXp_zeroAmount_returnsUndefined', () => {
      mockUser.xp = 0;
      const result = mockUser.addXp(0);
      expect(mockUser.xp).toBe(0);
      expect(result).toBeUndefined();
    });

    it('addXp_negativeAmount_returnsUndefined', () => {
      mockUser.xp = 1000;
      const result = mockUser.addXp(-500);
      expect(mockUser.xp).toBe(1000); // Unchanged
      expect(result).toBeUndefined();
    });

    it('addXp_causesLevelUp_returnsLevelUpInfo', () => {
      mockUser.xp = 500;
      const result = mockUser.addXp(600); // Total 1100, level up to 2
      expect(mockUser.xp).toBe(1100);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 2,
      });
    });

    it('addXp_multipleLevelUps_returnsCorrectInfo', () => {
      mockUser.xp = 500;
      const result = mockUser.addXp(10000); // Total 10500, should reach level 5
      expect(mockUser.xp).toBe(10500);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 5,
      });
    });

    it('addXp_exactlyNextLevel_levelsUp', () => {
      mockUser.xp = 999;
      const result = mockUser.addXp(1); // Exactly 1000
      expect(mockUser.xp).toBe(1000);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 2,
      });
    });

    it('addXp_justBelowNextLevel_noLevelUp', () => {
      mockUser.xp = 998;
      const result = mockUser.addXp(1); // 999, still level 1
      expect(mockUser.xp).toBe(999);
      expect(result).toBeUndefined();
    });

    it('addXp_multipleCalls_accumulatesXp', () => {
      mockUser.xp = 0;
      mockUser.addXp(300);
      mockUser.addXp(400);
      mockUser.addXp(500);
      expect(mockUser.xp).toBe(1200);
      expect(mockUser.getLevel()).toBe(2);
    });
  });
});
