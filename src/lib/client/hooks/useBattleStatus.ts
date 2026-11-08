// ---
// useBattleStatus hook - Get current battle state
// 
// NOTE: This hook returns ONLY battle state (cooldowns, log, timestamps, damage).
// For user defense values (hull/armor/shield), always use the useDefenseValues() hook,
// which fetches from /api/user-stats or /api/ship-stats regardless of battle state.
// ---

import { useState, useEffect, useCallback } from 'react';
import type { WeaponCooldowns, BattleEvent } from '@/lib/server/battle/battleTypes';

export interface BattleStatus {
  inBattle: boolean;
  battle?: {
    id: number;
    isAttacker: boolean;
    opponentId: number;
    opponentName: string;
    battleStartTime: number;
    battleEndTime: number | null;
    winnerId: number | null;
    loserId: number | null;
    weaponCooldowns: WeaponCooldowns;
    battleLog: BattleEvent[];
    myTotalDamage: number;
    opponentTotalDamage: number;
  };
}

const requestBattleStatus = async (): Promise<BattleStatus> => {
  const response = await fetch('/api/battle-status');
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

export function useBattleStatus(refreshInterval: number = 5000) {
  const [battleStatus, setBattleStatus] = useState<BattleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((data: BattleStatus) => {
    setBattleStatus(data);
    setError(null);
    setIsLoading(false);
  }, []);

  const applyError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : 'Unknown error');
    setIsLoading(false);
    console.error('Failed to fetch battle status:', err);
  }, []);

  // Fetch immediately, then poll; results are applied in callbacks and ignored after unmount
  useEffect(() => {
    let active = true;
    const poll = () => {
      requestBattleStatus().then(
        data => { if (active) applyResult(data); },
        err => { if (active) applyError(err); }
      );
    };

    poll();
    const interval = setInterval(poll, refreshInterval);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshInterval, applyResult, applyError]);

  const refetch = useCallback(async () => {
    try {
      applyResult(await requestBattleStatus());
    } catch (err) {
      applyError(err);
    }
  }, [applyResult, applyError]);

  return {
    battleStatus,
    isLoading,
    error,
    refetch
  };
}
