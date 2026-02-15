import { useState, useEffect, useRef, useCallback } from 'react';
import { userStatsService } from '../../services/userStatsService';
import { globalEvents, EVENTS } from '../../services/eventService';
import { calculatePredictedIron, shouldUpdateDisplay, type IronData } from './ironCalculations';
import { shouldRetryFetch, scheduleRetry, DEFAULT_RETRY_CONFIG } from './retryLogic';
import { setupPolling, cancelPolling } from './pollingUtils';
import { setTimeMultiplier, getTimeMultiplier } from '../../timeMultiplier';

interface UseIronReturn {
  ironAmount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  xp: number;
  level: number;
  xpForNextLevel: number;
  timeMultiplier: number;
}

export const useIron = (pollInterval: number = 5000): UseIronReturn => {
  const [ironData, setIronData] = useState<IronData>({
    serverAmount: 0,
    ironPerSecond: 0,
    lastUpdateTime: Date.now(),
    maxCapacity: 5000 // Default to base capacity
  });
  const [displayIronAmount, setDisplayIronAmount] = useState<number>(0);
  const [xpData, setXpData] = useState({ xp: 0, level: 1, xpForNextLevel: 1000 });
  const [currentTimeMultiplier, setCurrentTimeMultiplier] = useState<number>(1);
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
        // Check if we should retry
        const retryDecision = shouldRetryFetch(result.error, retryCount, DEFAULT_RETRY_CONFIG);
        
        if (retryDecision.shouldRetry) {
          console.log(`Retrying iron fetch (attempt ${retryDecision.nextRetryCount}/${DEFAULT_RETRY_CONFIG.maxRetries})...`);
          scheduleRetry(() => fetchIron(retryDecision.nextRetryCount), DEFAULT_RETRY_CONFIG.retryDelay);
          return;
        }
        
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Update server data
      const newData: IronData = {
        serverAmount: result.iron,
        ironPerSecond: result.ironPerSecond,
        lastUpdateTime: Date.now(),
        maxCapacity: result.maxIronCapacity
      };
      
      // Store time multiplier in module-level state for other hooks to use
      const multiplier = result.timeMultiplier ?? 1;
      setTimeMultiplier(multiplier);
      setCurrentTimeMultiplier(multiplier);
      
      setIronData(newData);
      setDisplayIronAmount(Math.floor(result.iron));
      setXpData({
        xp: result.xp,
        level: result.level,
        xpForNextLevel: result.xpForNextLevel
      });
      setIsLoading(false);
    } catch (err) {
      if (isMountedRef.current) {
        // Check if we should retry on exception
        const retryDecision = shouldRetryFetch('Network error', retryCount, DEFAULT_RETRY_CONFIG);
        
        if (retryDecision.shouldRetry) {
          console.log(`Retrying iron fetch (attempt ${retryDecision.nextRetryCount}/${DEFAULT_RETRY_CONFIG.maxRetries})...`);
          scheduleRetry(() => fetchIron(retryDecision.nextRetryCount), DEFAULT_RETRY_CONFIG.retryDelay);
          return;
        }
        
        setError('Failed to fetch iron amount: ' + (err as Error).message);
        setIsLoading(false);
      }
    }
  }, []); // Empty dependency array since fetchIron doesn't depend on any changing values

  // Update displayed iron amount based on time elapsed and iron per second
  const updateDisplayIron = useCallback(() => {
    // Only update if we have valid data and production rate
    if (ironData.serverAmount >= 0 && ironData.ironPerSecond > 0 && !error) {
      const predicted = calculatePredictedIron(ironData, Date.now(), getTimeMultiplier());
      
      if (shouldUpdateDisplay(displayIronAmount, predicted)) {
        setDisplayIronAmount(predicted);
      }
    }
  }, [ironData, displayIronAmount, error]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchIron();
    
    // Set up server polling
    const serverInterval = setupPolling(fetchIron, pollInterval);
    
    // Listen for iron update events (e.g., after research trigger)
    const handleIronUpdate = () => {
      fetchIron();
    };
    
    globalEvents.on(EVENTS.IRON_UPDATED, handleIronUpdate);
    globalEvents.on(EVENTS.RESEARCH_TRIGGERED, handleIronUpdate);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      cancelPolling(serverInterval);
      if (displayIntervalRef.current) {
        cancelPolling(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
      globalEvents.off(EVENTS.IRON_UPDATED, handleIronUpdate);
      globalEvents.off(EVENTS.RESEARCH_TRIGGERED, handleIronUpdate);
    };
  }, [pollInterval, fetchIron]);

  // Start display interval after data is loaded
  useEffect(() => {
    if (isLoading || error || ironData.ironPerSecond <= 0) {
      return;
    }
    
    // Only start interval if not already started
    if (!displayIntervalRef.current) {
      displayIntervalRef.current = setupPolling(updateDisplayIron, 100);
    }
    
    return () => {
      if (displayIntervalRef.current) {
        cancelPolling(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
    };
  }, [isLoading, error, ironData.ironPerSecond, updateDisplayIron]);

  return {
    ironAmount: displayIronAmount,
    isLoading,
    error,
    refetch: fetchIron,
    xp: xpData.xp,
    level: xpData.level,
    xpForNextLevel: xpData.xpForNextLevel,
    timeMultiplier: currentTimeMultiplier
  };
};
