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
      const tc = generateNpcTechCounts(0, 1);
      expect(countNonZeroWeapons(tc)).toBe(1);
    }
  });

  it('npcIndex1_generates2WeaponTypes', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(1, 2);
      expect(countNonZeroWeapons(tc)).toBe(2);
    }
  });

  it('npcIndex2_generates3WeaponTypes', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(2, 3);
      expect(countNonZeroWeapons(tc)).toBe(3);
    }
  });

  it('npcIndex3_generates4WeaponTypes', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(3, 4);
      expect(countNonZeroWeapons(tc)).toBe(4);
    }
  });

  it('npcIndex5_generates6WeaponTypes_capped', () => {
    // npcIndex 5 → min(6, 6) = 6 weapon types (all)
    const tc = generateNpcTechCounts(5, 6);
    expect(countNonZeroWeapons(tc)).toBe(6);
  });

  it('npcIndex10_neverExceeds6Weapons', () => {
    const tc = generateNpcTechCounts(10, 11);
    expect(countNonZeroWeapons(tc)).toBeLessThanOrEqual(6);
  });

  it('defenseValues_scaleWithLevel', () => {
    // level 1: defenseBase = 10, variance = base * uniform(0.6, 1.7) → range [6, 17]
    for (let i = 0; i < 50; i++) {
      const tc = generateNpcTechCounts(0, 1);
      expect(tc.ship_hull).toBeGreaterThanOrEqual(6);
      expect(tc.ship_hull).toBeLessThanOrEqual(17);
      expect(tc.kinetic_armor).toBeGreaterThanOrEqual(6);
      expect(tc.kinetic_armor).toBeLessThanOrEqual(17);
      expect(tc.energy_shield).toBeGreaterThanOrEqual(6);
      expect(tc.energy_shield).toBeLessThanOrEqual(17);
    }
  });

  it('defenseValues_higherLevel_areHigher', () => {
    // level 4: defenseBase = 40, variance → range [24, 68]
    for (let i = 0; i < 50; i++) {
      const tc = generateNpcTechCounts(0, 4);
      expect(tc.ship_hull).toBeGreaterThanOrEqual(24);
      expect(tc.ship_hull).toBeLessThanOrEqual(68);
      expect(tc.kinetic_armor).toBeGreaterThanOrEqual(24);
      expect(tc.kinetic_armor).toBeLessThanOrEqual(68);
      expect(tc.energy_shield).toBeGreaterThanOrEqual(24);
      expect(tc.energy_shield).toBeLessThanOrEqual(68);
    }
  });

  it('missileJammer_alwaysZero', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(i % 4, (i % 4) + 1);
      expect(tc.missile_jammer).toBe(0);
    }
  });

  it('selectedWeapons_scaleWithLevel', () => {
    // level 1: weaponBase = 5, variance → [3, 9] (round(5*0.6)=3, round(5*1.7)=9)
    for (let i = 0; i < 50; i++) {
      const tc = generateNpcTechCounts(3, 1); // 4 weapon types, level 1
      for (const key of ALL_WEAPON_KEYS) {
        if (tc[key] > 0) {
          expect(tc[key]).toBeGreaterThanOrEqual(3);
          expect(tc[key]).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('selectedWeapons_higherLevel_areHigher', () => {
    // level 4: weaponBase = 20, variance → [12, 34]
    for (let i = 0; i < 50; i++) {
      const tc = generateNpcTechCounts(3, 4); // 4 weapon types, level 4
      for (const key of ALL_WEAPON_KEYS) {
        if (tc[key] > 0) {
          expect(tc[key]).toBeGreaterThanOrEqual(12);
          expect(tc[key]).toBeLessThanOrEqual(34);
        }
      }
    }
  });

  it('unselectedWeapons_areZero', () => {
    for (let i = 0; i < 20; i++) {
      const tc = generateNpcTechCounts(0, 1); // only 1 weapon type
      const zeroWeapons = ALL_WEAPON_KEYS.filter(k => tc[k] === 0);
      expect(zeroWeapons.length).toBe(5); // 5 of 6 weapons should be 0
    }
  });

  it('deterministicRandom_sameValues_withMockedRandom', () => {
    // Mock Math.random to return a fixed value
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const tc = generateNpcTechCounts(0, 2); // level 2

    // With Math.random() = 0.5: variance = 0.6 + 0.5 * 1.1 = 1.15
    // Defense: base=20 (10*2), Math.round(20 * 1.15) = 23
    expect(tc.ship_hull).toBe(23);
    expect(tc.kinetic_armor).toBe(23);
    expect(tc.energy_shield).toBe(23);

    // Weapon: base=10 (5*2), Math.round(10 * 1.15) = 12 (one weapon should be 12, rest 0)
    const nonZero = ALL_WEAPON_KEYS.filter(k => tc[k] > 0);
    expect(nonZero.length).toBe(1);
    expect(tc[nonZero[0]]).toBe(12);
  });

  it('defaultLevel_usesLevel1', () => {
    // When no level is passed, defaults to 1
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const tc = generateNpcTechCounts(0);

    // Defense: base=10 (10*1), Math.round(10 * 1.15) = 12 (round(11.5))
    expect(tc.ship_hull).toBe(12);
    expect(tc.kinetic_armor).toBe(12);
    expect(tc.energy_shield).toBe(12);
  });

  it('allDefenseKeysPresent', () => {
    const tc = generateNpcTechCounts(0, 1);
    for (const key of DEFENSE_KEYS) {
      expect(key in tc).toBe(true);
    }
  });

  it('allWeaponKeysPresent', () => {
    const tc = generateNpcTechCounts(0, 1);
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
