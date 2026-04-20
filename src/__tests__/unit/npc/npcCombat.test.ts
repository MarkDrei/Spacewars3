import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  generateNpcTechCounts,
  calculateNpcIronReward,
} from '@/lib/server/npc/npcCombat';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import type { TechCounts } from '@/lib/server/techs/TechFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_WEAPON_KEYS = TechFactory.getWeaponKeys() as (keyof TechCounts)[];
const DEFENSE_KEYS: (keyof TechCounts)[] = [
  'ship_hull',
  'kinetic_armor',
  'energy_shield',
  'missile_jammer',
];

function countNonZeroWeapons(tc: TechCounts): number {
  return ALL_WEAPON_KEYS.filter(k => tc[k] > 0).length;
}

// ---------------------------------------------------------------------------
// generateNpcTechCounts
// ---------------------------------------------------------------------------

describe('generateNpcTechCounts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('npcIndex0_generates1WeaponType', () => {
    // Run multiple times to account for randomness
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(0);
      expect(countNonZeroWeapons(tc)).toBe(1);
    }
  });

  it('npcIndex1_generates2WeaponTypes', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(1);
      expect(countNonZeroWeapons(tc)).toBe(2);
    }
  });

  it('npcIndex2_generates3WeaponTypes', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(2);
      expect(countNonZeroWeapons(tc)).toBe(3);
    }
  });

  it('npcIndex3_generates4WeaponTypes', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(3);
      expect(countNonZeroWeapons(tc)).toBe(4);
    }
  });

  it('npcIndex5_generates6WeaponTypes_capped', () => {
    // npcIndex 5 → min(6, 6) = 6 weapon types (all)
    const tc = generateNpcTechCounts(5);
    expect(countNonZeroWeapons(tc)).toBe(6);
  });

  it('npcIndex10_neverExceeds6Weapons', () => {
    const tc = generateNpcTechCounts(10);
    expect(countNonZeroWeapons(tc)).toBeLessThanOrEqual(6);
  });

  it('defenseValues_hullArmorShield_areInVarianceRange', () => {
    // variance = base * uniform(0.6, 1.7), base = 100
    // → range [60, 170]
    for (let i = 0; i < 50; i++) {
      const tc = generateNpcTechCounts(0);
      expect(tc.ship_hull).toBeGreaterThanOrEqual(60);
      expect(tc.ship_hull).toBeLessThanOrEqual(170);
      expect(tc.kinetic_armor).toBeGreaterThanOrEqual(60);
      expect(tc.kinetic_armor).toBeLessThanOrEqual(170);
      expect(tc.energy_shield).toBeGreaterThanOrEqual(60);
      expect(tc.energy_shield).toBeLessThanOrEqual(170);
    }
  });

  it('missileJammer_alwaysZero', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(i % 4);
      expect(tc.missile_jammer).toBe(0);
    }
  });

  it('selectedWeapons_areInVarianceRange', () => {
    // base = 100, variance = base * uniform(0.6, 1.7) → [60, 170]
    for (let i = 0; i < 50; i++) {
      const tc = generateNpcTechCounts(3); // 4 weapon types
      for (const key of ALL_WEAPON_KEYS) {
        if (tc[key] > 0) {
          expect(tc[key]).toBeGreaterThanOrEqual(60);
          expect(tc[key]).toBeLessThanOrEqual(170);
        }
      }
    }
  });

  it('unselectedWeapons_areZero', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(0); // only 1 weapon type
      const zeroWeapons = ALL_WEAPON_KEYS.filter(k => tc[k] === 0);
      expect(zeroWeapons.length).toBe(5); // 5 of 6 weapons should be 0
    }
  });

  it('deterministicRandom_sameValues_withMockedRandom', () => {
    // Mock Math.random to return a fixed value
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const tc = generateNpcTechCounts(0);

    // With Math.random() = 0.5: variance = 0.6 + 0.5 * 1.1 = 1.15
    // Defense: Math.round(100 * 1.15) = 115
    expect(tc.ship_hull).toBe(115);
    expect(tc.kinetic_armor).toBe(115);
    expect(tc.energy_shield).toBe(115);

    // One weapon should be 115, rest 0
    const nonZero = ALL_WEAPON_KEYS.filter(k => tc[k] > 0);
    expect(nonZero.length).toBe(1);
    expect(tc[nonZero[0]]).toBe(115);
  });

  it('allDefenseKeysPresent', () => {
    const tc = generateNpcTechCounts(0);
    for (const key of DEFENSE_KEYS) {
      expect(key in tc).toBe(true);
    }
  });

  it('allWeaponKeysPresent', () => {
    const tc = generateNpcTechCounts(0);
    for (const key of ALL_WEAPON_KEYS) {
      expect(key in tc).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateNpcIronReward
// ---------------------------------------------------------------------------

describe('calculateNpcIronReward', () => {
  it('level1_returns5000', () => {
    expect(calculateNpcIronReward(1)).toBe(5000);
  });

  it('level2_returns25000', () => {
    expect(calculateNpcIronReward(2)).toBe(25000);
  });

  it('level3_returns125000', () => {
    expect(calculateNpcIronReward(3)).toBe(125000);
  });

  it('level4_returns625000', () => {
    expect(calculateNpcIronReward(4)).toBe(625000);
  });

  it('level5_returns3125000', () => {
    expect(calculateNpcIronReward(5)).toBe(3125000);
  });

  it('formula_is5000Times5ToTheLevelMinus1', () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateNpcIronReward(level)).toBe(5000 * Math.pow(5, level - 1));
    }
  });
});
