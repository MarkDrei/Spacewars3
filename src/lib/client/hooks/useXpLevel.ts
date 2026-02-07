import { useState, useEffect, useRef, useCallback } from 'react';
import { userStatsService } from '../services/userStatsService';

export interface XpLevelData {
  xp: number;
  level: number;
  xpForNextLevel: number;
}

interface UseXpLevelReturn {
  xpData: XpLevelData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useXpLevel = (pollingInterval: number = 5000): UseXpLevelReturn => {
  const [xpData, setXpData] = useState<XpLevelData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef<boolean>(true);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchXpLevel = useCallback(async () => {
    try {
      setError(null);
      const result = await userStatsService.getUserStats();
      
      if (!isMountedRef.current) return;
      
      if ('error' in result) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      const newData: XpLevelData = {
        xp: result.xp,
        level: result.level,
        xpForNextLevel: result.xpForNextLevel
      };
      
      setXpData(newData);
      setIsLoading(false);
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to fetch XP/Level data: ' + (err as Error).message);
        setIsLoading(false);
      }
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchXpLevel();
  }, [fetchXpLevel]);

  // Setup polling
  useEffect(() => {
    if (pollingInterval > 0) {
      pollingTimerRef.current = setInterval(fetchXpLevel, pollingInterval);
    }
    
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [pollingInterval, fetchXpLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    xpData,
    isLoading,
    error,
    refetch: fetchXpLevel
  };
};
