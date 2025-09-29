import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  WeaponSpec, 
  DefenseSpec, 
  TechCounts 
} from '../services/factoryService';
import { globalEvents, EVENTS } from '../services/eventService';
import { useFactoryDataCache } from './useFactoryDataCache';

interface UseTechCountsReturn {
  techCounts: TechCounts | null;
  weapons: Record<string, WeaponSpec>;
  defenses: Record<string, DefenseSpec>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTechCounts = (isLoggedInParam: boolean | number = true, pollInterval: number = 5000): UseTechCountsReturn => {
  // Handle both old (boolean, number) and new (number) signature
  const isLoggedIn = typeof isLoggedInParam === 'boolean' ? isLoggedInParam : true;
  const actualPollInterval = typeof isLoggedInParam === 'number' ? isLoggedInParam : pollInterval;
  const [techCounts, setTechCounts] = useState<TechCounts | null>(null);
  const [weapons, setWeapons] = useState<Record<string, WeaponSpec>>({});
  const [defenses, setDefenses] = useState<Record<string, DefenseSpec>>({});

  // Use shared factory data cache
  const { 
    data: factoryData, 
    isLoading: cacheLoading, 
    error: cacheError,
    refetch: refetchCache
  } = useFactoryDataCache(actualPollInterval);

  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);

  // Update local state from cache data
  useEffect(() => {
    if (!factoryData) {
      if (!isLoggedIn) {
        setTechCounts(null);
        setWeapons({});
        setDefenses({});
      }
      return;
    }

    // Update all data from cache
    setTechCounts(factoryData.techCounts);
    setWeapons(factoryData.weapons);
    setDefenses(factoryData.defenses);
  }, [factoryData, isLoggedIn]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Listen for build completion events to refresh tech counts
    const handleBuildItemCompleted = () => {
      console.log('Build item completed, refreshing tech counts...');
      refetchCache();
    };
    
    const handleBuildQueueCompleted = () => {
      console.log('Build queue completed, refreshing tech counts...');
      refetchCache();
    };
    
    globalEvents.on(EVENTS.BUILD_ITEM_COMPLETED, handleBuildItemCompleted);
    globalEvents.on(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildQueueCompleted);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      globalEvents.off(EVENTS.BUILD_ITEM_COMPLETED, handleBuildItemCompleted);
      globalEvents.off(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildQueueCompleted);
    };
  }, [refetchCache]);

  // Refetch function
  const refetch = useCallback(() => {
    if (!isLoggedIn) return;
    refetchCache();
  }, [isLoggedIn, refetchCache]);

  return {
    techCounts,
    weapons,
    defenses,
    isLoading: cacheLoading,
    error: cacheError,
    refetch
  };
};