import { useState, useEffect, useRef, useCallback } from 'react';
import { getShipStats } from '../services/shipStatsService';
import { DefenseValues } from '@/shared/defenseValues';
import { globalEvents, EVENTS } from '../services/eventService';
import { getTimeMultiplier } from '../timeMultiplier';

export interface DefenseRecoveryTimers {
  repairs: number | null;
  shield: number | null;
}

interface UseDefenseValuesReturn {
  defenseValues: DefenseValues | null;
  recoveryTimers: DefenseRecoveryTimers | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  shipPictureId: number | null;
}

const EPSILON = 1e-9;

interface ProjectedRepairValues {
  hull: number;
  armor: number;
}

const clampDefenseValue = (current: number, max: number): number => Math.min(Math.max(current, 0), max);

const projectRepairValues = (
  defenseValues: DefenseValues,
  elapsedGameSeconds: number
): ProjectedRepairValues => {
  let hullCurrent = clampDefenseValue(defenseValues.hull.current, defenseValues.hull.max);
  let armorCurrent = clampDefenseValue(defenseValues.armor.current, defenseValues.armor.max);
  let remainingRepairTime = Math.max(0, elapsedGameSeconds);

  const totalRepairRate = Math.max(0, defenseValues.hull.regenRate + defenseValues.armor.regenRate);

  while (remainingRepairTime > EPSILON) {
    const hullDamaged = hullCurrent < defenseValues.hull.max - EPSILON;
    const armorDamaged = armorCurrent < defenseValues.armor.max - EPSILON;

    if (!hullDamaged && !armorDamaged) {
      break;
    }

    if (hullDamaged && armorDamaged) {
      if (defenseValues.hull.regenRate <= EPSILON || defenseValues.armor.regenRate <= EPSILON) {
        break;
      }

      const hullTimeToFull = (defenseValues.hull.max - hullCurrent) / defenseValues.hull.regenRate;
      const armorTimeToFull = (defenseValues.armor.max - armorCurrent) / defenseValues.armor.regenRate;
      const step = Math.min(remainingRepairTime, hullTimeToFull, armorTimeToFull);

      if (step <= EPSILON) {
        break;
      }

      hullCurrent = clampDefenseValue(hullCurrent + defenseValues.hull.regenRate * step, defenseValues.hull.max);
      armorCurrent = clampDefenseValue(armorCurrent + defenseValues.armor.regenRate * step, defenseValues.armor.max);
      remainingRepairTime -= step;
      continue;
    }

    if (totalRepairRate <= EPSILON) {
      break;
    }

    if (hullDamaged) {
      hullCurrent = clampDefenseValue(hullCurrent + totalRepairRate * remainingRepairTime, defenseValues.hull.max);
      break;
    }

    armorCurrent = clampDefenseValue(armorCurrent + totalRepairRate * remainingRepairTime, defenseValues.armor.max);
    break;
  }

  return { hull: hullCurrent, armor: armorCurrent };
};

