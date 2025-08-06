import { useState, useEffect, useRef, useCallback } from 'react';
import { WorldData } from '../../../shared/src/types/gameTypes';
import { updateAllObjectPositions } from '../../../shared/src/physics';
import { worldDataService } from '../services/worldDataService';

interface UseWorldDataReturn {
  worldData: WorldData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useWorldData = (isLoggedIn: boolean, pollInterval: number = 3000): UseWorldDataReturn => {
  const [worldData, setWorldData] = useState<WorldData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Optimistic position updates for smooth animation using shared physics logic
  const updateOptimisticPositions = useCallback((data: WorldData): WorldData => {
    if (!data) return data;
    
    const now = Date.now();
    
    // For incremental optimistic updates, we need to use the CURRENT positions and timestamps
    // from the data (which already includes previous optimistic updates)
    // NOT the original server data
    
    const updatedObjects = updateAllObjectPositions(
      data.spaceObjects, // Use current positions with their current timestamps
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
      
      // Update server timestamp and reset optimistic tracking
      // No longer needed - positions and timestamps are preserved in state
      
      setWorldData(result.data);
      setIsLoading(false);
      
      // console.log('🌍 World data updated:', {
      //   objects: result.data.spaceObjects.length,
      //   worldSize: result.data.worldSize,
      //   receivedAt: new Date().toISOString()
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
    if (!worldData || !isLoggedIn) return;
    
    const optimisticUpdateInterval = setInterval(() => {
      setWorldData(currentData => {
        if (!currentData) return currentData;
        return updateOptimisticPositions(currentData);
      });
    }, 16); // Update positions every 16ms (60fps) for smooth animation

    return () => {
      clearInterval(optimisticUpdateInterval);
    };
  }, [worldData, isLoggedIn, updateOptimisticPositions]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only fetch data if user is logged in
    if (!isLoggedIn) {
      setIsLoading(false);
      setError(null);
      setWorldData(null);
      return;
    }
    
    // Initial fetch
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
  }, [isLoggedIn, pollInterval, fetchWorldData]);

  return {
    worldData, // Return worldData directly - optimistic updates are already applied in setInterval
    isLoading,
    error,
    refetch: fetchWorldData
  };
};
