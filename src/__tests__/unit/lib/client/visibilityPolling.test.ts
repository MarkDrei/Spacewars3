import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisibilityAwarePolling } from '@/lib/client/polling/visibilityPolling';

/** Minimal document stand-in with a controllable `hidden` flag. */
const createDocument = () => {
  const target = new EventTarget();
  const doc = {
    hidden: false,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    setHidden(hidden: boolean) {
      doc.hidden = hidden;
      target.dispatchEvent(new Event('visibilitychange'));
    },
  };
  return doc;
};

describe('startVisibilityAwarePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('visibilityPolling_visiblePage_pollsEveryInterval', () => {
    const poll = vi.fn();
    const stop = startVisibilityAwarePolling(poll, 1000, createDocument() as unknown as Document);

    vi.advanceTimersByTime(3000);

    expect(poll).toHaveBeenCalledTimes(3);
    stop();
  });

  it('visibilityPolling_hiddenPage_skipsTicks', () => {
    const poll = vi.fn();
    const doc = createDocument();
    const stop = startVisibilityAwarePolling(poll, 1000, doc as unknown as Document);

    doc.setHidden(true);
    vi.advanceTimersByTime(10_000);

    expect(poll).not.toHaveBeenCalled();
    stop();
  });

  it('visibilityPolling_pageBecomesVisible_pollsImmediatelyThenResumes', () => {
    const poll = vi.fn();
    const doc = createDocument();
    const stop = startVisibilityAwarePolling(poll, 1000, doc as unknown as Document);
    doc.setHidden(true);
    vi.advanceTimersByTime(5000);

    doc.setHidden(false);
    expect(poll).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
  });

  it('visibilityPolling_stopped_noFurtherPolls', () => {
    const poll = vi.fn();
    const doc = createDocument();
    const stop = startVisibilityAwarePolling(poll, 1000, doc as unknown as Document);

    stop();
    vi.advanceTimersByTime(5000);
    doc.setHidden(true);
    doc.setHidden(false);

    expect(poll).not.toHaveBeenCalled();
  });
});
