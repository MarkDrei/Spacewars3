import { describe, expect, test, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/lib/client/hooks/useMediaQuery';

type Listener = () => void;

const installMatchMedia = (initialMatches: boolean) => {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    change(next: boolean) {
      matches = next;
      listeners.forEach(listener => listener());
    },
    listenerCount: () => listeners.size,
  };
};

describe('useMediaQuery', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test('useMediaQuery_queryMatches_returnsTrue', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(orientation: portrait)'));
    expect(result.current).toBe(true);
  });

  test('useMediaQuery_mediaChanges_updatesValue', () => {
    const media = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(false);

    act(() => media.change(true));

    expect(result.current).toBe(true);
  });

  test('useMediaQuery_unmount_removesListener', () => {
    const media = installMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });
});
