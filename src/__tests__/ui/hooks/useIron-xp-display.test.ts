import { describe, expect, vi, test, beforeEach } from 'vitest';
import { Mocked } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIron } from '@/lib/client/hooks/useIron';
import { userStatsService } from '@/lib/client/services/userStatsService';

// Mock the userStatsService
vi.mock('@/lib/client/services/userStatsService');
const mockUserStatsService = userStatsService as Mocked<typeof userStatsService>;

describe('useIron - XP and Level Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('useIron_returnsXpAndLevelData', async () => {
    // Arrange
    const mockStats = {
      iron: 1500,
      last_updated: 1674567890,
      ironPerSecond: 2,
      maxIronCapacity: 5000,
      xp: 5000,
      level: 3,
      xpForNextLevel: 10000,
      timeMultiplier: 1,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.xp).toBe(5000);
    expect(result.current.level).toBe(3);
    expect(result.current.xpForNextLevel).toBe(10000);
  });

  test('useIron_newUser_hasLevel1AndZeroXp', async () => {
    // Arrange
    const mockStats = {
      iron: 0,
      last_updated: 1674567890,
      ironPerSecond: 1,
      maxIronCapacity: 5000,
      xp: 0,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 1,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert - New user should start at level 1 with 0 XP
    expect(result.current.xp).toBe(0);
    expect(result.current.level).toBe(1);
    expect(result.current.xpForNextLevel).toBe(1000);
  });

  test('useIron_highLevelUser_hasCorrectXpData', async () => {
    // Arrange - Level 10 user
    const mockStats = {
      iron: 50000,
      last_updated: 1674567890,
      ironPerSecond: 15,
      maxIronCapacity: 50000,
      xp: 165000,
      level: 10,
      xpForNextLevel: 220000,
      timeMultiplier: 1,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.xp).toBe(165000);
    expect(result.current.level).toBe(10);
    expect(result.current.xpForNextLevel).toBe(220000);
  });

  test('useIron_xpDataUpdatesOnRefetch', async () => {
    // Arrange - Initial state
    const initialStats = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 2,
      maxIronCapacity: 5000,
      xp: 900,
      level: 1,
      xpForNextLevel: 1000,
      timeMultiplier: 1,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };
    
    // Updated state after level up
    const updatedStats = {
      iron: 1500,
      last_updated: 1674567900,
      ironPerSecond: 2,
      maxIronCapacity: 5000,
      xp: 1100,
      level: 2,
      xpForNextLevel: 4000,
      timeMultiplier: 1,
      teleportCharges: 0,
      teleportMaxCharges: 0,
      teleportRechargeTimeSec: 0,
      teleportRechargeSpeed: 0
    };
    
    mockUserStatsService.getUserStats
      .mockResolvedValueOnce(initialStats)
      .mockResolvedValueOnce(updatedStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert initial XP data
    expect(result.current.level).toBe(1);
    expect(result.current.xp).toBe(900);
    expect(result.current.xpForNextLevel).toBe(1000);

    // Trigger refetch
    result.current.refetch();

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.level).toBe(2);
    });

    // Assert updated XP data after level up
    expect(result.current.xp).toBe(1100);
    expect(result.current.xpForNextLevel).toBe(4000);
  });

  test('useIron_loadingState_hasDefaultXpValues', async () => {
    // Arrange
    mockUserStatsService.getUserStats.mockImplementation(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    // Act
    const { result } = renderHook(() => useIron());

    // Assert - Should have default values while loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.xp).toBe(0);
    expect(result.current.level).toBe(1);
    expect(result.current.xpForNextLevel).toBe(1000);
  });

  test('useIron_apiError_maintainsDefaultXpValues', async () => {
    // Arrange
    mockUserStatsService.getUserStats.mockResolvedValueOnce({
      error: 'Server error'
    });

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for error state
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert - Should keep default XP values on error
    expect(result.current.error).toBe('Server error');
    expect(result.current.xp).toBe(0);
    expect(result.current.level).toBe(1);
    expect(result.current.xpForNextLevel).toBe(1000);
  });
});
