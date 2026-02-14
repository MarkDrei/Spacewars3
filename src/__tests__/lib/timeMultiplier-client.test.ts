/**
 * Tests for the client-side timeMultiplier module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getTimeMultiplier, setTimeMultiplier, resetTimeMultiplier } from '@/lib/client/timeMultiplier';

describe('Client-side timeMultiplier module', () => {
  beforeEach(() => {
    resetTimeMultiplier();
  });

  describe('getTimeMultiplier', () => {
    it('getTimeMultiplier_default_returns1', () => {
      const result = getTimeMultiplier();
      expect(result).toBe(1);
    });

    it('getTimeMultiplier_afterSet_returnsSetValue', () => {
      setTimeMultiplier(10);
      const result = getTimeMultiplier();
      expect(result).toBe(10);
    });

    it('getTimeMultiplier_afterMultipleSets_returnsLatestValue', () => {
      setTimeMultiplier(5);
      setTimeMultiplier(10);
      setTimeMultiplier(50);
      const result = getTimeMultiplier();
      expect(result).toBe(50);
    });
  });

  describe('setTimeMultiplier', () => {
    it('setTimeMultiplier_validValue_storesValue', () => {
      setTimeMultiplier(25);
      expect(getTimeMultiplier()).toBe(25);
    });

    it('setTimeMultiplier_fractionalValue_storesExactValue', () => {
      setTimeMultiplier(2.5);
      expect(getTimeMultiplier()).toBe(2.5);
    });

    it('setTimeMultiplier_largeValue_storesValue', () => {
      setTimeMultiplier(1000);
      expect(getTimeMultiplier()).toBe(1000);
    });
  });

  describe('resetTimeMultiplier', () => {
    it('resetTimeMultiplier_afterSet_resetsTo1', () => {
      setTimeMultiplier(100);
      resetTimeMultiplier();
      expect(getTimeMultiplier()).toBe(1);
    });

    it('resetTimeMultiplier_whenAlreadyDefault_remainsAt1', () => {
      resetTimeMultiplier();
      expect(getTimeMultiplier()).toBe(1);
    });
  });

  describe('Module state persistence', () => {
    it('multiplier_persistsAcrossMultipleCalls', () => {
      setTimeMultiplier(7);
      expect(getTimeMultiplier()).toBe(7);
      expect(getTimeMultiplier()).toBe(7);
      expect(getTimeMultiplier()).toBe(7);
    });

    it('multiplier_canBeSetToOne_explicitly', () => {
      setTimeMultiplier(10);
      setTimeMultiplier(1);
      expect(getTimeMultiplier()).toBe(1);
    });
  });
});
