import { describe, it, expect } from 'vitest';
import { formatNumber } from '@/shared/numberFormat';

describe('formatNumber', () => {
  // ── integers ────────────────────────────────────────────────────────────
  describe('integers', () => {
    it('formatNumber_zero_returnsZero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('formatNumber_singleDigit_returnsAsIs', () => {
      expect(formatNumber(5)).toBe('5');
    });

    it('formatNumber_twoDigits_returnsAsIs', () => {
      expect(formatNumber(43)).toBe('43');
    });

    it('formatNumber_threeDigits_returnsAsIs', () => {
      expect(formatNumber(999)).toBe('999');
    });

    it('formatNumber_fourDigits_addsThousandSeparator', () => {
      expect(formatNumber(1000)).toBe('1,000');
    });

    it('formatNumber_largeInteger_addsThousandSeparators', () => {
      expect(formatNumber(16202)).toBe('16,202');
    });

    it('formatNumber_largeIntegerWithDecimalPart_stripsDecimals', () => {
      // 16,202.03 must NOT appear – integer part already has 5 digits
      expect(formatNumber(16202.03)).toBe('16,202');
    });

    it('formatNumber_threeDigitIntegerWithDecimal_roundsAndStripsDecimals', () => {
      expect(formatNumber(100.5)).toBe('101');
    });
  });

  // ── 1–2 integer digits (need decimal places) ────────────────────────────
  describe('1-2 integer digits', () => {
    it('formatNumber_twoIntegerDigits_showsOneDecimalPlace', () => {
      expect(formatNumber(43.2456)).toBe('43.2');
    });

    it('formatNumber_oneIntegerDigit_showsTwoDecimalPlaces', () => {
      expect(formatNumber(2.2345)).toBe('2.23');
    });

    it('formatNumber_oneIntegerDigit_exactlyThreeSigFigs', () => {
      expect(formatNumber(2.23)).toBe('2.23');
    });

    it('formatNumber_twoIntegerDigits_exactlyThreeSigFigs', () => {
      expect(formatNumber(43.2)).toBe('43.2');
    });

    it('formatNumber_trailingZeroStripped_oneDecimalPlace', () => {
      // 10.0 should display as "10" not "10.0"
      expect(formatNumber(10.0)).toBe('10');
    });

    it('formatNumber_trailingZeroStripped_twoDecimalPlaces', () => {
      // 2.10 should display as "2.1" not "2.10"
      expect(formatNumber(2.1)).toBe('2.1');
    });

    it('formatNumber_roundingCarriesOverToMoreIntegerDigits_recalculatesDecimals', () => {
      // 9.999 rounds to 10 (2 int digits → 1 decimal → 10.0 → stripped → "10")
      expect(formatNumber(9.999)).toBe('10');
    });

    it('formatNumber_roundingCarriesTo100_stripsDecimals', () => {
      // 99.99 rounds to 100 (3 int digits → no decimals)
      expect(formatNumber(99.99)).toBe('100');
    });
  });

  // ── values < 1 ──────────────────────────────────────────────────────────
  describe('values < 1', () => {
    it('formatNumber_smallDecimal_threeSignificantFigures', () => {
      expect(formatNumber(0.001234)).toBe('0.00123');
    });

    it('formatNumber_decimalNearOne_threeSignificantFigures', () => {
      expect(formatNumber(0.9876)).toBe('0.988');
    });

    it('formatNumber_simpleDecimal_threeSignificantFigures', () => {
      expect(formatNumber(0.1234)).toBe('0.123');
    });

    it('formatNumber_trailingZerosAfterDecimalStripped', () => {
      // 0.100 via toPrecision(3) → strip trailing zeros → "0.1"
      expect(formatNumber(0.1)).toBe('0.1');
    });
  });

  // ── negative numbers ─────────────────────────────────────────────────────
  describe('negative numbers', () => {
    it('formatNumber_negativeInteger_addsMinusSign', () => {
      expect(formatNumber(-1000)).toBe('-1,000');
    });

    it('formatNumber_negativeDecimal_addsMinusSign', () => {
      expect(formatNumber(-2.2345)).toBe('-2.23');
    });
  });

  // ── special values ────────────────────────────────────────────────────────
  describe('special values', () => {
    it('formatNumber_infinity_returnsInfinity', () => {
      expect(formatNumber(Infinity)).toBe('Infinity');
    });

    it('formatNumber_negativeInfinity_returnsNegativeInfinity', () => {
      expect(formatNumber(-Infinity)).toBe('-Infinity');
    });

    it('formatNumber_NaN_returnsNaN', () => {
      expect(formatNumber(NaN)).toBe('NaN');
    });
  });

  // ── contract examples from the module documentation ─────────────────────
  describe('documented contract examples', () => {
    it('shows 16202 as 16,202', () => expect(formatNumber(16202)).toBe('16,202'));
    it('shows 2.23 as 2.23',   () => expect(formatNumber(2.23)).toBe('2.23'));
    it('shows 43.2 as 43.2',   () => expect(formatNumber(43.2)).toBe('43.2'));
    it('does NOT show 1.2323', () => expect(formatNumber(1.2323)).not.toBe('1.2323'));
    it('does NOT show 16202.03', () => expect(formatNumber(16202.03)).not.toBe('16,202.03'));
  });
});
