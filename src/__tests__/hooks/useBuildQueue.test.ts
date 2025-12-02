import { describe, expect, test, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBuildQueue } from '@/lib/client/hooks/useBuildQueue';
import { useFactoryDataCache } from '@/lib/client/hooks/useFactoryDataCache';
import { factoryService } from '@/lib/client/services/factoryService';

// Mock the dependencies
vi.mock('@/lib/client/hooks/useFactoryDataCache');
vi.mock('@/lib/client/services/factoryService');

const mockUseFactoryDataCache = vi.mocked(useFactoryDataCache);
const mockFactoryService = vi.mocked(factoryService);

describe('useBuildQueue', () => {
  
  const mockBuildQueue = [
    {
      itemKey: 'pulse_laser',
      itemType: 'weapon' as const,
      completionTime: Math.floor(Date.now() / 1000) + 300,
      remainingSeconds: 300
    }
  ];

  const mockFactoryData = {
    buildQueue: mockBuildQueue,
    techCounts: {
      pulse_laser: 2,
      auto_turret: 1,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 1,
      kinetic_armor: 1,
      energy_shield: 0,
      missile_jammer: 0
    },
    weapons: {},
    defenses: {},
    lastUpdated: Date.now()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation
    mockUseFactoryDataCache.mockReturnValue({
      data: mockFactoryData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });
  });

  test('useBuildQueue_authenticatedUserWithData_returnsBuildQueue', () => {
    // Act
    const { result } = renderHook(() => useBuildQueue());

    // Assert
    expect(result.current.buildQueue).toEqual(mockBuildQueue);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.isCompletingBuild).toBe(false);
  });

  test('useBuildQueue_cacheLoading_returnsLoadingState', () => {
    // Arrange
    mockUseFactoryDataCache.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    });

    // Act
    const { result } = renderHook(() => useBuildQueue());

    // Assert
    expect(result.current.isLoading).toBe(true);
    expect(result.current.buildQueue).toEqual([]);
  });

  test('useBuildQueue_cacheError_returnsErrorState', () => {
    // Arrange
    mockUseFactoryDataCache.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Network error',
      refetch: vi.fn()
    });

    // Act
    const { result } = renderHook(() => useBuildQueue());

    // Assert
    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
  });

  test('useBuildQueue_buildItemSuccess_callsFactoryService', async () => {
    // Arrange
    mockFactoryService.buildItem.mockResolvedValue({
      success: true,
      message: 'Build started',
      estimatedCompletion: Date.now() + 300000,
      remainingIron: 850
    });

    // Act
    const { result } = renderHook(() => useBuildQueue());
    
    await act(async () => {
      await result.current.buildItem('pulse_laser', 'weapon');
    });

    // Assert
    expect(mockFactoryService.buildItem).toHaveBeenCalledWith('pulse_laser', 'weapon');
    expect(result.current.isBuilding).toBe(false); // Should be false after completion
  });

  test('useBuildQueue_buildItemError_setsErrorState', async () => {
    // Arrange
    mockFactoryService.buildItem.mockResolvedValue({
      error: 'Not enough iron'
    });

    // Act
    const { result } = renderHook(() => useBuildQueue());
    
    await act(async () => {
      await result.current.buildItem('pulse_laser', 'weapon');
    });

    // Assert
    expect(result.current.error).toBe('Not enough iron');
    expect(result.current.isBuilding).toBe(false);
  });

  test('useBuildQueue_completeBuildSuccess_callsFactoryService', async () => {
    // Arrange
    mockFactoryService.completeBuild.mockResolvedValue({
      success: true,
      message: 'Build completed'
    });

    // Act
    const { result } = renderHook(() => useBuildQueue());
    
    await act(async () => {
      await result.current.completeBuild();
    });

    // Assert
    expect(mockFactoryService.completeBuild).toHaveBeenCalled();
    expect(result.current.isCompletingBuild).toBe(false);
  });

  test('useBuildQueue_refetch_callsCacheRefetch', () => {
    // Arrange
    const mockRefetch = vi.fn();
    mockUseFactoryDataCache.mockReturnValue({
      data: mockFactoryData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    // Act
    const { result } = renderHook(() => useBuildQueue());
    result.current.refetch();

    // Assert
    expect(mockRefetch).toHaveBeenCalled();
  });

});