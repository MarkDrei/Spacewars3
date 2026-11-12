import { useEffect, useCallback } from 'react';
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

// Stable empty defaults so consumers' memo/effect dependencies don't change on every render
const EMPTY_WEAPONS: Record<string, WeaponSpec> = {};
const EMPTY_DEFENSES: Record<string, DefenseSpec> = {};

export const useTechCounts = (pollInterval: number = 5000): UseTechCountsReturn => {
  // Use shared factory data cache
  const { 
    data: factoryData, 
    isLoading: cacheLoading, 
    error: cacheError,
    refetch: refetchCache
  } = useFactoryDataCache(pollInterval);

  // Derived directly from the shared cache (auth is guaranteed by the server component)
  const techCounts: TechCounts | null = factoryData?.techCounts ?? null;
  const weapons: Record<string, WeaponSpec> = factoryData?.weapons ?? EMPTY_WEAPONS;
  const defenses: Record<string, DefenseSpec> = factoryData?.defenses ?? EMPTY_DEFENSES;

  useEffect(() => {
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
      globalEvents.off(EVENTS.BUILD_ITEM_COMPLETED, handleBuildItemCompleted);
      globalEvents.off(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildQueueCompleted);
    };
  }, [refetchCache]);

  // Refetch function
  const refetch = useCallback(() => {
    refetchCache();
  }, [refetchCache]);

  return {
    techCounts,
    weapons,
    defenses,
    isLoading: cacheLoading,
    error: cacheError,
    refetch
  };
};