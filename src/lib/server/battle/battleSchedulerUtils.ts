// ---
// BattleSchedulerUtils: Utilities for battle scheduler dependency injection and testing
// ---

/**
 * Time provider interface for abstracting time operations
 * Allows injecting fake time for testing
 */
export interface TimeProvider {
  /**
   * Get current time in seconds (Unix timestamp)
   */
  now(): number;
}

/**
 * Real time provider using Date.now()
 */
export const realTimeProvider: TimeProvider = {
  now(): number {
    return Math.floor(Date.now() / 1000);
  }
};

/**
 * Setup battle scheduler with provided interval and callbacks
 * @param intervalMs - Interval in milliseconds between battle processing
 * @param processCallback - Function to call on each interval
 * @param scheduler - Optional scheduler function (defaults to setInterval)
 * @returns The interval ID that can be used to cancel the scheduler
 */
export function setupBattleScheduler(
  intervalMs: number,
  processCallback: () => void | Promise<void>,
  scheduler: (callback: () => void, intervalMs: number) => NodeJS.Timeout = setInterval
): NodeJS.Timeout {
  return scheduler(async () => {
    try {
      await processCallback();
    } catch (error) {
      console.error('❌ Battle scheduler error:', error);
    }
  }, intervalMs);
}

/**
 * Cancel battle scheduler with provided interval ID
 * @param intervalId - The interval ID returned by setupBattleScheduler
 * @param canceller - Optional canceller function (defaults to clearInterval)
 */
export function cancelBattleScheduler(
  intervalId: NodeJS.Timeout,
  canceller: (intervalId: NodeJS.Timeout) => void = clearInterval
): void {
  canceller(intervalId);
}
