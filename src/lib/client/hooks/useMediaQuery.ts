import { useCallback, useSyncExternalStore } from 'react';

const getMediaQueryList = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/**
 * Subscribes to a CSS media query. Returns false during server rendering / hydration and when
 * matchMedia is unavailable. Falls back to addListener for older Safari versions.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQuery = getMediaQueryList(query);
      if (!mediaQuery) return () => {};

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onChange);
        return () => mediaQuery.removeEventListener('change', onChange);
      }
      mediaQuery.addListener(onChange);
      return () => mediaQuery.removeListener(onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => getMediaQueryList(query)?.matches ?? false, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
