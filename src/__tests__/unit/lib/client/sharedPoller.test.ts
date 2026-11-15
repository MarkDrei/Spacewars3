import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedPoller } from '@/lib/client/polling/sharedPoller';

describe('createSharedPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sharedPoller_twoConsumers_pollsOnceAtShortestInterval', () => {
    const refresh = vi.fn();
    const poller = createSharedPoller(refresh);

    poller.register(5000);
    poller.register(2000);
    vi.advanceTimersByTime(10_000);

    expect(refresh).toHaveBeenCalledTimes(5);
    poller.reset();
  });

  it('sharedPoller_fastConsumerLeaves_fallsBackToSlowerInterval', () => {
    const refresh = vi.fn();
    const poller = createSharedPoller(refresh);
    poller.register(5000);
    const unregisterFast = poller.register(1000);

    unregisterFast();
    vi.advanceTimersByTime(10_000);

    expect(refresh).toHaveBeenCalledTimes(2);
    poller.reset();
  });

  it('sharedPoller_allConsumersLeave_stopsPolling', () => {
    const refresh = vi.fn();
    const poller = createSharedPoller(refresh);
    const unregister = poller.register(1000);

    unregister();
    vi.advanceTimersByTime(10_000);

    expect(refresh).not.toHaveBeenCalled();
    expect(poller.consumerCount).toBe(0);
  });
});
