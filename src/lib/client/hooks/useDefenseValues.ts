import { useState, useEffect, useRef, useCallback } from 'react';
import { getShipStats } from '../services/shipStatsService';
import { DefenseValues } from '@/shared/defenseValues';
import { globalEvents, EVENTS } from '../services/eventService';

interface UseDefenseValuesReturn {
  defenseValues: DefenseValues | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useDefenseValues = (pollInterval: number = 2000): UseDefenseValuesReturn => {
  const [defenseValues, setDefenseValues] = useState<DefenseValues | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);

  const fetchDefenseValues = useCallback(async (retryCount: number = 0) => {
    try {
      setError(null);
      const result = await getShipStats();
      
      if (!isMountedRef.current) return; // Component unmounted
      
      if ('error' in result) {
        // If it's a connection error and we haven't retried too much, retry
        if (result.error.includes('Network error') && retryCount < 3) {
          console.log(`Retrying defense values fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchDefenseValues(retryCount + 1), 2000); // Retry after 2 seconds
          return;
        }
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Update defense values directly from server (no client-side regeneration)
      setDefenseValues(result.defenseValues);
      setIsLoading(false);
    } catch {
      if (isMountedRef.current) {
        // If it's initial load and we haven't retried much, retry
        if (retryCount < 3) {
          console.log(`Retrying defense values fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchDefenseValues(retryCount + 1), 2000); // Retry after 2 seconds
          return;
        }
        setError('Failed to fetch defense values');
        setIsLoading(false);
      }
    }
  }, []); // Empty dependency array since fetchDefenseValues doesn't depend on any changing values

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchDefenseValues();
    
    // Set up server polling every 1-2 seconds for smooth updates
    // Server now handles regeneration, client just displays latest values
    const serverInterval = setInterval(fetchDefenseValues, pollInterval);
    
    // Listen for build completion events to refresh defense values
    const handleBuildCompleted = () => {
      console.log('Build completed, refreshing defense values...');
      fetchDefenseValues();
    };
    
    globalEvents.on(EVENTS.BUILD_ITEM_COMPLETED, handleBuildCompleted);
    globalEvents.on(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildCompleted);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearInterval(serverInterval);
      globalEvents.off(EVENTS.BUILD_ITEM_COMPLETED, handleBuildCompleted);
      globalEvents.off(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildCompleted);
    };
  }, [pollInterval, fetchDefenseValues]);

  return {
    defenseValues,
    isLoading,
    error,
    refetch: fetchDefenseValues
  };
};
