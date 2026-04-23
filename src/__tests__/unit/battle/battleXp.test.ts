import { describe, it, expect } from 'vitest';
import { calculateBattleXp } from '@/lib/server/battle/battleService';

describe('calculateBattleXp()', () => {
  it('calculateBattleXp_sameLevelAtLevel1_returns200', () => {
    const xp = calculateBattleXp(1, 1);
    expect(xp).toBe(200); // 1 * 200 = 200
  });

  it('calculateBattleXp_sameLevelAtLevel5_returns1000', () => {
    const xp = calculateBattleXp(5, 5);
    expect(xp).toBe(1000); // 5 * 200 = 1000
  });

  it('calculateBattleXp_sameLevelAtLevel10_returns2000', () => {
    const xp = calculateBattleXp(10, 10);
    expect(xp).toBe(2000); // 10 * 200 = 2000
  });

  it('calculateBattleXp_enemyHigherBy2_appliesMultiplier', () => {
    // Winner level 5, loser level 7 (levelDiff = 2)
    // baseXp = 7 * 200 = 1400
    // xp = 1400 * 1.3^2 = 1400 * 1.69 = 2366
    const xp = calculateBattleXp(5, 7);
    expect(xp).toBe(Math.floor(1400 * Math.pow(1.3, 2)));
  });

  it('calculateBattleXp_enemyHigherBy1_appliesMultiplier', () => {
    // Winner level 3, loser level 4 (levelDiff = 1)
    // baseXp = 4 * 200 = 800
    // xp = 800 * 1.3 = 1040
    const xp = calculateBattleXp(3, 4);
    expect(xp).toBe(Math.floor(800 * 1.3));
  });

  it('calculateBattleXp_enemyLowerBy3_appliesReduction', () => {
    // Winner level 5, loser level 2 (levelDiff = -3, abs = 3)
    // baseXp = 2 * 200 = 400
    // xp = 400 * 0.7^3 = 400 * 0.343 = 137.2
    const xp = calculateBattleXp(5, 2);
    expect(xp).toBe(Math.floor(400 * Math.pow(0.7, 3)));
  });

  it('calculateBattleXp_enemyLowerBy1_appliesReduction', () => {
    // Winner level 4, loser level 3 (levelDiff = -1)
    // baseXp = 3 * 200 = 600
    // xp = 600 * 0.7 = 420
    const xp = calculateBattleXp(4, 3);
    expect(xp).toBe(Math.floor(600 * 0.7));
  });

  it('calculateBattleXp_largeLevelDifference_handlesCorrectly', () => {
    // Winner level 1, loser level 10 (levelDiff = 9)
    // baseXp = 10 * 200 = 2000
    // xp = 2000 * 1.3^9 = 2000 * 10.604... = 21208
    const xp = calculateBattleXp(1, 10);
    expect(xp).toBe(Math.floor(2000 * Math.pow(1.3, 9)));
  });

  it('calculateBattleXp_returnsFlooredInteger', () => {
    // Any calculation should return an integer
    const xp = calculateBattleXp(3, 4);
    expect(Number.isInteger(xp)).toBe(true);
  });

  it('calculateBattleXp_levelDiffZero_returnsBaseXp', () => {
    // Exact same level - only base XP
    for (const level of [1, 3, 7, 10]) {
      const xp = calculateBattleXp(level, level);
      expect(xp).toBe(level * 200);
    }
  });

  it('calculateBattleXp_higherWinnerLevel_highBaseXp', () => {
    // Higher winner level = higher base XP
    const xpLevel1 = calculateBattleXp(1, 1);
    const xpLevel5 = calculateBattleXp(5, 5);
    const xpLevel10 = calculateBattleXp(10, 10);
    expect(xpLevel1).toBeLessThan(xpLevel5);
    expect(xpLevel5).toBeLessThan(xpLevel10);
  });
});
