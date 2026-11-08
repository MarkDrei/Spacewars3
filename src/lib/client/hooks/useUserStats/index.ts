/**
 * Re-export the main hook and utilities
 */
export { useUserStats } from './useUserStats';
export { calculatePredictedIron, shouldUpdateDisplay } from './ironCalculations';
export { shouldRetryFetch, scheduleRetry, DEFAULT_RETRY_CONFIG } from './retryLogic';
export type { IronData } from './ironCalculations';
