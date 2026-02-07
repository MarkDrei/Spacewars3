import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useXpLevel } from '@/lib/client/hooks/useXpLevel';
import { userStatsService } from '@/lib/client/services/userStatsService';

// Mock userStatsService
vi.mock('@/lib/client/services/userStatsService', () => ({
  userStatsService: {
    getUserStats: vi.fn()
  }
}));

describe('useXpLevel Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useXpLevel_initialLoad_fetchesData', () => {
    it('should fetch XP/Level data on mount', async () => {
      const mockData = {
        iron: 1000,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 1500,
        level: 2,
        xpForNextLevel: 3000
      };

      vi.mocked(userStatsService.getUserStats).mockResolvedValue(mockData);

      const { result } = renderHook(() => useXpLevel(0)); // No polling

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.xpData).toBeNull();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.xpData).toEqual({
        xp: 1500,
        level: 2,
        xpForNextLevel: 3000
      });
      expect(result.current.error).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(userStatsService.getUserStats).mockResolvedValue({
        error: 'Authentication required'
      });

      const { result } = renderHook(() => useXpLevel(0));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Authentication required');
      expect(result.current.xpData).toBeNull();
    });

    it('should handle network errors', async () => {
      vi.mocked(userStatsService.getUserStats).mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useXpLevel(0));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Failed to fetch XP/Level data');
      expect(result.current.xpData).toBeNull();
    });
  });

  describe('useXpLevel_refetch_updatesData', () => {
    it('should refetch data when refetch is called', async () => {
      const initialData = {
        iron: 1000,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 1000,
        level: 2,
        xpForNextLevel: 3000
      };

      const updatedData = {
        iron: 1200,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 2500,
        level: 2,
        xpForNextLevel: 3000
      };

      vi.mocked(userStatsService.getUserStats)
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      const { result } = renderHook(() => useXpLevel(0));

      await waitFor(() => {
        expect(result.current.xpData?.xp).toBe(1000);
      });

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.xpData?.xp).toBe(2500);
      });
    });
  });

  describe('useXpLevel_polling_updatesAutomatically', () => {
    it('should poll at specified interval', async () => {
      vi.useFakeTimers();

      const mockData = {
        iron: 1000,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 1000,
        level: 2,
        xpForNextLevel: 3000
      };

      vi.mocked(userStatsService.getUserStats).mockResolvedValue(mockData);

      const { result } = renderHook(() => useXpLevel(1000)); // Poll every 1 second

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(userStatsService.getUserStats).toHaveBeenCalledTimes(1);

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(userStatsService.getUserStats).toHaveBeenCalledTimes(2);
      });

      // Advance time by another second
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(userStatsService.getUserStats).toHaveBeenCalledTimes(3);
      });

      vi.useRealTimers();
    });
  });

  describe('useXpLevel_levelUp_reflectsChange', () => {
    it('should reflect level increase after XP gain', async () => {
      const beforeLevelUp = {
        iron: 1000,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 950,
        level: 1,
        xpForNextLevel: 1000
      };

      const afterLevelUp = {
        iron: 1000,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 1100,
        level: 2,
        xpForNextLevel: 3000
      };

      vi.mocked(userStatsService.getUserStats)
        .mockResolvedValueOnce(beforeLevelUp)
        .mockResolvedValueOnce(afterLevelUp);

      const { result } = renderHook(() => useXpLevel(0));

      await waitFor(() => {
        expect(result.current.xpData?.level).toBe(1);
      });

      // Refetch after level-up event
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.xpData?.level).toBe(2);
        expect(result.current.xpData?.xp).toBe(1100);
        expect(result.current.xpData?.xpForNextLevel).toBe(3000);
      });
    });
  });

  describe('useXpLevel_cleanup_stopsPolling', () => {
    it('should clear interval on unmount', async () => {
      vi.useFakeTimers();

      const mockData = {
        iron: 1000,
        ironPerSecond: 5,
        last_updated: Date.now(),
        maxIronCapacity: 5000,
        xp: 1000,
        level: 2,
        xpForNextLevel: 3000
      };

      vi.mocked(userStatsService.getUserStats).mockResolvedValue(mockData);

      const { unmount } = renderHook(() => useXpLevel(1000));

      await waitFor(() => {
        expect(userStatsService.getUserStats).toHaveBeenCalledTimes(1);
      });

      // Unmount the hook
      unmount();

      // Advance time - should not trigger more calls
      vi.advanceTimersByTime(5000);

      // Should still be only 1 call (initial)
      expect(userStatsService.getUserStats).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
