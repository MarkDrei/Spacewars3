/**
 * Battle Scheduler Utilities
 * Provides injectable abstractions for better testability
 * Pattern based on pollingUtils.ts
 */

import type { MessageCache } from '../messages/MessageCache';

/**
 * Interface for time provider
 * Allows tests to control time without waiting
 */
export interface TimeProvider {
  /**
   * Get current time in seconds (Unix epoch)
   */
  now(): number;
}

/**
 * Real time provider implementation
 * Uses system time
 */
export const realTimeProvider: TimeProvider = {
  now(): number {
    return Math.floor(Date.now() / 1000);
  }
};

/**
 * Configuration interface for BattleScheduler
 */
export interface BattleSchedulerConfig {
  /** Time provider for getting current time */
  timeProvider: TimeProvider;
  /** Message cache for creating battle messages */
  messageCache: MessageCache;
  /** Default weapon cooldown in seconds (optional) */
  defaultCooldown?: number;
  /** Scheduler interval in milliseconds (optional, default 1000) */
  schedulerIntervalMs?: number;
}

/**
 * Setup a battle scheduler interval
 * Thin wrapper around setInterval for better testability
 * @param fn - Function to call on each interval
 * @param intervalMs - Interval in milliseconds
 * @param scheduler - Optional scheduler function (for testing)
 * @returns Interval ID
 */
export function setupBattleScheduler(
  fn: () => void,
  intervalMs: number,
  scheduler: typeof setInterval = setInterval
): NodeJS.Timeout {
  return scheduler(fn, intervalMs);
}

/**
 * Cancel a battle scheduler interval
 * @param intervalId - Interval ID to cancel
 * @param canceller - Optional canceller function (for testing)
 */
export function cancelBattleScheduler(
  intervalId: NodeJS.Timeout,
  canceller: typeof clearInterval = clearInterval
): void {
  canceller(intervalId);
}
