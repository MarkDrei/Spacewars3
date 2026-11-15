import { userStatsService, type UserStatsResponse } from '../../services/userStatsService';
import { globalEvents, EVENTS } from '../../services/eventService';
import { shouldRetryFetch, scheduleRetry, DEFAULT_RETRY_CONFIG } from './retryLogic';
import { setTimeMultiplier } from '../../timeMultiplier';
import { createSharedPoller } from '../../polling/sharedPoller';

/**
 * Shared client store for `/api/user-stats`.
 *
 * Several components show user stats at the same time (layout header, home page, factory page).
 * Each used to poll on its own and refetched on every IRON_UPDATED / RESEARCH_TRIGGERED event,
 * multiplying the requests. Now one store fetches for all subscribers:
 * - polls while at least one component is subscribed, at the shortest requested interval,
 * - pauses while the page is hidden,
 * - coalesces concurrent refreshes into one request,
 * - retries network errors (DEFAULT_RETRY_CONFIG) before reporting an error.
 */

export interface UserStatsSnapshot {
  /** Last successful response, null until the first one arrives. */
  result: UserStatsResponse | null;
  /** Client time (ms) when `result` was received. */
  receivedAt: number;
  error: string | null;
  isLoading: boolean;
}

const INITIAL_SNAPSHOT: UserStatsSnapshot = { result: null, receivedAt: 0, error: null, isLoading: true };

let snapshot: UserStatsSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

const setSnapshot = (next: UserStatsSnapshot) => {
  snapshot = next;
  listeners.forEach(listener => listener());
};

const attempt = async (retryCount: number): Promise<void> => {
  try {
    const result = await userStatsService.getUserStats();
    if ('error' in result) {
      const retry = shouldRetryFetch(result.error, retryCount, DEFAULT_RETRY_CONFIG);
      if (retry.shouldRetry) {
        scheduleRetry(() => void attempt(retry.nextRetryCount), DEFAULT_RETRY_CONFIG.retryDelay);
        return;
      }
      setSnapshot({ ...snapshot, error: result.error, isLoading: false });
      return;
    }
    setTimeMultiplier(result.timeMultiplier ?? 1);
    setSnapshot({ result, receivedAt: Date.now(), error: null, isLoading: false });
  } catch (err) {
    const retry = shouldRetryFetch('Network error', retryCount, DEFAULT_RETRY_CONFIG);
    if (retry.shouldRetry) {
      scheduleRetry(() => void attempt(retry.nextRetryCount), DEFAULT_RETRY_CONFIG.retryDelay);
      return;
    }
    setSnapshot({ ...snapshot, error: 'Failed to fetch iron amount: ' + (err as Error).message, isLoading: false });
  }
};

/** Fetches user stats now; concurrent calls share one request. Never rejects. */
export const refreshUserStats = (): Promise<void> => {
  inFlight ??= attempt(0).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const handleStatsChanged = () => {
  void refreshUserStats();
};

const poller = createSharedPoller(handleStatsChanged);

/**
 * Subscribes a component. The first subscriber triggers the initial load and the event listeners;
 * polling runs while anyone is subscribed.
 */
export const subscribeUserStats = (listener: () => void, pollInterval: number): (() => void) => {
  const isFirst = listeners.size === 0;
  listeners.add(listener);
  const unregister = poller.register(pollInterval);

  if (isFirst) {
    globalEvents.on(EVENTS.IRON_UPDATED, handleStatsChanged);
    globalEvents.on(EVENTS.RESEARCH_TRIGGERED, handleStatsChanged);
    void refreshUserStats();
  }

  return () => {
    listeners.delete(listener);
    unregister();
    if (listeners.size === 0) {
      globalEvents.off(EVENTS.IRON_UPDATED, handleStatsChanged);
      globalEvents.off(EVENTS.RESEARCH_TRIGGERED, handleStatsChanged);
    }
  };
};

export const getUserStatsSnapshot = (): UserStatsSnapshot => snapshot;

export const getUserStatsServerSnapshot = (): UserStatsSnapshot => INITIAL_SNAPSHOT;

/** Clears all state, listeners and timers (tests). */
export const resetUserStatsStore = (): void => {
  poller.reset();
  inFlight = null;
  listeners.clear();
  globalEvents.off(EVENTS.IRON_UPDATED, handleStatsChanged);
  globalEvents.off(EVENTS.RESEARCH_TRIGGERED, handleStatsChanged);
  snapshot = INITIAL_SNAPSHOT;
};
