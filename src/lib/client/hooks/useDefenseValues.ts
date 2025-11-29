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
  // Server values fetched from API
  const [serverDefenseValues, setServerDefenseValues] = useState<DefenseValues | null>(null);
  // Interpolated values displayed to user (updated multiple times per second)
  const [displayDefenseValues, setDisplayDefenseValues] = useState<DefenseValues | null>(null);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  const interpolationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Update server defense values and timestamp
      setServerDefenseValues(result.defenseValues);
      setDisplayDefenseValues(result.defenseValues);
      setLastServerUpdate(Date.now());
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

  // Interpolation function to smoothly update display values between server polls
  const updateDisplayValues = useCallback(() => {
    if (!serverDefenseValues || error) return;

    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;

    // Calculate interpolated values based on time elapsed since last server update
    const interpolateValue = (defense: { current: number; max: number; regenRate: number }) => {
      const interpolated = defense.current + (secondsElapsed * defense.regenRate);
      return Math.min(Math.floor(interpolated), defense.max);
    };

    setDisplayDefenseValues({
      hull: {
        ...serverDefenseValues.hull,
        current: interpolateValue(serverDefenseValues.hull)
      },
      armor: {
        ...serverDefenseValues.armor,
        current: interpolateValue(serverDefenseValues.armor)
      },
      shield: {
        ...serverDefenseValues.shield,
        current: interpolateValue(serverDefenseValues.shield)
      }
    });
  }, [serverDefenseValues, lastServerUpdate, error]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchDefenseValues();
    
    // Set up server polling to get authoritative values
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
      if (interpolationIntervalRef.current) {
        clearInterval(interpolationIntervalRef.current);
      }
      globalEvents.off(EVENTS.BUILD_ITEM_COMPLETED, handleBuildCompleted);
      globalEvents.off(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildCompleted);
    };
  }, [pollInterval, fetchDefenseValues]);

  // Set up smooth interpolation updates (multiple times per second)
  useEffect(() => {
    if (isLoading || error || !serverDefenseValues) {
      return;
    }

    // Update display values immediately
    updateDisplayValues();

    // Set up interval to update display values smoothly (10 times per second)
    if (!interpolationIntervalRef.current) {
      interpolationIntervalRef.current = setInterval(updateDisplayValues, 100);
    }

    return () => {
      if (interpolationIntervalRef.current) {
        clearInterval(interpolationIntervalRef.current);
        interpolationIntervalRef.current = null;
      }
    };
  }, [isLoading, error, serverDefenseValues, updateDisplayValues]);

  return {
    defenseValues: displayDefenseValues,
    isLoading,
    error,
    refetch: fetchDefenseValues
  };
};
