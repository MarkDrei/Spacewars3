// ---
// Tests for Commander item class
// ---

import { describe, test, expect } from 'vitest';
import { Commander, CommanderStatBonus, COMMANDER_STAT_KEYS } from '@/lib/server/inventory/Commander';
import type { CommanderData } from '@/lib/server/inventory/Commander';

describe('Commander', () => {
  describe('withStats', () => {
    test('withStats_validSingleBonus_createsCommander', () => {
      const bonus: CommanderStatBonus = { stat: 'shipSpeed', value: 0.5 };
      const commander = Commander.withStats('Admiral Tarq', [bonus]);

      expect(commander.name).toBe('Admiral Tarq');
      expect(commander.statBonuses).toHaveLength(1);
      expect(commander.statBonuses[0]).toEqual({ stat: 'shipSpeed', value: 0.5 });
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(17);
    });

    test('withStats_threeBonuses_createsCommander', () => {
      const bonuses: CommanderStatBonus[] = [
        { stat: 'shipSpeed', value: 0.1 },
        { stat: 'energyWeaponDamage', value: 1.0 },
        { stat: 'projectileWeaponAccuracy', value: 0.3 },
      ];
      const commander = Commander.withStats('Commander X', bonuses);

      expect(commander.statBonuses).toHaveLength(3);
    });

    test('withStats_zeroBonuses_throwsError', () => {
      expect(() => Commander.withStats('Empty', [])).toThrow();
    });

    test('withStats_fourBonuses_throwsError', () => {
      const bonuses: CommanderStatBonus[] = Array.from({ length: 4 }, (_, i) => ({
        stat: COMMANDER_STAT_KEYS[i],
        value: 0.5,
      }));
      expect(() => Commander.withStats('Too Many', bonuses)).toThrow();
    });

    test('withStats_valueTooLow_throwsError', () => {
      expect(() =>
        Commander.withStats('Bad', [{ stat: 'shipSpeed', value: 0.0 }])
      ).toThrow();
    });

    test('withStats_valueTooHigh_throwsError', () => {
      expect(() =>
        Commander.withStats('Bad', [{ stat: 'shipSpeed', value: 1.1 }])
      ).toThrow();
    });

    test('withStats_valueRoundedToOneDecimal', () => {
      const commander = Commander.withStats('Rounded', [{ stat: 'shipSpeed', value: 0.35 }]);
      // 0.35 rounds to 0.4 (nearest 0.1)
      expect(commander.statBonuses[0].value).toBe(0.4);
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(17);
    });

    test('withStats_extremeValues_accepted', () => {
      const commander = Commander.withStats('Extremes', [
        { stat: 'shipSpeed', value: 0.1 },
        { stat: 'energyWeaponDamage', value: 1.0 },
      ]);
      expect(commander.statBonuses[0].value).toBe(0.1);
      expect(commander.statBonuses[1].value).toBe(1.0);
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(17);
    });

    test('withStats_itemTypeIsCommander', () => {
      const commander = Commander.withStats('Test', [{ stat: 'shipSpeed', value: 0.5 }]);
      expect(commander.itemType).toBe('commander');
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(17);
    });
  });

  describe('random', () => {
    test('random_defaultName_generatesCompositeName_withParity', () => {
      const commander = Commander.random();
      const parts = commander.name.split(' ');
      expect(parts.length).toBe(3);
      expect(commander.name).not.toBe('Commander');

      // choose expected parity based on whether the first name is in the male
      // or female list.  Replicate the same name lists here for verification.
      const maleFirst = [
        'Astra', 'Orion', 'Cassius', 'Zane', 'Lucian',
        'Talon', 'Rhett', 'Dax', 'Jace', 'Kael',
        'Kade', 'Rian', 'Soren', 'Thane', 'Vance',
        'Wade', 'Xander', 'Yuri', 'Zeke', 'Zen',
      ];
      const femaleFirst = [
        'Nova', 'Lyra', 'Zara', 'Kira', 'June',
        'Eos', 'Vega', 'Rhea', 'Luna', 'Iris',
        'Mira', 'Seren', 'Faye', 'Nyx', 'Aura',
        'Sierra', 'Lola', 'Fox', 'Maya', 'Xena',
      ];
      const first = parts[0];
      if (maleFirst.includes(first)) {
        expect(commander.imageId % 2).toBe(0);
      } else if (femaleFirst.includes(first)) {
        expect(commander.imageId % 2).toBe(1);
      } else {
        // some unexpected name? fail so we can update lists
        throw new Error(`Unknown first name generated: ${first}`);
      }
    });

    test('random_customName_usesProvidedName', () => {
      const commander = Commander.random('Captain Nova');
      expect(commander.name).toBe('Captain Nova');
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(17);
    });

    test('random_bonusCountIsOneToThree', () => {
      for (let i = 0; i < 50; i++) {
        const commander = Commander.random();
        expect(commander.statBonuses.length).toBeGreaterThanOrEqual(1);
        expect(commander.statBonuses.length).toBeLessThanOrEqual(3);
      }
    });

    test('random_bonusValuesAreValidSteps', () => {
      for (let i = 0; i < 50; i++) {
        const commander = Commander.random();
        for (const bonus of commander.statBonuses) {
          expect(bonus.value).toBeGreaterThanOrEqual(0.1);
          expect(bonus.value).toBeLessThanOrEqual(1.0);
          // Must be a multiple of 0.1
          expect(Math.round(bonus.value * 10) % 1).toBe(0);
        }
      }
    });

    test('random_statsAreDistinct', () => {
      for (let i = 0; i < 50; i++) {
        const commander = Commander.random();
        const statKeys = commander.statBonuses.map(b => b.stat);
        const unique = new Set(statKeys);
        expect(unique.size).toBe(statKeys.length);
      }
    });

    test('random_deterministicWithSeededRng_oneStat', () => {
      // rng always returns 0.0 → gender = male, name = "Astra A. Stark", imageId=0 (even)
      const rng = () => 0.0;
      const commander = Commander.random(undefined, rng);
      expect(commander.statBonuses).toHaveLength(1);
      expect(commander.statBonuses[0].stat).toBe(COMMANDER_STAT_KEYS[0]);
      expect(commander.statBonuses[0].value).toBe(0.1);
      expect(commander.name).toMatch(/^Astra A\. Stark$/);
      expect(commander.imageId % 2).toBe(0);
    });

    test('random_deterministicWithSeededRng_twoStats', () => {
      // First call (stat count): 0.85 → 2 stats (0.6 <= 0.85 < 0.9)
      // the very first RNG call is for gender; in this sequence the next value
      // is 0.0 so gender=male and the resulting imageId should be even.
      const values = [0.85, 0.0, 0.49, 0.0, 0.49];
      let idx = 0;
      const rng = () => values[idx++] ?? 0.0;
      const commander = Commander.random(undefined, rng);
      expect(commander.statBonuses).toHaveLength(2);
      expect(commander.name.split(' ').length).toBe(3);
      expect(commander.imageId % 2).toBe(0);
    });

    test('random_deterministicWithSeededRng_threeStats', () => {
      // First call: 0.95 → 3 stats. Next value 0.0 for gender -> male
      const values = [0.95, 0.0, 0.49, 0.0, 0.49, 0.0, 0.49];
      let idx = 0;
      const rng = () => values[idx++] ?? 0.0;
      const commander = Commander.random(undefined, rng);
      expect(commander.statBonuses).toHaveLength(3);
      expect(commander.imageId % 2).toBe(0);
    });

    test('random_statDistribution_approximatelyCorrect', () => {
      const counts = { 1: 0, 2: 0, 3: 0 };
      // also verify imageId range quickly while looping
      const iterations = 3000;
      for (let i = 0; i < iterations; i++) {
        const commander = Commander.random();
        const n = commander.statBonuses.length as 1 | 2 | 3;
        counts[n]++;
        expect(commander.imageId).toBeGreaterThanOrEqual(0);
        expect(commander.imageId).toBeLessThanOrEqual(17);
      }
      // 60% ± 5% for 1 stat
      expect(counts[1] / iterations).toBeGreaterThan(0.55);
      expect(counts[1] / iterations).toBeLessThan(0.65);
      // 30% ± 5% for 2 stats
      expect(counts[2] / iterations).toBeGreaterThan(0.25);
      expect(counts[2] / iterations).toBeLessThan(0.35);
      // 10% ± 4% for 3 stats
      expect(counts[3] / iterations).toBeGreaterThan(0.06);
      expect(counts[3] / iterations).toBeLessThan(0.14);
    });
  });

  describe('toJSON / fromJSON', () => {
    test('toJSON_roundTrip_preservesAllFields', () => {
      const original = Commander.withStats('Admiral', [
        { stat: 'projectileWeaponDamage', value: 0.7 },
        { stat: 'energyWeaponReloadRate', value: 0.2 },
      ], 5);
      const json = original.toJSON();
      const restored = Commander.fromJSON(json);

      expect(restored.name).toBe(original.name);
      expect(restored.itemType).toBe('commander');
      expect(restored.statBonuses).toEqual(original.statBonuses);
      expect(restored.imageId).toBe(5);
    });

    test('fromJSON_wrongItemType_throwsError', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => Commander.fromJSON({ itemType: 'weapon' as any, name: 'X', imageId: 0, statBonuses: [] })).toThrow();
    });

    test('fromJSON_missingImageId_assignsDefault', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { itemType: 'commander', name: 'NoPic', statBonuses: [{ stat: 'shipSpeed', value: 0.5 }] };
      const cmd = Commander.fromJSON(data);
      expect(cmd.imageId).toBeGreaterThanOrEqual(0);
      expect(cmd.imageId).toBeLessThanOrEqual(17);
    });
  });

  describe('calculateBonuses', () => {
    function makeCommanderData(statBonuses: CommanderStatBonus[]): CommanderData {
      return { itemType: 'commander', name: 'Test', imageId: 0, statBonuses };
    }

    test('calculateBonuses_noCommanders_returnsEmptyObject', () => {
      const result = Commander.calculateBonuses([]);
      expect(result).toEqual({});
    });

    test('calculateBonuses_singleCommanderSingleStat_returnsCorrectBonus', () => {
      const commander = makeCommanderData([{ stat: 'shipSpeed', value: 10 }]);
      const result = Commander.calculateBonuses([commander]);
      expect(result.shipSpeed).toBeCloseTo(10, 10);
    });

    test('calculateBonuses_twoCommandersSameStat_stacksMultiplicatively', () => {
      // (1 + 10/100) * (1 + 10/100) - 1 = 0.21, so 21%
      const c1 = makeCommanderData([{ stat: 'shipSpeed', value: 10 }]);
      const c2 = makeCommanderData([{ stat: 'shipSpeed', value: 10 }]);
      const result = Commander.calculateBonuses([c1, c2]);
      expect(result.shipSpeed).toBeCloseTo(21, 10);
    });

    test('calculateBonuses_twoCommandersDifferentStats_returnsIndependentBonuses', () => {
      const c1 = makeCommanderData([{ stat: 'shipSpeed', value: 0.5 }]);
      const c2 = makeCommanderData([{ stat: 'energyWeaponDamage', value: 0.3 }]);
      const result = Commander.calculateBonuses([c1, c2]);
      expect(result.shipSpeed).toBeCloseTo(0.5, 10);
      expect(result.energyWeaponDamage).toBeCloseTo(0.3, 10);
      expect(result.projectileWeaponDamage).toBeUndefined();
    });

    test('calculateBonuses_commanderWithMultipleStats_allStatsIncluded', () => {
      const commander = makeCommanderData([
        { stat: 'shipSpeed', value: 0.5 },
        { stat: 'projectileWeaponDamage', value: 0.2 },
      ]);
      const result = Commander.calculateBonuses([commander]);
      expect(result.shipSpeed).toBeCloseTo(0.5, 10);
      expect(result.projectileWeaponDamage).toBeCloseTo(0.2, 10);
    });

    test('calculateBonuses_zeroBonusNotIncluded', () => {
      // value=0 means no bonus; we don't pass it to withStats (not valid), but test directly
      const commander = makeCommanderData([{ stat: 'shipSpeed', value: 0 }]);
      const result = Commander.calculateBonuses([commander]);
      expect(result.shipSpeed).toBeUndefined();
    });
  });
});
