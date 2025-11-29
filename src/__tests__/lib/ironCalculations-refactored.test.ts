import { describe, expect, test } from 'vitest';
import { calculatePredictedIron, shouldUpdateDisplay, type IronData } from '@/lib/client/hooks/useIron/ironCalculations';

describe('Iron Calculations', () => {
  describe('calculatePredictedIron', () => {
    test('calculatePredictedIron_zeroProduction_returnsServerAmount', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 0,
        lastUpdateTime: Date.now() - 5000 // 5 seconds ago
      };

      const result = calculatePredictedIron(data);

      expect(result).toBe(1000);
    });

    test('calculatePredictedIron_withProduction_calculatesCorrectly', () => {
      const baseTime = 1000000;
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 2,
        lastUpdateTime: baseTime
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
        lastUpdateTime: baseTime
      };

      // 1 second later, should be 1000 + (1 * 2.7) = 1002.7 → 1002
      const result = calculatePredictedIron(data, baseTime + 1000);

      expect(result).toBe(1002);
    });

    test('calculatePredictedIron_negativeProduction_returnsServerAmount', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: -1,
        lastUpdateTime: Date.now() - 5000
      };

      const result = calculatePredictedIron(data);

      expect(result).toBe(1000);
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
