/**
 * Tests for useIron hook with time multiplier integration
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIron } from '@/lib/client/hooks/useIron/useIron';
import { userStatsService } from '@/lib/client/services/userStatsService';
import { getTimeMultiplier, resetTimeMultiplier } from '@/lib/client/timeMultiplier';

// Mock the userStatsService
vi.mock('@/lib/client/services/userStatsService');
const mockUserStatsService = vi.mocked(userStatsService);

describe('useIron hook - time multiplier integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTimeMultiplier();
  });

  afterEach(() => {
    resetTimeMultiplier();
  });

  it('useIron_receivesTimeMultiplier_storesInModuleState', async () => {
    const mockStats = {
      iron: 1000,
      ironPerSecond: 10,
      maxIronCapacity: 5000,
      xp: 0,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 10,
      last_updated: Date.now(),
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };

    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    renderHook(() => useIron(5000));

    await waitFor(() => {
      expect(getTimeMultiplier()).toBe(10);
    });
  });

  it('useIron_noTimeMultiplierInResponse_defaultsTo1', async () => {
    const mockStats = {
      iron: 1000,
      ironPerSecond: 10,
      maxIronCapacity: 5000,
      xp: 0,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 1, // Server sends 1 when no multiplier is active
      last_updated: Date.now(),
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };

    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    renderHook(() => useIron(5000));

    await waitFor(() => {
      expect(getTimeMultiplier()).toBe(1);
    });
  });

  it('useIron_returnsTimeMultiplierInHookResult', async () => {
    const mockStats = {
      iron: 1000,
      ironPerSecond: 10,
      maxIronCapacity: 5000,
      xp: 0,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 25,
      last_updated: Date.now(),
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };

    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    const { result } = renderHook(() => useIron(5000));

    await waitFor(() => {
      expect(result.current.timeMultiplier).toBe(25);
    });
  });

  it('useIron_timeMultiplierUpdates_updatesModuleState', async () => {
    const mockStats1 = {
      iron: 1000,
      ironPerSecond: 10,
      maxIronCapacity: 5000,
      xp: 0,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 10,
      last_updated: Date.now(),
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };

    const mockStats2 = {
      ...mockStats1,
      timeMultiplier: 50,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };

    mockUserStatsService.getUserStats
      .mockResolvedValueOnce(mockStats1)
      .mockResolvedValueOnce(mockStats2);

    const { result, rerender } = renderHook(() => useIron(5000));

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.timeMultiplier).toBe(10);
    });
    expect(getTimeMultiplier()).toBe(10);

    // Trigger refetch
    result.current.refetch();
    rerender();

    // Wait for second fetch
    await waitFor(() => {
      expect(result.current.timeMultiplier).toBe(50);
    });
    expect(getTimeMultiplier()).toBe(50);
  });

  it('useIron_multiplierExpires_updatesTo1', async () => {
    const mockStats1 = {
      iron: 1000,
      ironPerSecond: 10,
      maxIronCapacity: 5000,
      xp: 0,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 10,
      last_updated: Date.now(),
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };

    const mockStats2 = {
      ...mockStats1,
      timeMultiplier: 1 // Expired on server
    };

    mockUserStatsService.getUserStats
      .mockResolvedValueOnce(mockStats1)
      .mockResolvedValueOnce(mockStats2);

    const { result, rerender } = renderHook(() => useIron(5000));

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.timeMultiplier).toBe(10);
    });

    // Trigger refetch
    result.current.refetch();
    rerender();

    // Wait for second fetch
    await waitFor(() => {
      expect(result.current.timeMultiplier).toBe(1);
    });
    expect(getTimeMultiplier()).toBe(1);
  });
});
