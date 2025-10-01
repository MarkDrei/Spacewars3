import { useState, useEffect, useRef, useCallback } from 'react';
import { WorldData } from '@shared/types/gameTypes';
import { updateAllObjectPositions, updateAllObjectPositionsWithTimeCorrection } from '@shared/physics';
import { worldDataService } from '../services/worldDataService';

interface UseWorldDataReturn {
  worldData: WorldData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface WorldDataState extends WorldData {
  responseReceivedAt?: number;
  roundTripTime?: number;
}

interface UseWorldDataReturn {
  worldData: WorldData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useWorldData = (pollInterval: number = 3000): UseWorldDataReturn => {
  const [worldData, setWorldData] = useState<WorldDataState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Optimistic position updates for smooth animation using shared physics logic
  const updateOptimisticPositions = useCallback((data: WorldDataState): WorldDataState => {
    if (!data) return data;
    
    const now = Date.now();
    
    // Always use standard incremental physics for optimistic updates
    // The time correction is only applied when receiving fresh server data
    const updatedObjects = updateAllObjectPositions(
      data.spaceObjects,
      now,
      data.worldSize
    );
    
    return {
      ...data,
      spaceObjects: updatedObjects,
    };
  }, []);

  const fetchWorldData = useCallback(async (retryCount: number = 0) => {
    try {
      setError(null);
      const result = await worldDataService.getWorldData();
      
      if (!isMountedRef.current) return;
      
      if (!result.success) {
        if (result.error.includes('Network error') && retryCount < 3) {
          console.log(`Retrying world data fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchWorldData(retryCount + 1), 2000);
          return;
        }
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Apply time correction to server data to account for network latency and clock drift
      // This ensures the positions are accurate for the current moment
      const correctedObjects = updateAllObjectPositionsWithTimeCorrection(
        result.data.data.spaceObjects,
        Date.now(),
        result.data.responseReceivedAt,
        result.data.roundTripTime,
        result.data.data.worldSize
      );
      
      // Extract timing information and merge with corrected world data
      const worldDataWithTiming: WorldDataState = {
        ...result.data.data,
        spaceObjects: correctedObjects,
        responseReceivedAt: result.data.responseReceivedAt,
        roundTripTime: result.data.roundTripTime
      };
      
      setWorldData(worldDataWithTiming);
      setIsLoading(false);
      
      // console.log('🌍 World data updated:', {
      //   objects: correctedObjects.length,
      //   worldSize: result.data.data.worldSize,
      //   receivedAt: new Date().toISOString(),
      //   roundTripTime: result.data.roundTripTime
      // });
    } catch {
      if (isMountedRef.current) {
        if (retryCount < 3) {
          console.log(`Retrying world data fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchWorldData(retryCount + 1), 2000);
          return;
        }
        setError('Failed to fetch world data');
        setIsLoading(false);
      }
    }
  }, []);

  // Set up optimistic updates for smooth animation between server updates
  useEffect(() => {
    if (!worldData) return;
    
    const optimisticUpdateInterval = setInterval(() => {
      setWorldData(currentData => {
        if (!currentData) return currentData;
        return updateOptimisticPositions(currentData);
      });
    }, 16); // Update positions every 16ms (60fps) for smooth animation

    return () => {
      clearInterval(optimisticUpdateInterval);
    };
  }, [worldData, updateOptimisticPositions]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchWorldData();
    
    // Set up server polling
    intervalRef.current = setInterval(fetchWorldData, pollInterval);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollInterval, fetchWorldData]);

  return {
    worldData, // Return worldData directly - optimistic updates are already applied in setInterval
    isLoading,
    error,
    refetch: fetchWorldData
  };
};
