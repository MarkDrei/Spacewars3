// ---
// Tests for Commander item class
// ---

import { describe, test, expect } from 'vitest';
import { Commander, CommanderStatBonus, COMMANDER_STAT_KEYS } from '@/lib/server/inventory/Commander';

describe('Commander', () => {
  describe('withStats', () => {
    test('withStats_validSingleBonus_createsCommander', () => {
      const bonus: CommanderStatBonus = { stat: 'shipSpeed', value: 0.5 };
      const commander = Commander.withStats('Admiral Tarq', [bonus]);

      expect(commander.name).toBe('Admiral Tarq');
      expect(commander.statBonuses).toHaveLength(1);
      expect(commander.statBonuses[0]).toEqual({ stat: 'shipSpeed', value: 0.5 });
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(9);
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
      expect(commander.imageId).toBeLessThanOrEqual(9);
    });

    test('withStats_extremeValues_accepted', () => {
      const commander = Commander.withStats('Extremes', [
        { stat: 'shipSpeed', value: 0.1 },
        { stat: 'energyWeaponDamage', value: 1.0 },
      ]);
      expect(commander.statBonuses[0].value).toBe(0.1);
      expect(commander.statBonuses[1].value).toBe(1.0);
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(9);
    });

    test('withStats_itemTypeIsCommander', () => {
      const commander = Commander.withStats('Test', [{ stat: 'shipSpeed', value: 0.5 }]);
      expect(commander.itemType).toBe('commander');
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(9);
    });
  });

  describe('random', () => {
    test('random_defaultName_usesCommanderFallback', () => {
      const commander = Commander.random();
      expect(commander.name).toBe('Commander');
    });

    test('random_customName_usesProvidedName', () => {
      const commander = Commander.random('Captain Nova');
      expect(commander.name).toBe('Captain Nova');
      expect(commander.imageId).toBeGreaterThanOrEqual(0);
      expect(commander.imageId).toBeLessThanOrEqual(9);
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
      // rng always returns 0.0 → statCount = 1 (0.0 < 0.6), stat index 0, value step 1 → 0.1
      const rng = () => 0.0;
      const commander = Commander.random('Seeded', rng);
      expect(commander.statBonuses).toHaveLength(1);
      expect(commander.statBonuses[0].stat).toBe(COMMANDER_STAT_KEYS[0]);
      expect(commander.statBonuses[0].value).toBe(0.1);
    });

    test('random_deterministicWithSeededRng_twoStats', () => {
      // First call (stat count): 0.85 → 2 stats (0.6 <= 0.85 < 0.9)
      // Subsequent calls alternate between 0.0 (pick idx 0) and 0.5 (value mid-range)
      const values = [0.85, 0.0, 0.49, 0.0, 0.49];
      let idx = 0;
      const rng = () => values[idx++] ?? 0.0;
      const commander = Commander.random('TwoStat', rng);
      expect(commander.statBonuses).toHaveLength(2);
    });

    test('random_deterministicWithSeededRng_threeStats', () => {
      // First call: 0.95 → 3 stats
      const values = [0.95, 0.0, 0.49, 0.0, 0.49, 0.0, 0.49];
      let idx = 0;
      const rng = () => values[idx++] ?? 0.0;
      const commander = Commander.random('ThreeStat', rng);
      expect(commander.statBonuses).toHaveLength(3);
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
        expect(commander.imageId).toBeLessThanOrEqual(9);
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
      expect(cmd.imageId).toBeLessThanOrEqual(9);
    });
  });
});
