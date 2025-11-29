import { describe, expect, test, vi } from 'vitest';
import { setupPolling, cancelPolling } from '@/lib/client/hooks/useIron/pollingUtils';

describe('Polling Utils', () => {
  describe('setupPolling', () => {
    test('setupPolling_callsSchedulerWithCorrectParams', () => {
      const mockScheduler = vi.fn() as unknown as typeof setInterval;
      const mockFn = vi.fn();

      setupPolling(mockFn, 5000, mockScheduler);

      expect(mockScheduler).toHaveBeenCalledWith(mockFn, 5000);
      expect(mockScheduler).toHaveBeenCalledTimes(1);
    });

    test('setupPolling_returnsIntervalId', () => {
      const mockIntervalId = 456 as unknown as NodeJS.Timeout;
      const mockScheduler = vi.fn().mockReturnValue(mockIntervalId) as unknown as typeof setInterval;
      const mockFn = vi.fn();

      const result = setupPolling(mockFn, 1000, mockScheduler);

      expect(result).toBe(mockIntervalId);
    });
  });

  describe('cancelPolling', () => {
    test('cancelPolling_callsCancellerWithIntervalId', () => {
      const mockCanceller = vi.fn() as unknown as typeof clearInterval;
      const mockIntervalId = 789 as unknown as NodeJS.Timeout;

      cancelPolling(mockIntervalId, mockCanceller);

      expect(mockCanceller).toHaveBeenCalledWith(mockIntervalId);
      expect(mockCanceller).toHaveBeenCalledTimes(1);
    });
  });
});
