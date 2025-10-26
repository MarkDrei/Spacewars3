/**
 * Polling utilities
 * Separated for better testability
 */

/**
 * Setup a polling interval
 * This is a thin wrapper around setInterval for better testability
 * @param fn - Function to call on each interval
 * @param intervalMs - Interval in milliseconds
 * @param scheduler - Optional scheduler function (for testing)
 * @returns Interval ID
 */
export function setupPolling(
  fn: () => void,
  intervalMs: number,
  scheduler: typeof setInterval = setInterval
): NodeJS.Timeout {
  return scheduler(fn, intervalMs);
}

/**
 * Cancel a polling interval
 * @param intervalId - Interval ID to cancel
 * @param canceller - Optional canceller function (for testing)
 */
export function cancelPolling(
  intervalId: NodeJS.Timeout,
  canceller: typeof clearInterval = clearInterval
): void {
  canceller(intervalId);
}
