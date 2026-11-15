import { startVisibilityAwarePolling } from './visibilityPolling';

export interface SharedPoller {
  /**
   * Registers a consumer that wants `refresh` called at least every `intervalMs`.
   * Polling runs once for all consumers, at the shortest requested interval, paused while the
   * page is hidden. Returns the unregister function.
   */
  register(intervalMs: number): () => void;
  /** Number of registered consumers. */
  readonly consumerCount: number;
  /** Stops polling and forgets all consumers (tests). */
  reset(): void;
}

/** One poll loop shared by all consumers of a client-side data store. */
export function createSharedPoller(refresh: () => void): SharedPoller {
  const consumers = new Map<symbol, number>();
  let stop: (() => void) | null = null;
  let activeInterval: number | null = null;

  const update = () => {
    const interval = consumers.size > 0 ? Math.min(...consumers.values()) : null;
    if (interval === activeInterval) return;
    stop?.();
    stop = interval === null ? null : startVisibilityAwarePolling(refresh, interval);
    activeInterval = interval;
  };

  return {
    register(intervalMs: number) {
      const id = Symbol('consumer');
      consumers.set(id, intervalMs);
      update();
      return () => {
        consumers.delete(id);
        update();
      };
    },
    get consumerCount() {
      return consumers.size;
    },
    reset() {
      consumers.clear();
      update();
    },
  };
}
