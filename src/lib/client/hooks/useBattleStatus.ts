// ---
// useBattleStatus hook - Get current battle state
// ---

import { useState, useEffect } from 'react';
import type { WeaponCooldowns, BattleStats, BattleEvent } from '@/shared/battleTypes';

export interface BattleStatus {
  inBattle: boolean;
  battle?: {
    id: number;
    isAttacker: boolean;
    opponentId: number;
    battleStartTime: number;
    battleEndTime: number | null;
    winnerId: number | null;
    loserId: number | null;
    myStats: BattleStats;
    opponentStats: BattleStats;
    weaponCooldowns: WeaponCooldowns;
    battleLog: BattleEvent[];
  };
}

export function useBattleStatus(refreshInterval: number = 5000) {
  const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBattleStatus = async () => {
    try {
      const response = await fetch('/api/battle-status');
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not authenticated');
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: BattleStatus = await response.json();
      setBattleStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch battle status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBattleStatus();
    
    // Set up polling
    const interval = setInterval(fetchBattleStatus, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return {
    battleStatus,
    isLoading,
    error,
    refetch: fetchBattleStatus
  };
}
