import { describe, it, expect } from 'vitest';
import { calculateLevelFromXp, getShipNameColor, isAttackAllowed } from '@shared/utils/levelUtils';

describe('calculateLevelFromXp', () => {
  it('calculateLevelFromXp_zeroXp_returnsLevel1', () => {
    expect(calculateLevelFromXp(0)).toBe(1);
  });

  it('calculateLevelFromXp_justBelowLevel2Threshold_returnsLevel1', () => {
    expect(calculateLevelFromXp(999)).toBe(1);
  });

  it('calculateLevelFromXp_exactlyLevel2Threshold_returnsLevel2', () => {
    // Level 2 requires 1000 XP
    expect(calculateLevelFromXp(1000)).toBe(2);
  });

  it('calculateLevelFromXp_level3Threshold_returnsLevel3', () => {
    // Level 3 requires 1000 + 3000 = 4000 XP
    expect(calculateLevelFromXp(4000)).toBe(3);
  });

  it('calculateLevelFromXp_level4Threshold_returnsLevel4', () => {
    // Level 4 requires 1000 + 3000 + 6000 = 10000 XP
    expect(calculateLevelFromXp(10000)).toBe(4);
  });

  it('calculateLevelFromXp_justBelowLevel4_returnsLevel3', () => {
    expect(calculateLevelFromXp(9999)).toBe(3);
  });
});

describe('getShipNameColor', () => {
  it('getShipNameColor_sameLevel_returnsWhite', () => {
    expect(getShipNameColor(5, 5)).toBe('#ffffff');
  });

  it('getShipNameColor_differenceOf4Above_returnsGray', () => {
    expect(getShipNameColor(5, 9)).toBe('#808080');
  });

  it('getShipNameColor_differenceOf4Below_returnsGray', () => {
    expect(getShipNameColor(5, 1)).toBe('#808080');
  });

  it('getShipNameColor_differenceOf3Above_returnsRed', () => {
    const color = getShipNameColor(5, 8);
    expect(color).toBe('rgb(255,0,0)');
  });

  it('getShipNameColor_differenceOf3Below_returnsGreen', () => {
    const color = getShipNameColor(5, 2);
    expect(color).toBe('rgb(0,255,0)');
  });

  it('getShipNameColor_oneAbove_isReddishWhite', () => {
    const color = getShipNameColor(5, 6);
    // At diff=+1 (t=1/3), r=255, g=255-255*(1/3)≈170, b≈170
    const m = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    expect(m).not.toBeNull();
    const [r, g, b] = m!.slice(1).map(Number);
    expect(r).toBe(255);
    expect(g).toBeLessThan(255);
    expect(b).toBeLessThan(255);
  });

  it('getShipNameColor_oneBelow_isGreenishWhite', () => {
    const color = getShipNameColor(5, 4);
    // At diff=-1 (t=2/3), g=255, r=255*(2/3)≈170, b≈170
    const m = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    expect(m).not.toBeNull();
    const [r, g, b] = m!.slice(1).map(Number);
    expect(g).toBe(255);
    expect(r).toBeLessThan(255);
    expect(b).toBeLessThan(255);
  });
});

describe('isAttackAllowed', () => {
  it('isAttackAllowed_sameLevel_returnsTrue', () => {
    expect(isAttackAllowed(5, 5)).toBe(true);
  });

  it('isAttackAllowed_difference3_returnsTrue', () => {
    expect(isAttackAllowed(5, 8)).toBe(true);
    expect(isAttackAllowed(8, 5)).toBe(true);
  });

  it('isAttackAllowed_difference4_returnsFalse', () => {
    expect(isAttackAllowed(5, 9)).toBe(false);
    expect(isAttackAllowed(9, 5)).toBe(false);
  });

  it('isAttackAllowed_largeGap_returnsFalse', () => {
    expect(isAttackAllowed(1, 10)).toBe(false);
  });
});
