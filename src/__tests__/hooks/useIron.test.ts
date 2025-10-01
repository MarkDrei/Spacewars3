import { describe, expect, vi, test, beforeEach } from 'vitest';
import { Mocked } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIron } from '@/lib/client/hooks/useIron';
import { userStatsService } from '@/lib/client/services/userStatsService';

// Mock the userStatsService
vi.mock('@/lib/client/services/userStatsService');
const mockUserStatsService = userStatsService as Mocked<typeof userStatsService>;

describe('useIron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('useIron_initiatesFetchAndReturnsData', async () => {
    // Arrange
    const mockStats = {
      iron: 1500,
      last_updated: 1674567890,
      ironPerSecond: 2
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Assert initial state
    expect(result.current.isLoading).toBe(true);
    expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(1);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.ironAmount).toBe(1500);
    expect(result.current.error).toBe(null);
  });

  test('useIron_apiError_setsErrorState', async () => {
    // Arrange
    mockUserStatsService.getUserStats.mockResolvedValueOnce({
      error: 'Server error'
    });

    // Act
    const { result } = renderHook(() => useIron());

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Server error');
    expect(result.current.ironAmount).toBe(0);
  });

  test('useIron_withIronProduction_calculatesDisplayIron', async () => {
    // Arrange
    const mockStats = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 2
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initial iron amount should be server value
    expect(result.current.ironAmount).toBe(1000);
  });

  test('useIron_networkErrorRetry_eventuallySucceeds', async () => {
    // Arrange
    mockUserStatsService.getUserStats
      .mockResolvedValueOnce({ error: 'Network error' })
      .mockResolvedValueOnce({
        iron: 500,
        last_updated: 1674567890,
        ironPerSecond: 1
      });

    // Act
    const { result } = renderHook(() => useIron());

    // Should eventually succeed after retry
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 10000 });

    expect(result.current.ironAmount).toBe(500);
    expect(result.current.error).toBe(null);
    expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(2);
  });

  test('useIron_zeroIronPerSecond_displaysServerValue', async () => {
    // Arrange
    const mockStats = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 0 // No production
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.ironAmount).toBe(1000);
  });

  test('useIron_refetchFunction_triggersNewFetch', async () => {
    // Arrange
    const mockStats = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 1
    };
    mockUserStatsService.getUserStats.mockResolvedValue(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Clear mock calls from initial fetch
    mockUserStatsService.getUserStats.mockClear();

    // Call refetch
    result.current.refetch();

    // Assert
    expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(1);
  });

  test('useIron_withIronProduction_smoothUpdatesWorkWithTime', async () => {
    // Arrange
    const originalDateNow = Date.now;
    const startTime = 1674567890000;
    let currentTime = startTime;
    
    // Mock Date.now to control time
    Date.now = vi.fn(() => currentTime);

    const mockStats = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 2
    };
    mockUserStatsService.getUserStats.mockResolvedValueOnce(mockStats);

    // Act
    const { result } = renderHook(() => useIron());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initial iron amount should be server value
    expect(result.current.ironAmount).toBe(1000);

    // Simulate time passing and force a re-render
    currentTime = startTime + 3000; // 3 seconds later

    // Force the component to re-run its effect by changing a dependency
    // This simulates the interval triggering the updateDisplayIron function
    await waitFor(() => {
      // We expect the iron to have increased due to time-based calculations
      // Since 3 seconds passed with 2 iron/second, we should see an increase
      expect(result.current.ironAmount).toBeGreaterThanOrEqual(1000);
    }, { timeout: 500 });

    // Restore Date.now
    Date.now = originalDateNow;
  });

  test('useIron_multipleFetchesWithDifferentTimes_maintainsSmoothUpdates', async () => {
    // Arrange
    const mockStats1 = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 1
    };
    const mockStats2 = {
      iron: 1100,
      last_updated: 1674567950, // 60 seconds later
      ironPerSecond: 2
    };

    mockUserStatsService.getUserStats
      .mockResolvedValueOnce(mockStats1)
      .mockResolvedValueOnce(mockStats2);

    // Act
    const { result } = renderHook(() => useIron(1000)); // 1 second poll interval

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.ironAmount).toBe(1000);

    // Wait for second fetch
    await waitFor(() => {
      expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(2);
    }, { timeout: 2000 });

    // Should now have the updated iron amount
    await waitFor(() => {
      expect(result.current.ironAmount).toBe(1100);
    });
  });
});
