// ---
// Utility functions and abstractions for battle scheduler testability
// Provides time provider interface and scheduler setup/teardown utilities
// ---

/**
 * Interface for providing time in seconds
 * Allows mocking time in tests
 */
export interface TimeProvider {
  /**
   * Get current time in seconds since epoch
   */
  now(): number;
}

/**
 * Production time provider using Date.now()
 */
export const realTimeProvider: TimeProvider = {
  now(): number {
    return Math.floor(Date.now() / 1000);
  }
};

/**
 * Type for interval ID returned by setInterval
 */
export type IntervalId = ReturnType<typeof setInterval>;

/**
 * Setup battle scheduler with configurable interval
 * @param processor Function to call on each interval
 * @param intervalMs Interval in milliseconds
 * @param scheduler Function to set up interval (default: setInterval)
 * @returns Interval ID for cancellation
 */
export function setupBattleScheduler(
  processor: () => void,
  intervalMs: number,
  scheduler: (callback: () => void, ms: number) => IntervalId = setInterval
): IntervalId {
  return scheduler(processor, intervalMs);
}

/**
 * Cancel battle scheduler
 * @param intervalId Interval ID to cancel
 * @param canceller Function to cancel interval (default: clearInterval)
 */
export function cancelBattleScheduler(
  intervalId: IntervalId,
  canceller: (id: IntervalId) => void = clearInterval
): void {
  canceller(intervalId);
}
