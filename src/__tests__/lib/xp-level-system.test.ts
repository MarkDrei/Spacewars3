// ---
// Tests for XP and Level system
// ---

import { describe, it, expect } from 'vitest';
import { calculateLevelFromXP, calculateXPForLevel } from '../../lib/server/user/user';

describe('XP and Level System', () => {
  describe('calculateLevelFromXP', () => {
    it('calculateLevelFromXP_zeroXP_returnsLevel1', () => {
      expect(calculateLevelFromXP(0)).toBe(1);
    });

    it('calculateLevelFromXP_negativeXP_returnsLevel1', () => {
      expect(calculateLevelFromXP(-100)).toBe(1);
    });

    it('calculateLevelFromXP_50XP_returnsLevel2', () => {
      expect(calculateLevelFromXP(50)).toBe(2);
    });

    it('calculateLevelFromXP_100XP_returnsLevel2', () => {
      expect(calculateLevelFromXP(100)).toBe(2);
    });

    it('calculateLevelFromXP_200XP_returnsLevel3', () => {
      expect(calculateLevelFromXP(200)).toBe(3);
    });

    it('calculateLevelFromXP_450XP_returnsLevel4', () => {
      expect(calculateLevelFromXP(450)).toBe(4);
    });

    it('calculateLevelFromXP_800XP_returnsLevel5', () => {
      expect(calculateLevelFromXP(800)).toBe(5);
    });

    it('calculateLevelFromXP_5000XP_returnsLevel11', () => {
      expect(calculateLevelFromXP(5000)).toBe(11);
    });
  });

  describe('calculateXPForLevel', () => {
    it('calculateXPForLevel_level1_returns0', () => {
      expect(calculateXPForLevel(1)).toBe(0);
    });

    it('calculateXPForLevel_level2_returns50', () => {
      expect(calculateXPForLevel(2)).toBe(50);
    });

    it('calculateXPForLevel_level3_returns200', () => {
      expect(calculateXPForLevel(3)).toBe(200);
    });

    it('calculateXPForLevel_level4_returns450', () => {
      expect(calculateXPForLevel(4)).toBe(450);
    });

    it('calculateXPForLevel_level5_returns800', () => {
      expect(calculateXPForLevel(5)).toBe(800);
    });

    it('calculateXPForLevel_level10_returns4050', () => {
      expect(calculateXPForLevel(10)).toBe(4050);
    });
  });

  describe('Level/XP Relationship', () => {
    it('calculateLevelFromXP_roundtrip_matchesOriginalLevel', () => {
      for (let level = 1; level <= 20; level++) {
        const xp = calculateXPForLevel(level);
        const calculatedLevel = calculateLevelFromXP(xp);
        expect(calculatedLevel).toBe(level);
      }
    });

    it('calculateLevelFromXP_midpointXP_staysAtCurrentLevel', () => {
      // XP halfway between level 3 and 4 should still be level 3
      const level3XP = calculateXPForLevel(3);
      const level4XP = calculateXPForLevel(4);
      const midpointXP = (level3XP + level4XP) / 2;
      expect(calculateLevelFromXP(midpointXP)).toBe(3);
    });
  });
});
