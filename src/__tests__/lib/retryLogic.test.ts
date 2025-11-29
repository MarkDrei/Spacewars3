import { describe, expect, test, vi } from 'vitest';
import { shouldRetryFetch, scheduleRetry, DEFAULT_RETRY_CONFIG } from '@/lib/client/hooks/useIron/retryLogic';

describe('Retry Logic', () => {
  describe('shouldRetryFetch', () => {
    test('shouldRetryFetch_networkErrorWithinLimit_returnsTrue', () => {
      const result = shouldRetryFetch('Network error', 0);

      expect(result.shouldRetry).toBe(true);
      expect(result.nextRetryCount).toBe(1);
    });

    test('shouldRetryFetch_networkErrorAtLimit_returnsFalse', () => {
      const result = shouldRetryFetch('Network error', 3);

      expect(result.shouldRetry).toBe(false);
      expect(result.nextRetryCount).toBe(4);
    });

    test('shouldRetryFetch_nonRetryableError_returnsFalse', () => {
      const result = shouldRetryFetch('Server error', 0);

      expect(result.shouldRetry).toBe(false);
      expect(result.nextRetryCount).toBe(1);
    });

    test('shouldRetryFetch_customConfig_usesCustomRules', () => {
      const customConfig = {
        maxRetries: 5,
        retryDelay: 1000,
        shouldRetry: (error: string) => error.includes('Timeout')
      };

      const result1 = shouldRetryFetch('Timeout error', 0, customConfig);
      expect(result1.shouldRetry).toBe(true);

      const result2 = shouldRetryFetch('Network error', 0, customConfig);
      expect(result2.shouldRetry).toBe(false);
    });

    test('shouldRetryFetch_incrementsRetryCount', () => {
      const result1 = shouldRetryFetch('Network error', 0);
      expect(result1.nextRetryCount).toBe(1);

      const result2 = shouldRetryFetch('Network error', 1);
      expect(result2.nextRetryCount).toBe(2);
    });
  });

  describe('scheduleRetry', () => {
    test('scheduleRetry_callsSchedulerWithCorrectParams', () => {
      const mockScheduler = vi.fn() as unknown as typeof setTimeout;
      const mockFn = vi.fn();

      scheduleRetry(mockFn, 2000, mockScheduler);

      expect(mockScheduler).toHaveBeenCalledWith(mockFn, 2000);
      expect(mockScheduler).toHaveBeenCalledTimes(1);
    });

    test('scheduleRetry_usesDefaultDelay', () => {
      const mockScheduler = vi.fn() as unknown as typeof setTimeout;
      const mockFn = vi.fn();

      scheduleRetry(mockFn, undefined, mockScheduler);

      expect(mockScheduler).toHaveBeenCalledWith(mockFn, DEFAULT_RETRY_CONFIG.retryDelay);
    });

    test('scheduleRetry_returnsTimeoutId', () => {
      const mockTimeoutId = 123 as unknown as NodeJS.Timeout;
      const mockScheduler = vi.fn().mockReturnValue(mockTimeoutId) as unknown as typeof setTimeout;
      const mockFn = vi.fn();

      const result = scheduleRetry(mockFn, 1000, mockScheduler);

      expect(result).toBe(mockTimeoutId);
    });
  });
});
