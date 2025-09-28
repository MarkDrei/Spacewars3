import { describe, expect, test, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFactoryDataCache, resetFactoryDataCache } from '@/lib/client/hooks/useFactoryDataCache';
import { factoryService } from '@/lib/client/services/factoryService';

// Mock the factory service
vi.mock('@/lib/client/services/factoryService', () => ({
  factoryService: {
    getTechCatalog: vi.fn(),
    getBuildStatus: vi.fn()
  }
}));

const mockFactoryService = vi.mocked(factoryService);

describe('useFactoryDataCache', () => {
  
  // Sample test data
  const mockTechCatalog = {
    success: true,
    weapons: {
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
    },
    defenses: {
      kinetic_armor: {
        name: 'Kinetic Armor',
        baseCost: 200,
        buildDurationMinutes: 2,
        description: 'Absorbs kinetic damage'
      }
    },
    weaponKeys: ['pulse_laser'],
    defenseKeys: ['kinetic_armor']
  };
  
  const mockBuildStatus = {
    success: true,
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
    buildQueue: [
      {
        itemKey: 'pulse_laser',
        itemType: 'weapon' as const,
        completionTime: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
        remainingSeconds: 300
      }
    ],
    totalDPS: 50,
    totalAccuracy: 85,
    totalKineticArmor: 100,
    totalEnergyShield: 0,
    totalMissileJammers: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryDataCache(); // Reset singleton state between tests
  });

  test('useFactoryDataCache_userNotLoggedIn_returnsNullDataAndNotLoading', async () => {
    // Act
    const { result } = renderHook(() => useFactoryDataCache(false, 1000));

    // Assert
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFactoryService.getTechCatalog).not.toHaveBeenCalled();
    expect(mockFactoryService.getBuildStatus).not.toHaveBeenCalled();
  });

  test('useFactoryDataCache_userLoggedIn_fetchesDataSuccessfully', async () => {
    // Arrange
    mockFactoryService.getTechCatalog.mockResolvedValue(mockTechCatalog);
    mockFactoryService.getBuildStatus.mockResolvedValue(mockBuildStatus);

    // Act
    const { result } = renderHook(() => useFactoryDataCache(true, 1000));

    // Assert - Initial loading state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert - Data loaded successfully
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.weapons).toEqual(mockTechCatalog.weapons);
    expect(result.current.data?.defenses).toEqual(mockTechCatalog.defenses);
    expect(result.current.data?.techCounts).toEqual(mockBuildStatus.techCounts);
    expect(result.current.data?.buildQueue).toHaveLength(1);
    expect(result.current.error).toBeNull();

    // Assert - Both API calls were made
    expect(mockFactoryService.getTechCatalog).toHaveBeenCalledOnce();
    expect(mockFactoryService.getBuildStatus).toHaveBeenCalledOnce();
  });

  test('useFactoryDataCache_catalogError_setsErrorState', async () => {
    // Arrange
    const errorResponse = { error: 'Failed to fetch tech catalog' };
    mockFactoryService.getTechCatalog.mockResolvedValue(errorResponse);
    mockFactoryService.getBuildStatus.mockResolvedValue(mockBuildStatus);

    // Act
    const { result } = renderHook(() => useFactoryDataCache(true, 1000));

    // Wait for error state
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch tech catalog');
    });

    // Assert
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  test('useFactoryDataCache_buildStatusError_setsErrorState', async () => {
    // Arrange
    const errorResponse = { error: 'Failed to fetch build status' };
    mockFactoryService.getTechCatalog.mockResolvedValue(mockTechCatalog);
    mockFactoryService.getBuildStatus.mockResolvedValue(errorResponse);

    // Act
    const { result } = renderHook(() => useFactoryDataCache(true, 1000));

    // Wait for error state
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch build status');
    });

    // Assert
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

});