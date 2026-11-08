import { useState, useEffect, useRef, useCallback } from 'react';
import { WorldData } from '@shared/types/gameTypes';
import { updateAllObjectPositionsWithTimeCorrection } from '@shared/physics';
import { worldDataService } from '../services/worldDataService';
import { getTimeMultiplier } from '../timeMultiplier';
import { startVisibilityAwarePolling } from '../polling/visibilityPolling';

interface UseWorldDataReturn {
  worldData: WorldData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdateTime: number | null;
}

interface WorldDataState extends WorldData {
  responseReceivedAt?: number;
  roundTripTime?: number;
}

export const useWorldData = (pollInterval: number = 3000): UseWorldDataReturn => {
  const [worldData, setWorldData] = useState<WorldDataState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);

  const fetchWorldData = useCallback((initialRetryCount: number = 0) => {
    const attempt = async (retryCount: number): Promise<void> => {
      try {
        setError(null);
        const result = await worldDataService.getWorldData();
        
        if (!isMountedRef.current) return;
        
        if (!result.success) {
          if (result.error.includes('Network error') && retryCount < 3) {
            console.log(`Retrying world data fetch (attempt ${retryCount + 1}/3)...`);
            setTimeout(() => attempt(retryCount + 1), 2000);
            return;
          }
          setError(result.error);
          setIsLoading(false);
          return;
        }
        
        // Apply time correction to server data to account for network latency and clock drift
        // This ensures the positions are accurate for the current moment.
        // NPC ships are excluded — they use renderer-side orbit interpolation.
        const allObjects = result.data.data.spaceObjects;
        const npcObjects = allObjects.filter(obj => obj.type === 'npc_ship');
        const nonNpcObjects = allObjects.filter(obj => obj.type !== 'npc_ship');
        const correctedNonNpc = updateAllObjectPositionsWithTimeCorrection(
          nonNpcObjects,
          Date.now(),
          result.data.responseReceivedAt,
          result.data.roundTripTime,
          result.data.data.worldSize,
          50,
          getTimeMultiplier()
        );
        
        // Extract timing information and merge with corrected world data
        const worldDataWithTiming: WorldDataState = {
          ...result.data.data,
          spaceObjects: [...correctedNonNpc, ...npcObjects],
          responseReceivedAt: result.data.responseReceivedAt,
          roundTripTime: result.data.roundTripTime
        };
        
        setWorldData(worldDataWithTiming);
        setLastUpdateTime(result.data.responseReceivedAt);
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
            setTimeout(() => attempt(retryCount + 1), 2000);
            return;
          }
          setError('Failed to fetch world data');
          setIsLoading(false);
        }
      }
    };
    return attempt(initialRetryCount);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    void fetchWorldData();
    
    // Server polling, paused while the page is hidden
    const stopPolling = startVisibilityAwarePolling(() => void fetchWorldData(), pollInterval);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [pollInterval, fetchWorldData]);

  return {
    worldData, // Latest server snapshot; the game projects positions per animation frame (worldProjection)
    isLoading,
    error,
    refetch: fetchWorldData,
    lastUpdateTime
  };
};
