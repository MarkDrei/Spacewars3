import { useState, useEffect, useRef, useCallback } from 'react';
import { factoryService, BuildQueueItem } from '../services/factoryService';
import { globalEvents, EVENTS } from '../services/eventService';
import { useFactoryDataCache } from './useFactoryDataCache';

interface UseBuildQueueReturn {
  buildQueue: BuildQueueItem[];
  isLoading: boolean;
  isBuilding: boolean;
  isCompletingBuild: boolean;
  error: string | null;
  buildItem: (itemKey: string, itemType: 'weapon' | 'defense') => Promise<void>;
  completeBuild: () => Promise<void>;
  refetch: () => void;
}

export const useBuildQueue = (pollInterval: number = 5000): UseBuildQueueReturn => {
  // Auth is guaranteed by server component, so we can directly use the factory data cache
  const [buildQueue, setBuildQueue] = useState<BuildQueueItem[]>([]);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [isCompletingBuild, setIsCompletingBuild] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use shared factory data cache
  const { 
    data: factoryData, 
    isLoading: cacheLoading, 
    error: cacheError,
    refetch: refetchCache
  } = useFactoryDataCache(pollInterval);

  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  
  // Use ref to track countdown interval
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track previous queue length to detect events
  const previousQueueLengthRef = useRef<number>(0);

  // Update build queue from cache data and emit events
  useEffect(() => {
    if (!factoryData) return;

    const newQueue = factoryData.buildQueue;
    const previousLength = previousQueueLengthRef.current;

    // Update local build queue state
    setBuildQueue(newQueue);

    // Emit events based on queue changes (only after server confirmation)
    if (previousLength === 0 && newQueue.length > 0) {
      // Queue started (first item added to empty queue)
      globalEvents.emit(EVENTS.BUILD_QUEUE_STARTED, { queueLength: newQueue.length });
    } else if (previousLength > 0 && newQueue.length === 0) {
      // Queue completed (queue became empty)
      globalEvents.emit(EVENTS.BUILD_QUEUE_COMPLETED);
      globalEvents.emit(EVENTS.IRON_UPDATED); // Builds may affect iron through rewards
    } else if (previousLength > newQueue.length && newQueue.length >= 0) {
      // Individual build completed
      globalEvents.emit(EVENTS.BUILD_ITEM_COMPLETED, { 
        remainingItems: newQueue.length 
      });
      globalEvents.emit(EVENTS.IRON_UPDATED); // Build completion may affect iron
    }

    // Update previous queue length for next comparison
    previousQueueLengthRef.current = newQueue.length;
  }, [factoryData]);

  // Combine cache error with local error
  const combinedError = error || cacheError;

  // Update countdown timer for build queue
  const updateCountdown = useCallback(() => {
    setBuildQueue(prevQueue => {
      if (prevQueue.length === 0) return prevQueue;
      
      const now = Math.floor(Date.now() / 1000);
      const updatedQueue = prevQueue.map(item => ({
        ...item,
        remainingSeconds: Math.max(0, item.completionTime - now)
      }));

      // Check if any builds completed
      const hasCompleted = updatedQueue.some(item => item.remainingSeconds <= 0);
      if (hasCompleted) {
        // Refresh data to get updated queue from server
        refetchCache();
      }

      return updatedQueue;
    });
  }, [refetchCache]);

  // Build item function
  const buildItem = useCallback(async (itemKey: string, itemType: 'weapon' | 'defense') => {
    if (isBuilding) return;

    setIsBuilding(true);
    setError(null);

    try {
      const result = await factoryService.buildItem(itemKey, itemType);

      if (!isMountedRef.current) return;

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Refresh data after successful build (server confirmation)
      refetchCache();
      
      // Iron updated by build action
      globalEvents.emit(EVENTS.IRON_UPDATED);
      
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to start building item');
        console.error('Error building item:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsBuilding(false);
      }
    }
  }, [isBuilding, refetchCache]);

  // Complete build function (cheat mode)
  const completeBuild = useCallback(async () => {
    if (isCompletingBuild || buildQueue.length === 0) return;

    setIsCompletingBuild(true);
    setError(null);

    try {
      const result = await factoryService.completeBuild();

      if (!isMountedRef.current) return;

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Refresh data after successful completion (server confirmation)
      refetchCache();
      
      // Iron may be updated by build completion
      globalEvents.emit(EVENTS.IRON_UPDATED);
      
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to complete build');
        console.error('Error completing build:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsCompletingBuild(false);
      }
    }
  }, [isCompletingBuild, buildQueue.length, refetchCache]);

  // Initialize mounted ref
  useEffect(() => {
    isMountedRef.current = true;
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // Start countdown interval after data is loaded
  useEffect(() => {
    if (cacheLoading || combinedError || buildQueue.length === 0) {
      // Clear countdown if no queue or error
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }
    
    // Only start countdown interval if not already started
    if (!countdownIntervalRef.current) {
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    }
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [cacheLoading, combinedError, buildQueue.length, updateCountdown]);

  // Refetch function
  const refetch = useCallback(() => {
    refetchCache();
  }, [refetchCache]);

  return {
    buildQueue,
    isLoading: cacheLoading,
    isBuilding,
    isCompletingBuild,
    error: combinedError,
    buildItem,
    completeBuild,
    refetch
  };
};