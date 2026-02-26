import { useState, useEffect, useRef, useCallback } from 'react';
import { userStatsService, UserStatsResponse } from '../services/userStatsService';

export interface TeleportData {
  teleportCharges: number;
  teleportMaxCharges: number;
  teleportRechargeTimeSec: number;
  teleportRechargeSpeed: number;
}

interface UseTeleportDataReturn {
  teleportData: TeleportData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTeleportData = (pollInterval: number = 5000): UseTeleportDataReturn => {
  const [teleportData, setTeleportData] = useState<TeleportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTeleportData = useCallback(async () => {
    try {
      setError(null);
      const result: UserStatsResponse | { error: string } = await userStatsService.getUserStats();

      if (!isMountedRef.current) return;

      if ('error' in result) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      setTeleportData({
        teleportCharges: result.teleportCharges,
        teleportMaxCharges: result.teleportMaxCharges,
        teleportRechargeTimeSec: result.teleportRechargeTimeSec,
        teleportRechargeSpeed: result.teleportRechargeSpeed,
      });
      setIsLoading(false);
    } catch {
      if (isMountedRef.current) {
        setError('Failed to fetch teleport data');
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    fetchTeleportData();
    intervalRef.current = setInterval(fetchTeleportData, pollInterval);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollInterval, fetchTeleportData]);

  return {
    teleportData,
    isLoading,
    error,
    refetch: fetchTeleportData,
  };
};
