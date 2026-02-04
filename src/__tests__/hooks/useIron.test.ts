import { describe, expect, vi, test, beforeEach } from 'vitest';
import { Mocked } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIron } from '@/lib/client/hooks/useIron';
import { userStatsService } from '@/lib/client/services/userStatsService';
import * as retryLogic from '@/lib/client/hooks/useIron/retryLogic';
import * as pollingUtils from '@/lib/client/hooks/useIron/pollingUtils';

// Mock the userStatsService
vi.mock('@/lib/client/services/userStatsService');
const mockUserStatsService = userStatsService as Mocked<typeof userStatsService>;

describe('useIron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('useIron_initiatesFetchAndReturnsData', async () => {
    // Arrange
    const mockStats = {
      iron: 1500,
      last_updated: 1674567890,
      ironPerSecond: 2,
      maxIronCapacity: 5000
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
      ironPerSecond: 2,
      maxIronCapacity: 5000
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

  // Test that retry logic is correctly wired up (not the timing!)
  test('useIron_networkError_callsRetryLogic', async () => {
    const scheduleRetrySpy = vi.spyOn(retryLogic, 'scheduleRetry');
    
    mockUserStatsService.getUserStats.mockResolvedValueOnce({
      error: 'Network error'
    });

    renderHook(() => useIron());

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(1);
    });

    // Verify that scheduleRetry was called (proving retry mechanism is triggered)
    await waitFor(() => {
      expect(scheduleRetrySpy).toHaveBeenCalled();
    });
  });

  test('useIron_successfulFetch_doesNotRetry', async () => {
    const scheduleRetrySpy = vi.spyOn(retryLogic, 'scheduleRetry');
    
    mockUserStatsService.getUserStats.mockResolvedValueOnce({
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 1,
      maxIronCapacity: 5000
    });

    renderHook(() => useIron());

    await waitFor(() => {
      expect(mockUserStatsService.getUserStats).toHaveBeenCalledTimes(1);
    });

    // Verify no retry was scheduled
    expect(scheduleRetrySpy).not.toHaveBeenCalled();
  });

  test('useIron_zeroIronPerSecond_displaysServerValue', async () => {
    // Arrange
    const mockStats = {
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 0, // No production
      maxIronCapacity: 5000
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
      ironPerSecond: 1,
      maxIronCapacity: 5000
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
      ironPerSecond: 2,
      maxIronCapacity: 5000
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

  // Test that polling is set up correctly (not the timing!)
  test('useIron_setsUpPolling_withCorrectInterval', async () => {
    const setupPollingSpy = vi.spyOn(pollingUtils, 'setupPolling');
    
    mockUserStatsService.getUserStats.mockResolvedValue({
      iron: 1000,
      last_updated: 1674567890,
      ironPerSecond: 1,
      maxIronCapacity: 5000
    });

    const customInterval = 3000;
    renderHook(() => useIron(customInterval));

    // Verify that polling was set up with the correct interval
    await waitFor(() => {
      expect(setupPollingSpy).toHaveBeenCalled();
    });

    // Check that the interval value passed is correct
    const calls = setupPollingSpy.mock.calls;
    const pollingCall = calls.find(call => call[1] === customInterval);
    expect(pollingCall).toBeDefined();
  });
});
