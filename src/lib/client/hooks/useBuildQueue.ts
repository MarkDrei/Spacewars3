import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { factoryService, BuildQueueItem } from '../services/factoryService';
import { globalEvents, EVENTS } from '../services/eventService';
import { useFactoryDataCache } from './useFactoryDataCache';

interface UseBuildQueueReturn {
  buildQueue: BuildQueueItem[];
  isLoading: boolean;
  isBuilding: boolean;
  isCompletingBuild: boolean;
  isAbortingQueue: boolean;
  error: string | null;
  buildItem: (itemKey: string, itemType: 'weapon' | 'defense', count?: number, mode?: 'normal' | 'forever') => Promise<void>;
  completeBuild: () => Promise<void>;
  abortBuildQueue: () => Promise<void>;
  refetch: () => void;
}

const EMPTY_QUEUE: BuildQueueItem[] = [];

export const useBuildQueue = (pollInterval: number = 5000): UseBuildQueueReturn => {
  // Auth is guaranteed by server component, so we can directly use the factory data cache
  // Current time in seconds, advanced by the countdown interval (null until the first tick)
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [isCompletingBuild, setIsCompletingBuild] = useState<boolean>(false);
  const [isAbortingQueue, setIsAbortingQueue] = useState<boolean>(false);
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
  
  // Track previous queue length to detect events
  const previousQueueLengthRef = useRef<number>(0);

  const serverQueue = factoryData?.buildQueue ?? EMPTY_QUEUE;
  const serverQueueRef = useRef<BuildQueueItem[]>(serverQueue);

  // Remaining time is derived from the server queue and the ticking clock. The server value
  // (computed at fetch time) caps it, so a clock tick older than the fetch never shows more time.
  const buildQueue = useMemo<BuildQueueItem[]>(() => {
    if (nowSeconds === null) return serverQueue;
    return serverQueue.map(item => ({
      ...item,
      remainingSeconds: Math.min(item.remainingSeconds, Math.max(0, item.completionTime - nowSeconds))
    }));
  }, [serverQueue, nowSeconds]);

  // Emit build events when the server-confirmed queue changes
  useEffect(() => {
    serverQueueRef.current = serverQueue;
    if (!factoryData) return;

    const newQueue = factoryData.buildQueue;
    const previousLength = previousQueueLengthRef.current;

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
  }, [factoryData, serverQueue]);

  // Combine cache error with local error
  const combinedError = error || cacheError;

  // Build item function
  const buildItem = useCallback(async (
    itemKey: string,
    itemType: 'weapon' | 'defense',
    count: number = 1,
    mode: 'normal' | 'forever' = 'normal'
  ) => {
    if (isBuilding) return;

    setIsBuilding(true);
    setError(null);

    try {
      const result = await factoryService.buildItem(itemKey, itemType, count, mode);

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
        setError(mode === 'forever' ? 'Failed to start forever build' : 'Failed to start building item');
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

  const abortBuildQueue = useCallback(async () => {
    if (isAbortingQueue || buildQueue.length === 0) return;

    setIsAbortingQueue(true);
    setError(null);

    try {
      const result = await factoryService.abortBuildQueue();

      if (!isMountedRef.current) return;

      if ('error' in result) {
        setError(result.error);
        return;
      }

      refetchCache();
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to abort build queue');
        console.error('Error aborting build queue:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsAbortingQueue(false);
      }
    }
  }, [isAbortingQueue, buildQueue.length, refetchCache]);

  // Initialize mounted ref
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Tick the countdown once per second while a queue is active
  const hasActiveQueue = !cacheLoading && !combinedError && serverQueue.length > 0;
  useEffect(() => {
    if (!hasActiveQueue) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setNowSeconds(now);

      // A build finished locally: refresh to get the updated queue from the server
      if (serverQueueRef.current.some(item => item.completionTime <= now)) {
        refetchCache();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveQueue, refetchCache]);

  // Refetch function
  const refetch = useCallback(() => {
    refetchCache();
  }, [refetchCache]);

  return {
    buildQueue,
    isLoading: cacheLoading,
    isBuilding,
    isCompletingBuild,
    isAbortingQueue,
    error: combinedError,
    buildItem,
    completeBuild,
    abortBuildQueue,
    refetch
  };
};