const calculateRepairSecondsRemaining = (
  defenseValues: DefenseValues,
  projectedRepairValues: ProjectedRepairValues,
  timeMultiplier: number
): number | null => {
  const effectiveHullRate = Math.max(0, defenseValues.hull.regenRate * timeMultiplier);
  const effectiveArmorRate = Math.max(0, defenseValues.armor.regenRate * timeMultiplier);
  const totalEffectiveRepairRate = effectiveHullRate + effectiveArmorRate;
  const hullRemaining = Math.max(0, defenseValues.hull.max - projectedRepairValues.hull);
  const armorRemaining = Math.max(0, defenseValues.armor.max - projectedRepairValues.armor);
  const hullDamaged = hullRemaining > EPSILON;
  const armorDamaged = armorRemaining > EPSILON;

  if (!hullDamaged && !armorDamaged) {
    return null;
  }

  if (totalEffectiveRepairRate <= EPSILON) {
    return null;
  }

  if (hullDamaged && armorDamaged) {
    if (effectiveHullRate <= EPSILON || effectiveArmorRate <= EPSILON) {
      return null;
    }

    const hullTimeToFull = hullRemaining / effectiveHullRate;
    const armorTimeToFull = armorRemaining / effectiveArmorRate;
    const sharedRepairPhase = Math.min(hullTimeToFull, armorTimeToFull);

    if (Math.abs(hullTimeToFull - armorTimeToFull) <= EPSILON) {
      return sharedRepairPhase;
    }

    if (hullTimeToFull < armorTimeToFull) {
      const armorRemainingAfterHullRepair = Math.max(0, armorRemaining - (effectiveArmorRate * sharedRepairPhase));
      return sharedRepairPhase + (armorRemainingAfterHullRepair / totalEffectiveRepairRate);
    }

    const hullRemainingAfterArmorRepair = Math.max(0, hullRemaining - (effectiveHullRate * sharedRepairPhase));
    return sharedRepairPhase + (hullRemainingAfterArmorRepair / totalEffectiveRepairRate);
  }

  if (hullDamaged) {
    return hullRemaining / totalEffectiveRepairRate;
  }

  return armorRemaining / totalEffectiveRepairRate;
};

export const projectDefenseValues = (
  defenseValues: DefenseValues,
  elapsedSeconds: number,
  timeMultiplier: number
): DefenseValues => {
  const safeMultiplier = Math.max(0, timeMultiplier);
  const elapsedGameSeconds = Math.max(0, elapsedSeconds) * safeMultiplier;
  const projectedRepairValues = projectRepairValues(defenseValues, elapsedGameSeconds);
  const shieldCurrent = clampDefenseValue(
    defenseValues.shield.current + (defenseValues.shield.regenRate * elapsedGameSeconds),
    defenseValues.shield.max
  );

  return {
    hull: {
      ...defenseValues.hull,
      current: Math.floor(projectedRepairValues.hull + EPSILON),
    },
    armor: {
      ...defenseValues.armor,
      current: Math.floor(projectedRepairValues.armor + EPSILON),
    },
    shield: {
      ...defenseValues.shield,
      current: Math.floor(shieldCurrent + EPSILON),
    },
  };
};

export const calculateDefenseRecoveryTimers = (
  defenseValues: DefenseValues,
  elapsedSeconds: number,
  timeMultiplier: number
): DefenseRecoveryTimers => {
  const safeMultiplier = Math.max(0, timeMultiplier);
  const elapsedGameSeconds = Math.max(0, elapsedSeconds) * safeMultiplier;
  const projectedRepairValues = projectRepairValues(defenseValues, elapsedGameSeconds);
  const shieldCurrent = clampDefenseValue(
    defenseValues.shield.current + (defenseValues.shield.regenRate * elapsedGameSeconds),
    defenseValues.shield.max
  );
  const effectiveShieldRate = Math.max(0, defenseValues.shield.regenRate * safeMultiplier);
  const shieldRemaining = Math.max(0, defenseValues.shield.max - shieldCurrent);

  return {
    repairs: calculateRepairSecondsRemaining(defenseValues, projectedRepairValues, safeMultiplier),
    shield: shieldRemaining > EPSILON && effectiveShieldRate > EPSILON
      ? shieldRemaining / effectiveShieldRate
      : null,
  };
};

