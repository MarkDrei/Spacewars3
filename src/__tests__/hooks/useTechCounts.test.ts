import { describe, expect, test, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTechCounts } from '@/lib/client/hooks/useTechCounts';
import { useFactoryDataCache } from '@/lib/client/hooks/useFactoryDataCache';
import { globalEvents, EVENTS } from '@/lib/client/services/eventService';

// Mock the dependencies
vi.mock('@/lib/client/hooks/useFactoryDataCache');

const mockUseFactoryDataCache = vi.mocked(useFactoryDataCache);

describe('useTechCounts', () => {
  
  const mockWeapons = {
    pulse_laser: {
      name: 'Pulse Laser',
      subtype: 'Energy' as const,
      strength: 'Weak' as const,
      reloadTimeMinutes: 0.5,
      baseDamage: 25,
      baseAccuracy: 85,
      baseCost: 150,
      shieldDamageRatio: 1.2,
      armorDamageRatio: 0.8,
      buildDurationMinutes: 5,
      advantage: 'High accuracy',
      disadvantage: 'Weak against armor'
    }
  };

  const mockDefenses = {
    kinetic_armor: {
      name: 'Kinetic Armor',
      baseCost: 200,
      buildDurationMinutes: 2,
      description: 'Absorbs kinetic damage'
    }
  };

  const mockTechCounts = {
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
  };

  const mockFactoryData = {
    buildQueue: [],
    techCounts: mockTechCounts,
    weapons: mockWeapons,
    defenses: mockDefenses,
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

  test('useTechCounts_authenticatedUserWithData_returnsData', () => {
    // Act
    const { result } = renderHook(() => useTechCounts());

    // Assert
    expect(result.current.techCounts).toEqual(mockTechCounts);
    expect(result.current.weapons).toEqual(mockWeapons);
    expect(result.current.defenses).toEqual(mockDefenses);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('useTechCounts_cacheLoading_returnsLoadingState', () => {
    // Arrange
    mockUseFactoryDataCache.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    });

    // Act
    const { result } = renderHook(() => useTechCounts());

    // Assert
    expect(result.current.isLoading).toBe(true);
    expect(result.current.techCounts).toBeNull();
    expect(result.current.weapons).toEqual({});
    expect(result.current.defenses).toEqual({});
  });

  test('useTechCounts_cacheError_returnsErrorState', () => {
    // Arrange
    mockUseFactoryDataCache.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Network error',
      refetch: vi.fn()
    });

    // Act
    const { result } = renderHook(() => useTechCounts());

    // Assert
    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.techCounts).toBeNull();
  });

  test('useTechCounts_refetch_callsCacheRefetch', () => {
    // Arrange
    const mockRefetch = vi.fn();
    mockUseFactoryDataCache.mockReturnValue({
      data: mockFactoryData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    // Act
    const { result } = renderHook(() => useTechCounts());
    result.current.refetch();

    // Assert
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('useTechCounts_buildItemCompletedEvent_triggersRefetch', () => {
    // Arrange
    const mockRefetch = vi.fn();
    mockUseFactoryDataCache.mockReturnValue({
      data: mockFactoryData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    // Act
    renderHook(() => useTechCounts());
    
    act(() => {
      globalEvents.emit(EVENTS.BUILD_ITEM_COMPLETED);
    });

    // Assert
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('useTechCounts_buildQueueCompletedEvent_triggersRefetch', () => {
    // Arrange
    const mockRefetch = vi.fn();
    mockUseFactoryDataCache.mockReturnValue({
      data: mockFactoryData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    });

    // Act
    renderHook(() => useTechCounts());
    
    act(() => {
      globalEvents.emit(EVENTS.BUILD_QUEUE_COMPLETED);
    });

    // Assert
    expect(mockRefetch).toHaveBeenCalled();
  });


});