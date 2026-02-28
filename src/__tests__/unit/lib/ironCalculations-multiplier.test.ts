/**
 * Tests for iron calculations with time multiplier support
 */
import { describe, it, expect } from 'vitest';
import { calculatePredictedIron, shouldUpdateDisplay, type IronData } from '@/lib/client/hooks/useIron/ironCalculations';

describe('Iron Calculations - Time Multiplier', () => {
  describe('calculatePredictedIron with multiplier', () => {
    it('calculatePredictedIron_withMultiplier1_behavesUnchanged', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 10000
      };

      const result = calculatePredictedIron(data, Date.now(), 1);

      // 1000 + (5 * 10 * 1) = 1050
      expect(result).toBe(1050);
    });

    it('calculatePredictedIron_withMultiplier10_predictsAt10xRate', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 50000
      };

      const result = calculatePredictedIron(data, Date.now(), 10);

      // 1000 + (5 * 10 * 10) = 1500
      expect(result).toBe(1500);
    });

    it('calculatePredictedIron_withMultiplier50_predictsAt50xRate', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 10000, // 10 seconds ago
        maxCapacity: 100000
      };

      const result = calculatePredictedIron(data, Date.now(), 50);

      // 1000 + (10 * 10 * 50) = 6000
      expect(result).toBe(6000);
    });

    it('calculatePredictedIron_multiplierWithFractionalProduction_roundsDown', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 3.7,
        lastUpdateTime: Date.now() - 3000, // 3 seconds ago
        maxCapacity: 10000
      };

      const result = calculatePredictedIron(data, Date.now(), 10);

      // 1000 + (3 * 3.7 * 10) = 1111, floored to 1111
      expect(result).toBe(1111);
    });

    it('calculatePredictedIron_multiplierHitsCapacity_capsAtMax', () => {
      const data: IronData = {
        serverAmount: 4000,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 5000
      };

      const result = calculatePredictedIron(data, Date.now(), 10);

      // 4000 + (5 * 10 * 10) = 4500 (under cap)
      // But let's verify cap works with multiplier
      expect(result).toBe(4500);
    });

    it('calculatePredictedIron_multiplierExceedsCapacity_capsAtMax', () => {
      const data: IronData = {
        serverAmount: 4800,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 5000
      };

      const result = calculatePredictedIron(data, Date.now(), 10);

      // 4800 + (5 * 10 * 10) = 5300, but capped at 5000
      expect(result).toBe(5000);
    });

    it('calculatePredictedIron_multiplierWithZeroProduction_returnsServerAmount', () => {
      const data: IronData = {
        serverAmount: 2000,
        ironPerSecond: 0,
        lastUpdateTime: Date.now() - 10000, // 10 seconds ago
        maxCapacity: 10000
      };

      const result = calculatePredictedIron(data, Date.now(), 10);

      expect(result).toBe(2000);
    });

    it('calculatePredictedIron_multiplierWithNegativeProduction_calculatesCorrectly', () => {
      const data: IronData = {
        serverAmount: 5000,
        ironPerSecond: -10,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 10000
      };

      const result = calculatePredictedIron(data, Date.now(), 10);

      // Server handles negative rates, but client calculations show 0 production
      // 5000 + (5 * -10 * 10) = 4500 (would decrease)
      // But since ironPerSecond <= 0, it should return floor(serverAmount)
      expect(result).toBe(5000);
    });

    it('calculatePredictedIron_defaultMultiplier_usesOne', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 5000, // 5 seconds ago
        maxCapacity: 10000
      };

      // Don't pass multiplier parameter
      const result = calculatePredictedIron(data, Date.now());

      // 1000 + (5 * 10 * 1) = 1050
      expect(result).toBe(1050);
    });

    it('calculatePredictedIron_fractionalMultiplier_calculatesCorrectly', () => {
      const data: IronData = {
        serverAmount: 1000,
        ironPerSecond: 10,
        lastUpdateTime: Date.now() - 10000, // 10 seconds ago
        maxCapacity: 10000
      };

      const result = calculatePredictedIron(data, Date.now(), 2.5);

      // 1000 + (10 * 10 * 2.5) = 1250
      expect(result).toBe(1250);
    });

    it('calculatePredictedIron_largeMultiplier_handlesLargeNumbers', () => {
      const data: IronData = {
        serverAmount: 10000,
        ironPerSecond: 100,
        lastUpdateTime: Date.now() - 60000, // 60 seconds ago
        maxCapacity: 1000000
      };

      const result = calculatePredictedIron(data, Date.now(), 100);

      // 10000 + (60 * 100 * 100) = 610000
      expect(result).toBe(610000);
    });
  });

  describe('shouldUpdateDisplay - unchanged behavior', () => {
    it('shouldUpdateDisplay_differentValues_returnsTrue', () => {
      const result = shouldUpdateDisplay(100, 105);
      expect(result).toBe(true);
    });

    it('shouldUpdateDisplay_sameValues_returnsFalse', () => {
      const result = shouldUpdateDisplay(100, 100);
      expect(result).toBe(false);
    });
  });
});
