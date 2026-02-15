import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TimeMultiplierService } from '../../lib/server/timeMultiplier';

describe('TimeMultiplierService', () => {
  let service: TimeMultiplierService;

  beforeEach(() => {
    // Reset singleton and get fresh instance
    TimeMultiplierService.resetInstance();
    service = TimeMultiplierService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TimeMultiplierService.resetInstance();
  });

  describe('getInstance', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = TimeMultiplierService.getInstance();
      const instance2 = TimeMultiplierService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getMultiplier', () => {
    it('getMultiplier_noMultiplierSet_returns1', () => {
      const multiplier = service.getMultiplier();
      expect(multiplier).toBe(1);
    });

    it('getMultiplier_beforeExpiry_returnsSetValue', () => {
      service.setMultiplier(10, 5);
      const multiplier = service.getMultiplier();
      expect(multiplier).toBe(10);
    });

    it('getMultiplier_afterExpiry_returns1', () => {
      // Mock Date.now() to control time
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);
      
      // Set multiplier for 5 minutes
      service.setMultiplier(10, 5);
      
      // Fast-forward time past expiration (5 minutes + 1ms)
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 5 * 60 * 1000 + 1);
      
      // Should auto-reset to 1
      const multiplier = service.getMultiplier();
      expect(multiplier).toBe(1);
    });

    it('getMultiplier_atExactExpiry_returns1', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);
      
      service.setMultiplier(10, 5);
      
      // At exact expiration time
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 5 * 60 * 1000);
      
      const multiplier = service.getMultiplier();
      expect(multiplier).toBe(1);
    });

    it('getMultiplier_oneSecondBeforeExpiry_returnsSetValue', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);
      
      service.setMultiplier(10, 5);
      
      // 1 second before expiration
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 5 * 60 * 1000 - 1000);
      
      const multiplier = service.getMultiplier();
      expect(multiplier).toBe(10);
    });
  });

  describe('setMultiplier', () => {
    it('setMultiplier_validValues_storesMultiplierAndExpiration', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(10, 5);

      const status = service.getStatus();
      expect(status.multiplier).toBe(10);
      expect(status.activatedAt).toBe(mockNow);
      expect(status.expiresAt).toBe(mockNow + 5 * 60 * 1000);
    });

    it('setMultiplier_multiplierValue1_isValid', () => {
      expect(() => service.setMultiplier(1, 1)).not.toThrow();
      expect(service.getMultiplier()).toBe(1);
    });

    it('setMultiplier_multiplierLessThan1_throwsError', () => {
      expect(() => service.setMultiplier(0.5, 5)).toThrow('Multiplier must be >= 1');
    });

    it('setMultiplier_multiplierZero_throwsError', () => {
      expect(() => service.setMultiplier(0, 5)).toThrow('Multiplier must be >= 1');
    });

    it('setMultiplier_durationZero_throwsError', () => {
      expect(() => service.setMultiplier(10, 0)).toThrow('Duration must be > 0');
    });

    it('setMultiplier_durationNegative_throwsError', () => {
      expect(() => service.setMultiplier(10, -5)).toThrow('Duration must be > 0');
    });

    it('setMultiplier_invalidValues_doesNotChangeState', () => {
      // Set valid multiplier first
      service.setMultiplier(5, 10);
      const originalStatus = service.getStatus();

      // Try to set invalid multiplier
      expect(() => service.setMultiplier(0, 5)).toThrow();

      // State should be unchanged
      const currentStatus = service.getStatus();
      expect(currentStatus.multiplier).toBe(originalStatus.multiplier);
      expect(currentStatus.activatedAt).toBe(originalStatus.activatedAt);
    });

    it('setMultiplier_largeMultiplier_isValid', () => {
      expect(() => service.setMultiplier(100, 1)).not.toThrow();
      expect(service.getMultiplier()).toBe(100);
    });

    it('setMultiplier_fractionalDuration_isValid', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(10, 0.5); // 30 seconds

      const status = service.getStatus();
      expect(status.expiresAt).toBe(mockNow + 0.5 * 60 * 1000);
    });
  });

  describe('getStatus', () => {
    it('getStatus_activeMultiplier_returnsCorrectRemainingSeconds', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(10, 5);

      // 2 minutes later
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 2 * 60 * 1000);

      const status = service.getStatus();
      expect(status.multiplier).toBe(10);
      expect(status.remainingSeconds).toBe(3 * 60); // 3 minutes left
    });

    it('getStatus_noActiveMultiplier_returnsZeroRemainingSeconds', () => {
      const status = service.getStatus();
      expect(status.multiplier).toBe(1);
      expect(status.remainingSeconds).toBe(0);
      expect(status.expiresAt).toBeNull();
      expect(status.activatedAt).toBeNull();
    });

    it('getStatus_expiredMultiplier_returnsZeroRemainingSeconds', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(10, 5);

      // 6 minutes later (past expiration)
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 6 * 60 * 1000);

      const status = service.getStatus();
      expect(status.multiplier).toBe(1);
      expect(status.remainingSeconds).toBe(0);
      expect(status.expiresAt).toBeNull();
      expect(status.activatedAt).toBeNull();
    });

    it('getStatus_justExpired_returnsZeroRemainingSeconds', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(10, 5);

      // Exactly at expiration
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 5 * 60 * 1000);

      const status = service.getStatus();
      expect(status.multiplier).toBe(1);
      expect(status.remainingSeconds).toBe(0);
    });

    it('getStatus_partialSecondsRemaining_roundsUpToNextSecond', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(10, 1); // 1 minute

      // 59.5 seconds later (500ms remaining)
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 59500);

      const status = service.getStatus();
      expect(status.remainingSeconds).toBe(1); // Rounds up from 0.5 seconds
    });
  });

  describe('reset', () => {
    it('reset_afterSet_returns1', () => {
      service.setMultiplier(10, 5);
      expect(service.getMultiplier()).toBe(10);

      service.reset();
      
      const status = service.getStatus();
      expect(status.multiplier).toBe(1);
      expect(status.expiresAt).toBeNull();
      expect(status.activatedAt).toBeNull();
      expect(status.remainingSeconds).toBe(0);
    });

    it('reset_calledMultipleTimes_staysAtDefault', () => {
      service.setMultiplier(10, 5);
      service.reset();
      service.reset();
      service.reset();
      
      expect(service.getMultiplier()).toBe(1);
    });
  });

  describe('resetInstance', () => {
    it('resetInstance_clearsGlobalInstance', () => {
      const instance1 = TimeMultiplierService.getInstance();
      instance1.setMultiplier(10, 5);

      TimeMultiplierService.resetInstance();

      const instance2 = TimeMultiplierService.getInstance();
      expect(instance2.getMultiplier()).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('multiple activations_latestWins', () => {
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(5, 10);
      
      // 2 minutes later, activate with different multiplier
      vi.spyOn(Date, 'now').mockReturnValue(mockNow + 2 * 60 * 1000);
      service.setMultiplier(20, 5);

      const status = service.getStatus();
      expect(status.multiplier).toBe(20);
      expect(status.activatedAt).toBe(mockNow + 2 * 60 * 1000);
      expect(status.expiresAt).toBe(mockNow + 2 * 60 * 1000 + 5 * 60 * 1000);
    });

    it('setToMultiplier1_withDuration_isValid', () => {
      // Setting multiplier to 1 is valid (effectively disables acceleration)
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      service.setMultiplier(1, 10);

      const status = service.getStatus();
      expect(status.multiplier).toBe(1);
      expect(status.activatedAt).toBe(mockNow);
      expect(status.expiresAt).toBe(mockNow + 10 * 60 * 1000);
    });
  });
});
