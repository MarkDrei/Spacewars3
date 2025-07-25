import { useState, useEffect, useRef } from 'react';
import { userStatsService } from '../services/userStatsService';

interface UseIronReturn {
  ironAmount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useIron = (isLoggedIn: boolean, pollInterval: number = 5000): UseIronReturn => {
  const [serverIronAmount, setServerIronAmount] = useState<number>(0);
  const [ironPerSecond, setIronPerSecond] = useState<number>(0);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(Date.now());
  const [displayIronAmount, setDisplayIronAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);

  const fetchIron = async (retryCount: number = 0) => {
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
      setDisplayIronAmount(result.iron); // Reset display to server value
      setIsLoading(false);
      
    //   // Debug: Log what we received from the server
    //   console.log('📊 Server response:', {
    //     iron: result.iron,
    //     ironPerSecond: result.ironPerSecond,
    //     receivedAt: Date.now(),
    //     timestamp: new Date().toISOString()
    //   });
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
  };

  // Update displayed iron amount based on time elapsed and iron per second
  const updateDisplayIron = () => {
    // Only update if we have valid server data and iron production rate
    if (serverIronAmount >= 0 && ironPerSecond > 0 && !error) {
      const now = Date.now();
      const secondsElapsed = (now - lastServerUpdate) / 1000;
      const predictedIron = Math.floor(serverIronAmount + (secondsElapsed * ironPerSecond));
      
      // Only update if the predicted value is different from current display
      if (predictedIron !== displayIronAmount) {
        setDisplayIronAmount(predictedIron);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only fetch data if user is logged in
    if (!isLoggedIn) {
      setIsLoading(false);
      setError(null);
      setDisplayIronAmount(0);
      return;
    }
    
    // Initial fetch
    fetchIron();
    
    // Set up server polling
    const serverInterval = setInterval(fetchIron, pollInterval);
    
    // Set up display iron updates (every 100ms for smooth updates)
    const displayInterval = setInterval(updateDisplayIron, 100);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearInterval(serverInterval);
      clearInterval(displayInterval);
    };
  }, [isLoggedIn, pollInterval]);

  // Update display iron when server data changes
  useEffect(() => {
    updateDisplayIron();
  }, [serverIronAmount, ironPerSecond, lastServerUpdate, isLoading, error]);

  return {
    ironAmount: displayIronAmount,
    isLoading,
    error,
    refetch: fetchIron
  };
};
