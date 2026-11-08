import { useState, useEffect, useRef, useCallback } from 'react';
import { researchService, TechTree } from '../services/researchService';

interface UseResearchStatusResult {
  techTree: TechTree | null;
  isResearchActive: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

type TechTreeResult = { techTree: TechTree } | { error: string };

/**
 * Loads the tech tree, retrying up to MAX_RETRIES times (2 s apart) while `isActive()` holds.
 * Resolves with the tech tree or the final error message; never rejects.
 */
const requestTechTree = async (isActive: () => boolean, retryCount: number = 0): Promise<TechTreeResult> => {
  let errorMessage: string;
  try {
    const result = await researchService.getTechTree();
    if (!('error' in result)) {
      return { techTree: result.techTree };
    }
    errorMessage = result.error;
  } catch (err) {
    console.error('Network error during getTechTree:', err);
    errorMessage = 'Failed to fetch research status';
  }

  if (retryCount < MAX_RETRIES && isActive()) {
    console.log(`Retrying tech tree fetch (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    return requestTechTree(isActive, retryCount + 1);
  }
  return { error: errorMessage };
};

export const useResearchStatus = (pollInterval: number = 5000): UseResearchStatusResult => {
  const [techTree, setTechTree] = useState<TechTree | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(false);

  // Fetches and applies the result in a callback (never sets state synchronously)
  const loadTechTree = useCallback(() => {
    const isActive = () => isMountedRef.current;
    return requestTechTree(isActive).then(result => {
      if (!isActive()) return;
      if ('error' in result) {
        setError(result.error);
        setTechTree(null);
      } else {
        setTechTree(result.techTree);
        setError(null);
      }
      setIsLoading(false);
    });
  }, []);

  // Initial fetch + polling (auth guaranteed by server component)
  useEffect(() => {
    isMountedRef.current = true;
    void loadTechTree();
    const interval = setInterval(loadTechTree, pollInterval);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [pollInterval, loadTechTree]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    void loadTechTree();
  }, [loadTechTree]);

  const isResearchActive = techTree ? researchService.isResearchActive(techTree) : false;

  return {
    techTree,
    isResearchActive,
    isLoading,
    error,
    refetch
  };
};
