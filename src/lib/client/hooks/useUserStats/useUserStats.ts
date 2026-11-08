import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { UserStatsResponse } from '../../services/userStatsService';
import { calculatePredictedIron, shouldUpdateDisplay, type IronData } from './ironCalculations';
import { getTimeMultiplier } from '../../timeMultiplier';
import {
  subscribeUserStats,
  getUserStatsSnapshot,
  getUserStatsServerSnapshot,
  refreshUserStats,
} from './userStatsStore';

const DEFAULT_DEFENSE_REGEN_RATE = 0.1;

interface BonusData {
  levelMultiplier: number;
  ironRechargeRate: number;
  ironStorageCapacity: number;
  maxShipSpeed: number;
  currentMaxShipSpeed: number;
  repairRate: number;
  shieldRechargeRate: number;
  projectileWeaponDamageFactor: number;
  projectileWeaponReloadFactor: number;
  projectileWeaponAccuracyFactor: number;
  energyWeaponDamageFactor: number;
  energyWeaponReloadFactor: number;
  energyWeaponAccuracyFactor: number;
  constructionSpeedFactor: number;
  researchSpeedFactor: number;
}

const DEFAULT_BONUS_DATA: BonusData = {
  levelMultiplier: 1.0,
  ironRechargeRate: 1.0,
  ironStorageCapacity: 5000,
  maxShipSpeed: 0,
  currentMaxShipSpeed: 0,
  repairRate: DEFAULT_DEFENSE_REGEN_RATE,
  shieldRechargeRate: DEFAULT_DEFENSE_REGEN_RATE,
  projectileWeaponDamageFactor: 1.0,
  projectileWeaponReloadFactor: 1.0,
  projectileWeaponAccuracyFactor: 1.0,
  energyWeaponDamageFactor: 1.0,
  energyWeaponReloadFactor: 1.0,
  energyWeaponAccuracyFactor: 1.0,
  constructionSpeedFactor: 1.0,
  researchSpeedFactor: 1.0,
};

interface UseUserStatsReturn {
  ironAmount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  xp: number;
  level: number;
  xpForNextLevel: number;
  score: number;
  timeMultiplier: number;
  bonuses: BonusData;
}

/** Interval of the client-side iron prediction (display only, no requests). */
const DISPLAY_TICK_MS = 100;

const toBonusData = (result: UserStatsResponse): BonusData => ({
  levelMultiplier: result.levelMultiplier ?? 1.0,
  ironRechargeRate: result.ironPerSecond ?? 1.0,
  ironStorageCapacity: result.maxIronCapacity ?? 5000,
  maxShipSpeed: result.maxShipSpeed ?? 0,
  currentMaxShipSpeed: result.currentMaxShipSpeed ?? 0,
  repairRate: result.repairRate ?? DEFAULT_DEFENSE_REGEN_RATE,
  shieldRechargeRate: result.shieldRechargeRate ?? DEFAULT_DEFENSE_REGEN_RATE,
  projectileWeaponDamageFactor: result.projectileWeaponDamageFactor ?? 1.0,
  projectileWeaponReloadFactor: result.projectileWeaponReloadFactor ?? 1.0,
  projectileWeaponAccuracyFactor: result.projectileWeaponAccuracyFactor ?? 1.0,
  energyWeaponDamageFactor: result.energyWeaponDamageFactor ?? 1.0,
  energyWeaponReloadFactor: result.energyWeaponReloadFactor ?? 1.0,
  energyWeaponAccuracyFactor: result.energyWeaponAccuracyFactor ?? 1.0,
  constructionSpeedFactor: result.constructionSpeedFactor ?? 1.0,
  researchSpeedFactor: result.researchSpeedFactor ?? 1.0,
});

/**
 * User stats (iron, XP, bonuses) from the shared user-stats store.
 * All components using this hook share one poll; `pollInterval` is the longest acceptable delay.
 * The displayed iron amount is extrapolated client-side between server updates.
 */
export const useUserStats = (pollInterval: number = 5000): UseUserStatsReturn => {
  const subscribe = useCallback((listener: () => void) => subscribeUserStats(listener, pollInterval), [pollInterval]);
  const { result, receivedAt, error, isLoading } = useSyncExternalStore(
    subscribe,
    getUserStatsSnapshot,
    getUserStatsServerSnapshot
  );

  const ironData: IronData | null = useMemo(
    () =>
      result
        ? {
            serverAmount: result.iron,
            ironPerSecond: result.ironPerSecond,
            lastUpdateTime: receivedAt,
            maxCapacity: result.maxIronCapacity,
          }
        : null,
    [result, receivedAt]
  );

  // Predicted iron, re-rendering only when the displayed (whole) number changes
  const predictIron = useCallback(
    () => (ironData ? calculatePredictedIron(ironData, Date.now(), getTimeMultiplier()) : 0),
    [ironData]
  );
  const [ironTick, setIronTick] = useState<{ source: IronData | null; amount: number }>({ source: null, amount: 0 });
  const isTicking = !!ironData && ironData.ironPerSecond > 0 && !error;

  useEffect(() => {
    if (!isTicking) return;
    const tick = () =>
      setIronTick(prev => {
        const amount = predictIron();
        return prev.source === ironData && !shouldUpdateDisplay(prev.amount, amount) ? prev : { source: ironData, amount };
      });
    const interval = setInterval(tick, DISPLAY_TICK_MS);
    return () => clearInterval(interval);
  }, [isTicking, predictIron, ironData]);

  // Until the first tick after new server data, show the server value
  const ironAmount =
    ironTick.source === ironData && isTicking ? ironTick.amount : Math.floor(ironData?.serverAmount ?? 0);

  const refetch = useCallback(() => {
    void refreshUserStats();
  }, []);

  const bonuses = useMemo(() => (result ? toBonusData(result) : DEFAULT_BONUS_DATA), [result]);

  return {
    ironAmount,
    isLoading,
    error,
    refetch,
    xp: result?.xp ?? 0,
    level: result?.level ?? 1,
    xpForNextLevel: result?.xpForNextLevel ?? 1000,
    score: result?.score ?? 0,
    timeMultiplier: result?.timeMultiplier ?? 1,
    bonuses,
  };
};
