import { useState, useEffect, useRef, useCallback } from 'react';
import { getShipStats } from '../services/shipStatsService';
import { DefenseValues, DefenseValue } from '@/shared/defenseValues';
import { globalEvents, EVENTS } from '../services/eventService';

interface UseDefenseValuesReturn {
  defenseValues: DefenseValues | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useDefenseValues = (pollInterval: number = 5000): UseDefenseValuesReturn => {
  const [serverDefenseValues, setServerDefenseValues] = useState<DefenseValues | null>(null);
  const [displayDefenseValues, setDisplayDefenseValues] = useState<DefenseValues | null>(null);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  
  // Use ref to track if regen interval is already started
  const regenIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Update server data
      setServerDefenseValues(result.defenseValues);
      setLastServerUpdate(Date.now());
      setDisplayDefenseValues(result.defenseValues);
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

  // Update displayed defense values based on time elapsed and regen rate
  const updateDisplayDefenseValues = useCallback(() => {
    // Only update if we have valid server data
    if (serverDefenseValues && !error) {
      const nowMs = Date.now();
      const secondsElapsed = (nowMs - lastServerUpdate) / 1000;

      // Helper function to calculate regenerated value (clamped at max)
      const regenValue = (defense: DefenseValue): DefenseValue => {
        const serverCurrent = defense.current;
        const regenAmount = secondsElapsed * defense.regenRate;
        const newCurrent = Math.min(serverCurrent + regenAmount, defense.max);
        
        return {
          ...defense,
          current: Math.floor(newCurrent) // Ensure integer display
        };
      };

      const newValues: DefenseValues = {
        hull: regenValue(serverDefenseValues.hull),
        armor: regenValue(serverDefenseValues.armor),
        shield: regenValue(serverDefenseValues.shield)
      };

      setDisplayDefenseValues(newValues);
    }
  }, [serverDefenseValues, lastServerUpdate, error]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchDefenseValues();
    
    // Set up server polling
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
      if (regenIntervalRef.current) {
        clearInterval(regenIntervalRef.current);
        regenIntervalRef.current = null;
      }
      globalEvents.off(EVENTS.BUILD_ITEM_COMPLETED, handleBuildCompleted);
      globalEvents.off(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildCompleted);
    };
  }, [pollInterval, fetchDefenseValues]);

  // Start regen interval after data is loaded
  useEffect(() => {
    if (isLoading || error || !serverDefenseValues) {
      return;
    }
    
    // Only start interval if not already started
    if (!regenIntervalRef.current) {
      // Update every second for smooth regeneration
      regenIntervalRef.current = setInterval(updateDisplayDefenseValues, 1000);
    }
    
    return () => {
      if (regenIntervalRef.current) {
        clearInterval(regenIntervalRef.current);
        regenIntervalRef.current = null;
      }
    };
  }, [isLoading, error, serverDefenseValues, updateDisplayDefenseValues]);

  return {
    defenseValues: displayDefenseValues,
    isLoading,
    error,
    refetch: fetchDefenseValues
  };
};
