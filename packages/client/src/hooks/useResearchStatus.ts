import { useState, useEffect, useRef } from 'react';
import { researchService, TechTree } from '../services/researchService';

interface UseResearchStatusResult {
  techTree: TechTree | null;
  isResearchActive: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useResearchStatus = (isLoggedIn: boolean, pollInterval: number = 5000): UseResearchStatusResult => {
  const [techTree, setTechTree] = useState<TechTree | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTechTree = async (retryCount: number = 0) => {
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
  };

  const startPolling = () => {
    if (!isLoggedIn || !isMountedRef.current) return;
    
    pollTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && isLoggedIn) {
        fetchTechTree();
        startPolling(); // Schedule next poll
      }
    }, pollInterval);
  };

  const refetch = () => {
    if (!isLoggedIn) return;
    setIsLoading(true);
    fetchTechTree();
  };

  // Initial fetch when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setTechTree(null);
      setIsLoading(false);
      setError(null);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    fetchTechTree();
    startPolling();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [isLoggedIn, pollInterval]);

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
