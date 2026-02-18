// ---
// Unit tests for commander generation factory
// ---

import { describe, it, expect } from 'vitest';
import { generateCommander, tryGenerateCommanderFromEscapePod } from '../../lib/server/inventory/commanderFactory';
import { isValidCommander } from '../../shared/src/types/inventory';

describe('Commander Generation Factory', () => {
  describe('generateCommander', () => {
    it('generateCommander_always_returnsValidCommander', () => {
      const commander = generateCommander();

      // Verify UUID format (basic check)
      expect(commander.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      // Verify name is present
      expect(commander.name).toBeTruthy();
      expect(typeof commander.name).toBe('string');

      // Verify stats count (1-3)
      expect(commander.stats.length).toBeGreaterThanOrEqual(1);
      expect(commander.stats.length).toBeLessThanOrEqual(3);

      // Verify all stats have valid bonusPercent (10-100)
      for (const stat of commander.stats) {
        expect(stat.bonusPercent).toBeGreaterThanOrEqual(10);
        expect(stat.bonusPercent).toBeLessThanOrEqual(100);
        expect(Number.isInteger(stat.bonusPercent)).toBe(true);
      }

      // Verify no duplicate stat types
      const statTypes = commander.stats.map((s) => s.statType);
      const uniqueStatTypes = new Set(statTypes);
      expect(uniqueStatTypes.size).toBe(statTypes.length);

      // Verify passes validation function
      expect(isValidCommander(commander)).toBe(true);
    });

    it('generateCommander_multipleGenerations_producesDifferentCommanders', () => {
      const commanders = new Set<string>();
      
      // Generate 20 commanders, expect uniqueness
      for (let i = 0; i < 20; i++) {
        const commander = generateCommander();
        commanders.add(commander.id);
      }

      // Should have 20 unique IDs
      expect(commanders.size).toBe(20);
    });

    it('generateCommander_stats_noDuplicateStatTypes', () => {
      // Run multiple times to ensure no duplicates in any generation
      for (let i = 0; i < 50; i++) {
        const commander = generateCommander();
        const statTypes = commander.stats.map((s) => s.statType);
        const uniqueStatTypes = new Set(statTypes);
        expect(uniqueStatTypes.size).toBe(statTypes.length);
      }
    });

    it('generateCommander_statDistribution_matchesProbabilities', () => {
      const statCounts = { 1: 0, 2: 0, 3: 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const commander = generateCommander();
        const count = commander.stats.length as 1 | 2 | 3;
        statCounts[count]++;
      }

      // Expected: ~60% (600) with 1 stat, ~30% (300) with 2 stats, ~10% (100) with 3 stats
      // Allow ±10% tolerance (±100 for 1 stat, ±100 for 2 stats, ±100 for 3 stats)
      expect(statCounts[1]).toBeGreaterThan(500); // At least 50%
      expect(statCounts[1]).toBeLessThan(700); // At most 70%
      
      expect(statCounts[2]).toBeGreaterThan(200); // At least 20%
      expect(statCounts[2]).toBeLessThan(400); // At most 40%
      
      expect(statCounts[3]).toBeGreaterThan(0); // At least some with 3 stats
      expect(statCounts[3]).toBeLessThan(200); // At most 20%
    });

    it('generateCommander_bonusPercentRange_alwaysBetween10And100', () => {
      for (let i = 0; i < 100; i++) {
        const commander = generateCommander();
        for (const stat of commander.stats) {
          expect(stat.bonusPercent).toBeGreaterThanOrEqual(10);
          expect(stat.bonusPercent).toBeLessThanOrEqual(100);
        }
      }
    });

    it('generateCommander_allStatTypes_canBeGenerated', () => {
      const allStatTypes = new Set([
        'shipSpeed',
        'projectileDamage',
        'projectileReloadRate',
        'projectileAccuracy',
        'energyDamage',
        'energyReloadRate',
        'energyAccuracy',
      ]);
      const generatedStatTypes = new Set<string>();

      // Generate many commanders to hit all stat types
      for (let i = 0; i < 200; i++) {
        const commander = generateCommander();
        for (const stat of commander.stats) {
          generatedStatTypes.add(stat.statType);
        }
      }

      // All stat types should appear at least once
      expect(generatedStatTypes.size).toBe(allStatTypes.size);
      for (const statType of allStatTypes) {
        expect(generatedStatTypes.has(statType)).toBe(true);
      }
    });
  });

  describe('tryGenerateCommanderFromEscapePod', () => {
    it('tryGenerateCommanderFromEscapePod_over1000runs_approximately90percentYield', () => {
      let successCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const commander = tryGenerateCommanderFromEscapePod();
        if (commander !== null) {
          successCount++;
          // Verify it's a valid commander
          expect(isValidCommander(commander)).toBe(true);
        }
      }

      // Expected: ~900 commanders (90%)
      // Allow ±7% tolerance (±70): 830-970 range
      expect(successCount).toBeGreaterThan(830);
      expect(successCount).toBeLessThan(970);
    });

    it('tryGenerateCommanderFromEscapePod_success_returnsValidCommander', () => {
      // Run multiple times until we get a success
      let commander = null;
      let attempts = 0;
      while (commander === null && attempts < 100) {
        commander = tryGenerateCommanderFromEscapePod();
        attempts++;
      }

      // Should eventually get a commander (very high probability)
      expect(commander).not.toBeNull();
      if (commander) {
        expect(isValidCommander(commander)).toBe(true);
      }
    });

    it('tryGenerateCommanderFromEscapePod_failure_returnsNull', () => {
      // Test that null can be returned (hard to test probabilistically, but check type)
      let gotNull = false;
      
      // Try many times, should get at least one null
      for (let i = 0; i < 1000; i++) {
        const result = tryGenerateCommanderFromEscapePod();
        if (result === null) {
          gotNull = true;
          break;
        }
      }

      // With 1000 iterations, probability of never getting null is (0.9)^1000 ≈ 0 (essentially impossible)
      expect(gotNull).toBe(true);
    });
  });
});