export const useDefenseValues = (pollInterval: number = 2000): UseDefenseValuesReturn => {
  // Server values fetched from API
  const [serverDefenseValues, setServerDefenseValues] = useState<DefenseValues | null>(null);
  // Interpolated values displayed to user (updated multiple times per second)
  const [displayDefenseValues, setDisplayDefenseValues] = useState<DefenseValues | null>(null);
  const [recoveryTimers, setRecoveryTimers] = useState<DefenseRecoveryTimers | null>(null);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [shipPictureId, setShipPictureId] = useState<number | null>(null);
  
  // Use ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef<boolean>(true);
  const interpolationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDefenseValues = useCallback(async (retryCount: number = 0) => {
    try {
      setError(null);
      const result = await getShipStats();
      
      if (!isMountedRef.current) return; // Component unmounted
      
      if ('error' in result) {
        // If it's a connection error and we haven't retried too much, retry
        if (result.error.includes('Network error') && retryCount < 3) {
          console.log(`Retrying defense values fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchDefenseValues(retryCount + 1), 2000); // Retry after 2 seconds
          return;
        }
        setError(result.error);
        setIsLoading(false);
        return;
      }
      
      // Update server defense values and timestamp
      setServerDefenseValues(result.defenseValues);
      setDisplayDefenseValues(result.defenseValues);
      setRecoveryTimers(calculateDefenseRecoveryTimers(result.defenseValues, 0, getTimeMultiplier()));
      setLastServerUpdate(Date.now());
      if (result.shipPictureId !== undefined) {
        setShipPictureId(result.shipPictureId);
      }
      setIsLoading(false);
    } catch {
      if (isMountedRef.current) {
        // If it's initial load and we haven't retried much, retry
        if (retryCount < 3) {
          console.log(`Retrying defense values fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => fetchDefenseValues(retryCount + 1), 2000); // Retry after 2 seconds
          return;
        }
        setError('Failed to fetch defense values');
        setIsLoading(false);
      }
    }
  }, []); // Empty dependency array since fetchDefenseValues doesn't depend on any changing values

  // Interpolation function to smoothly update display values between server polls
  const updateDisplayValues = useCallback(() => {
    if (!serverDefenseValues || error) return;

    const now = Date.now();
    const secondsElapsed = (now - lastServerUpdate) / 1000;
    const multiplier = getTimeMultiplier();

    setDisplayDefenseValues(projectDefenseValues(serverDefenseValues, secondsElapsed, multiplier));
    setRecoveryTimers(calculateDefenseRecoveryTimers(serverDefenseValues, secondsElapsed, multiplier));
  }, [serverDefenseValues, lastServerUpdate, error]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch (auth guaranteed by server component)
    fetchDefenseValues();
    
    // Set up server polling to get authoritative values
    const serverInterval = setInterval(fetchDefenseValues, pollInterval);
    
    // Listen for build completion events to refresh defense values
    const handleBuildCompleted = () => {
      console.log('Build completed, refreshing defense values...');
      fetchDefenseValues();
    };
    
    globalEvents.on(EVENTS.BUILD_ITEM_COMPLETED, handleBuildCompleted);
    globalEvents.on(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildCompleted);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearInterval(serverInterval);
      if (interpolationIntervalRef.current) {
        clearInterval(interpolationIntervalRef.current);
      }
      globalEvents.off(EVENTS.BUILD_ITEM_COMPLETED, handleBuildCompleted);
      globalEvents.off(EVENTS.BUILD_QUEUE_COMPLETED, handleBuildCompleted);
    };
  }, [pollInterval, fetchDefenseValues]);

  // Set up smooth interpolation updates (multiple times per second)
  useEffect(() => {
    if (isLoading || error || !serverDefenseValues) {
      return;
    }

    // Update display values immediately
    updateDisplayValues();

    // Set up interval to update display values smoothly (10 times per second)
    if (!interpolationIntervalRef.current) {
      interpolationIntervalRef.current = setInterval(updateDisplayValues, 100);
    }

    return () => {
      if (interpolationIntervalRef.current) {
        clearInterval(interpolationIntervalRef.current);
        interpolationIntervalRef.current = null;
      }
    };
  }, [isLoading, error, serverDefenseValues, updateDisplayValues]);

  return {
    defenseValues: displayDefenseValues,
    recoveryTimers,
    isLoading,
    error,
    refetch: fetchDefenseValues,
    shipPictureId,
  };
};
