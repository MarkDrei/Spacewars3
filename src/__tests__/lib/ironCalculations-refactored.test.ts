import { describe, expect, test } from 'vitest';
import { calculatePredictedIron, shouldUpdateDisplay, type IronData } from '@/lib/client/hooks/useIron/ironCalculations';

describe('Iron Calculations', () => {
  describe('calculatePredictedIron', () => {
    test('calculatePredictedIron_zeroProduction_returnsServerAmount', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 0,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 5000
      };

      const result = calculatePredictedIron(data);

      expect(result).toBe(1000);
    });

    test('calculatePredictedIron_withProduction_calculatesCorrectly', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 2,
        lastUpdateTime: baseTime,
        maxCapacity: 5000
      };

      // 3 seconds later, should be 1000 + (3 * 2) = 1006
      const result = calculatePredictedIron(data, baseTime + 3000);

      expect(result).toBe(1006);
    });

    test('calculatePredictedIron_floorsDecimalValues', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 2.7,
        lastUpdateTime: baseTime,
        maxCapacity: 5000
      };

      // 1 second later, should be 1000 + (1 * 2.7) = 1002.7 → 1002
      const result = calculatePredictedIron(data, baseTime + 1000);

      expect(result).toBe(1002);
    });

    test('calculatePredictedIron_negativeProduction_returnsServerAmount', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: -1,
        lastUpdateTime: Date.now() - 5000,
        maxCapacity: 5000
      };

      const result = calculatePredictedIron(data);

      expect(result).toBe(1000);
    });

    test('calculatePredictedIron_nearCapacity_capsAtMaximum', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 4990,
        ironPerSecond: 2,
        lastUpdateTime: baseTime,
        maxCapacity: 5000
      };

      // 10 seconds later, would be 4990 + (10 * 2) = 5010, but capped at 5000
      const result = calculatePredictedIron(data, baseTime + 10000);

      expect(result).toBe(5000);
    });

    test('calculatePredictedIron_atCapacity_staysAtCapacity', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 5000,
        ironPerSecond: 2,
        lastUpdateTime: baseTime,
        maxCapacity: 5000
      };

      // 5 seconds later, would be 5000 + (5 * 2) = 5010, but capped at 5000
      const result = calculatePredictedIron(data, baseTime + 5000);

      expect(result).toBe(5000);
    });

    test('calculatePredictedIron_belowCapacity_doesNotCapPrematurely', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 4000,
        ironPerSecond: 100,
        lastUpdateTime: baseTime,
        maxCapacity: 5000
      };

      // 5 seconds later, should be 4000 + (5 * 100) = 4500 (not capped)
      const result = calculatePredictedIron(data, baseTime + 5000);

      expect(result).toBe(4500);
    });

    test('calculatePredictedIron_withHigherCapacity_allowsMoreIron', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 9500,
        ironPerSecond: 100,
        lastUpdateTime: baseTime,
        maxCapacity: 10000 // Level 2 inventory
      };

      // 10 seconds later, would be 9500 + (10 * 100) = 10500, but capped at 10000
      const result = calculatePredictedIron(data, baseTime + 10000);

      expect(result).toBe(10000);
    });

    test('calculatePredictedIron_floorsAfterCapping', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 4999.8,
        ironPerSecond: 0.1,
        lastUpdateTime: baseTime,
        maxCapacity: 5000
      };

      // 5 seconds later, would be 4999.8 + (5 * 0.1) = 5000.3, capped to 5000, floored to 5000
      const result = calculatePredictedIron(data, baseTime + 5000);

      expect(result).toBe(5000);
    });
  });

  describe('shouldUpdateDisplay', () => {
    test('shouldUpdateDisplay_sameValue_returnsFalse', () => {
      expect(shouldUpdateDisplay(1000, 1000)).toBe(false);
    });

    test('shouldUpdateDisplay_differentValue_returnsTrue', () => {
      expect(shouldUpdateDisplay(1000, 1001)).toBe(true);
    });

    test('shouldUpdateDisplay_largerDifference_returnsTrue', () => {
      expect(shouldUpdateDisplay(1000, 1500)).toBe(true);
    });
  });
});
