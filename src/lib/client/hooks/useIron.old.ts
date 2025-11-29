import { useState, useEffect, useRef, useCallback } from 'react';
import { userStatsService } from '../services/userStatsService';
import { globalEvents, EVENTS } from '../services/eventService';

interface UseIronReturn {
  ironAmount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useIron = (pollInterval: number = 5000): UseIronReturn => {
  const [serverIronAmount, setServerIronAmount] = useState<number>(0);
  const [ironPerSecond, setIronPerSecond] = useState<number>(0);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(Date.now());
  const [displayIronAmount, setDisplayIronAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  
  // Use ref to track if display interval is already started
  const displayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchIron = useCallback(async (retryCount: number = 0) => {
    try {
      setError(null);
      const result = await userStatsService.getUserStats();
      
      if (!isMountedRef.current) return; // Component unmounted
      
      if ('error' in result) {
        // If it's a connection error and we haven't retried too much, retry
        if (result.error.includes('Network error') && retryCount < 3) {
          console.log(`Retrying iron fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchIron(retryCount + 1), 2000); // Retry after 2 seconds
          return;
        }
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Update server data
      setServerIronAmount(result.iron);
      setIronPerSecond(result.ironPerSecond);
      setLastServerUpdate(Date.now()); // Use current time when we received the response
      setDisplayIronAmount(Math.floor(result.iron)); // Ensure integer display
      setIsLoading(false);
      
      // // Debug: Log what we received from the server
      // console.log('📊 Server response:', {
      //   iron: result.iron,
      //   ironPerSecond: result.ironPerSecond,
      //   receivedAt: Date.now(),
      //   timestamp: new Date().toISOString()
      // });
    } catch {
      if (isMountedRef.current) {
        // If it's initial load and we haven't retried much, retry
        if (retryCount < 3) {
          console.log(`Retrying iron fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchIron(retryCount + 1), 2000); // Retry after 2 seconds
          return;
        }
        setError('Failed to fetch iron amount');
        setIsLoading(false);
      }
    }
  }, []); // Empty dependency array since fetchIron doesn't depend on any changing values

  // Update displayed iron amount based on time elapsed and iron per second
  const updateDisplayIron = useCallback(() => {
    // Only update if we have valid server data and iron production rate
    if (serverIronAmount >= 0 && ironPerSecond > 0 && !error) {
      const nowMs = Date.now();
      const secondsElapsed = (nowMs - lastServerUpdate) / 1000;
      const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));

      // // Debug output
      // console.debug('[useIron] updateDisplayIron:', {
      //   serverIronAmount,
      //   ironPerSecond,
      //   lastServerUpdate,
      //   now: nowMs,
      //   secondsElapsed,
      //   predictedIron,
      //   displayIronAmount,
      //   error
      // });

      // Only update if the predicted value is different from current display
      if (predictedIron !== displayIronAmount) {
        setDisplayIronAmount(predictedIron);
      }
    }
  }, [serverIronAmount, ironPerSecond, lastServerUpdate, displayIronAmount, error]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchIron();
    
    // Set up server polling
    const serverInterval = setInterval(fetchIron, pollInterval);
    
    // Listen for iron update events (e.g., after research trigger)
    const handleIronUpdate = () => {
      fetchIron();
    };
    
    globalEvents.on(EVENTS.IRON_UPDATED, handleIronUpdate);
    globalEvents.on(EVENTS.RESEARCH_TRIGGERED, handleIronUpdate);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearInterval(serverInterval);
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
      globalEvents.off(EVENTS.IRON_UPDATED, handleIronUpdate);
      globalEvents.off(EVENTS.RESEARCH_TRIGGERED, handleIronUpdate);
    };
  }, [pollInterval, fetchIron]);

  // Start display interval after data is loaded
  useEffect(() => {
    if (isLoading || error || ironPerSecond <= 0) {
      return;
    }
    
    // Only start interval if not already started
    if (!displayIntervalRef.current) {
      displayIntervalRef.current = setInterval(updateDisplayIron, 100);
    }
    
    return () => {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
    };
  }, [isLoading, error, ironPerSecond, updateDisplayIron]);

  return {
    ironAmount: displayIronAmount,
    isLoading,
    error,
    refetch: fetchIron
  };
};
