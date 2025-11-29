/**
 * Retry logic for failed fetches
 * Separated for better testability
 */

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  shouldRetry: (error: string) => boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 2000,
  shouldRetry: (error: string) => error.includes('Network error')
};

/**
 * Determine if a fetch should be retried
 * @param error - Error message
 * @param currentRetryCount - Current retry attempt (0-indexed)
 * @param config - Retry configuration
 * @returns Object with shouldRetry flag and retry count
 */
export function shouldRetryFetch(
  error: string,
  currentRetryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): { shouldRetry: boolean; nextRetryCount: number } {
  const canRetry = currentRetryCount < config.maxRetries;
  const errorIsRetryable = config.shouldRetry(error);
  
  return {
    shouldRetry: canRetry && errorIsRetryable,
    nextRetryCount: currentRetryCount + 1
  };
}

/**
 * Schedule a retry with the configured delay
 * This is a thin wrapper around setTimeout for better testability
 * @param fn - Function to retry
 * @param delay - Delay in milliseconds
 * @param scheduler - Optional scheduler function (for testing)
 * @returns Timeout ID
 */
export function scheduleRetry(
  fn: () => void,
  delay: number = DEFAULT_RETRY_CONFIG.retryDelay,
  scheduler: typeof setTimeout = setTimeout
): NodeJS.Timeout {
  return scheduler(fn, delay);
}
