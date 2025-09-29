import { useState, useEffect, useRef, useCallback } from 'react';
import { researchService, TechTree } from '../services/researchService';

interface UseResearchStatusResult {
  techTree: TechTree | null;
  isResearchActive: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useResearchStatus = (isLoggedInParam: boolean | number = true, pollInterval: number = 5000): UseResearchStatusResult => {
  // Handle both old (boolean, number) and new (number) signature
  const actualPollInterval = typeof isLoggedInParam === 'number' ? isLoggedInParam : pollInterval;
  const [techTree, setTechTree] = useState<TechTree | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTechTree = useCallback(async (retryCount: number = 0) => {
    try {
      setError(null);
      const result = await researchService.getTechTree();
      
      if (!isMountedRef.current) return;

      if ('error' in result) {
        if (retryCount < 3) {
          console.log(`Retrying tech tree fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchTechTree(retryCount + 1), 2000);
          return;
        }
        setError(result.error);
        setTechTree(null);
      } else {
        setTechTree(result.techTree);
        setError(null);
      }
      
      setIsLoading(false);
      
    } catch (error) {
      console.error('Network error during getTechTree:', error);
      if (!isMountedRef.current) return;
      
      if (retryCount < 3) {
        console.log(`Retrying tech tree fetch (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => fetchTechTree(retryCount + 1), 2000);
        return;
      }
      
      setError('Failed to fetch research status');
      setTechTree(null);
      setIsLoading(false);
    }
  }, []); // Empty dependency array since it doesn't depend on changing values

  const startPolling = useCallback(() => {
    if (!isMountedRef.current) return;
    
    pollTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        fetchTechTree();
        startPolling(); // Schedule next poll
      }
    }, actualPollInterval);
  }, [actualPollInterval, fetchTechTree]);

  const refetch = () => {
    setIsLoading(true);
    fetchTechTree();
  };

  // Initial fetch (auth guaranteed by server component)
  useEffect(() => {

    setIsLoading(true);
    fetchTechTree();
    startPolling();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [pollInterval, fetchTechTree, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const isResearchActive = techTree ? researchService.isResearchActive(techTree) : false;

  return {
    techTree,
    isResearchActive,
    isLoading,
    error,
    refetch
  };
};
