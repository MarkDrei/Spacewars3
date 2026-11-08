import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { factoryService, BuildQueueItem, WeaponSpec, DefenseSpec, TechCounts, type TechCatalogResponse } from '../services/factoryService';
import { createSharedPoller } from '../polling/sharedPoller';

interface FactoryDataCache {
  buildQueue: BuildQueueItem[];
  techCounts: TechCounts | null;
  weapons: Record<string, WeaponSpec>;
  defenses: Record<string, DefenseSpec>;
  lastUpdated: number;
}

interface UseFactoryDataCacheReturn {
  data: FactoryDataCache | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Singleton store shared by all hook instances (external store for useSyncExternalStore)
interface FactoryCacheState {
  data: FactoryDataCache | null;
  error: string | null;
}

const INITIAL_CACHE_STATE: FactoryCacheState = { data: null, error: null };

let cacheState: FactoryCacheState = INITIAL_CACHE_STATE;
const cacheSubscribers: Set<() => void> = new Set();
/** Tech catalog from the first successful load; it only changes with a new deployment. */
let cachedCatalog: TechCatalogResponse | null = null;
let isCurrentlyFetching = false;
let fetchPromise: Promise<void> | null = null;

// Test utility function to reset singleton state
export const resetFactoryDataCache = () => {
  cacheState = INITIAL_CACHE_STATE;
  cacheSubscribers.clear();
  isCurrentlyFetching = false;
  fetchPromise = null;
  cachedCatalog = null;
  factoryPoller.reset();
};

const setCacheState = (next: FactoryCacheState) => {
  cacheState = next;
  cacheSubscribers.forEach(callback => callback());
};

const subscribeToCache = (callback: () => void): (() => void) => {
  cacheSubscribers.add(callback);
  return () => {
    cacheSubscribers.delete(callback);
  };
};

const getCacheSnapshot = (): FactoryCacheState => cacheState;
const getServerCacheSnapshot = (): FactoryCacheState => INITIAL_CACHE_STATE;

const fetchFactoryData = async (retryCount: number = 0): Promise<void> => {
  // Only prevent concurrent fetches on the initial call (retryCount === 0)
  if (retryCount === 0) {
    if (isCurrentlyFetching && fetchPromise) {
      await fetchPromise;
      return;
    }
    isCurrentlyFetching = true;
  }
  
  const currentPromise = (async (): Promise<void> => {
    try {
      // The catalog (static tech specs) is loaded once; only the build status is polled
      const [catalogResult, statusResult] = await Promise.all([
        cachedCatalog ?? factoryService.getTechCatalog(),
        factoryService.getBuildStatus()
      ]);

      if ('error' in catalogResult) {
        throw new Error(catalogResult.error);
      }
      cachedCatalog = catalogResult;

      if ('error' in statusResult) {
        throw new Error(statusResult.error);
      }

      // Calculate remaining seconds for build queue items
      const now = Math.floor(Date.now() / 1000);
      const buildQueueWithCountdown = statusResult.buildQueue.map(item => ({
        ...item,
        remainingSeconds: Math.max(0, item.completionTime - now)
      }));

      // Update shared cache and notify all subscribed hook instances
      setCacheState({
        data: {
          buildQueue: buildQueueWithCountdown,
          techCounts: statusResult.techCounts,
          weapons: catalogResult.weapons,
          defenses: catalogResult.defenses,
          lastUpdated: Date.now()
        },
        error: null
      });
      
    } catch (error) {
      // Retry logic for network errors only
      if (retryCount < 3 && error instanceof Error && 
          (error.message.includes('Network error') || error.message === 'Failed to fetch')) {
        // Wait 2 seconds then retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchFactoryData(retryCount + 1);
        return;
      }
      
      // If not a retryable error or max retries reached, throw the error
      throw error;
    }
  })();

  // Only set fetchPromise and handle cleanup for the initial call
  if (retryCount === 0) {
    fetchPromise = currentPromise;
    try {
      await currentPromise;
    } finally {
      isCurrentlyFetching = false;
      fetchPromise = null;
    }
  } else {
    await currentPromise;
  }
};

/**
 * Fetches factory data into the shared store and records a failure as store error.
 * Never throws and never touches React state directly.
 */
const refreshFactoryCache = async (): Promise<void> => {
  try {
    await fetchFactoryData();
  } catch (err) {
    setCacheState({
      ...cacheState,
      error: err instanceof Error ? err.message : 'Failed to fetch factory data'
    });
  }
};

const factoryPoller = createSharedPoller(() => {
  void refreshFactoryCache();
});

export const useFactoryDataCache = (pollInterval: number = 5000): UseFactoryDataCacheReturn => {
  // Auth is guaranteed by server component, so we assume authenticated
  const { data, error } = useSyncExternalStore(subscribeToCache, getCacheSnapshot, getServerCacheSnapshot);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch only if no other hook instance has populated the cache yet
    if (!cacheState.data) {
      void refreshFactoryCache();
    }

    // One poll loop for all hook instances (build queue, tech counts), paused while hidden
    const unregister = factoryPoller.register(pollInterval);

    return () => {
      isMountedRef.current = false;
      unregister();
    };
  }, [pollInterval]);

  const refetch = useCallback(async () => {
    setIsRefetching(true);
    await refreshFactoryCache();
    if (isMountedRef.current) {
      setIsRefetching(false);
    }
  }, []);

  return {
    data,
    // Loading until the first result (data or error) arrives, and while an explicit refetch runs
    isLoading: isRefetching || (data === null && error === null),
    error,
    refetch
  };
};
