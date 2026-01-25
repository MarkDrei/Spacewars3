/**
 * Battle Scheduler Utilities
 * 
 * Provides abstractions and utilities for testable battle scheduling:
 * - TimeProvider interface for time abstraction
 * - Setup and cancellation utilities for scheduler
 * - Configuration management for battle scheduler
 */

/**
 * Time provider interface for abstracting time access
 * Allows injecting fake time in tests
 */
export interface TimeProvider {
  /**
   * Get current time in seconds (Unix timestamp)
   */
  now(): number;
}

/**
 * Real time provider implementation using Date.now()
 */
export const realTimeProvider: TimeProvider = {
  now: () => Math.floor(Date.now() / 1000)
};

/**
 * Scheduler function type
 */
export type SchedulerFunction = (callback: () => void, intervalMs: number) => NodeJS.Timeout;

/**
 * Canceller function type
 */
export type CancellerFunction = (intervalId: NodeJS.Timeout) => void;

/**
 * Real scheduler implementation using setInterval
 */
export const realScheduler: SchedulerFunction = (callback, intervalMs) => {
  return setInterval(callback, intervalMs);
};

/**
 * Real canceller implementation using clearInterval
 */
export const realCanceller: CancellerFunction = (intervalId) => {
  clearInterval(intervalId);
};

/**
 * Setup battle scheduler with the provided configuration
 * @param processCallback The function to call on each interval
 * @param intervalMs The interval in milliseconds
 * @param scheduler The scheduler function (default: setInterval)
 * @returns The interval ID for cancellation
 */
export function setupBattleScheduler(
  processCallback: () => void,
  intervalMs: number,
  scheduler: SchedulerFunction = realScheduler
): NodeJS.Timeout {
  return scheduler(processCallback, intervalMs);
}

/**
 * Cancel battle scheduler with the provided interval ID
 * @param intervalId The interval ID to cancel
 * @param canceller The canceller function (default: clearInterval)
 */
export function cancelBattleScheduler(
  intervalId: NodeJS.Timeout,
  canceller: CancellerFunction = realCanceller
): void {
  canceller(intervalId);
}
