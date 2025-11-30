import { useState, useEffect, useRef, useCallback } from 'react';
import { factoryService, BuildQueueItem, WeaponSpec, DefenseSpec, TechCounts } from '../services/factoryService';

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

// Singleton cache to share data between hooks
let sharedCache: FactoryDataCache | null = null;
const cacheSubscribers: Set<() => void> = new Set();
let isCurrentlyFetching = false;
let fetchPromise: Promise<void> | null = null;

// Test utility function to reset singleton state
export const resetFactoryDataCache = () => {
  sharedCache = null;
  cacheSubscribers.clear();
  isCurrentlyFetching = false;
  fetchPromise = null;
};

const notifySubscribers = () => {
  cacheSubscribers.forEach(callback => callback());
};

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
      // Fetch both API endpoints in parallel
      const [catalogResult, statusResult] = await Promise.all([
        factoryService.getTechCatalog(),
        factoryService.getBuildStatus()
      ]);

      if ('error' in catalogResult) {
        throw new Error(catalogResult.error);
      }

      if ('error' in statusResult) {
        throw new Error(statusResult.error);
      }

      // Calculate remaining seconds for build queue items
      const now = Math.floor(Date.now() / 1000);
      const buildQueueWithCountdown = statusResult.buildQueue.map(item => ({
        ...item,
        remainingSeconds: Math.max(0, item.completionTime - now)
      }));

      // Update shared cache
      sharedCache = {
        buildQueue: buildQueueWithCountdown,
        techCounts: statusResult.techCounts,
        weapons: catalogResult.weapons,
        defenses: catalogResult.defenses,
        lastUpdated: Date.now()
      };

      // Notify all subscribers
      notifySubscribers();
      
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

export const useFactoryDataCache = (pollInterval: number = 5000): UseFactoryDataCacheReturn => {
  // Auth is guaranteed by server component, so we assume authenticated
  const [data, setData] = useState<FactoryDataCache | null>(sharedCache);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateLocalState = useCallback(() => {
    if (isMountedRef.current) {
      setData(sharedCache);
      setIsLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      await fetchFactoryData();
      updateLocalState();
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch factory data');
        setIsLoading(false);
      }
    }
  }, [updateLocalState]);

  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe to cache updates
    cacheSubscribers.add(updateLocalState);

    // If we already have cached data, use it immediately
    if (sharedCache) {
      setData(sharedCache);
      setIsLoading(false);
    } else {
      // Initial fetch
      fetchData();
    }

    // Set up polling interval (only one active interval across all hooks)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(fetchData, pollInterval);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      cacheSubscribers.delete(updateLocalState);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollInterval, fetchData, updateLocalState]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch
  };
};