/**
 * Re-export the main hook and utilities
 */
export { useIron } from './useIron';
export { calculatePredictedIron, shouldUpdateDisplay } from './ironCalculations';
export { shouldRetryFetch, scheduleRetry, DEFAULT_RETRY_CONFIG } from './retryLogic';
export { setupPolling, cancelPolling } from './pollingUtils';
export type { IronData } from './ironCalculations';
