import { describe, expect, vi, test, beforeEach } from 'vitest';
import { collectionService } from '@/lib/client/services/collectionService';
import { userStatsService } from '@/lib/client/services/userStatsService';

// Mock the userStatsService
vi.mock('@/lib/client/services/userStatsService', () => ({
  userStatsService: {
    getUserStats: vi.fn()
  }
}));

// Mock fetch globally 
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('collectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    // Reset the mocked userStatsService
    vi.mocked(userStatsService.getUserStats).mockClear();
  });

  describe('collectObject', () => {
    test('collectObject_successfulResponse_returnsSuccess', async () => {
      // Arrange
      const objectId = 123;
      const mockResponse = {
        success: true,
        distance: 85.5,
        ironReward: 150,
        totalIron: 1150,
        objectType: 'asteroid'
      };
      
      const mockUpdatedStats = {
        iron: 1150,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/harvest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ objectId: 123 })
      });
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result).toEqual({
        success: true,
        distance: 85.5,
        ironReward: 150,
        totalIron: 1150,
        objectType: 'asteroid',
        updatedStats: mockUpdatedStats
      });
    });

    test('collectObject_apiError_returnsErrorResponse', async () => {
      // Arrange
      const objectId = 456;
      const mockErrorResponse = {
        error: 'Object too far away'
      };
      
      const mockUpdatedStats = {
        iron: 1000,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce(mockErrorResponse)
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result).toEqual({
        success: false,
        error: 'Object too far away',
        updatedStats: mockUpdatedStats
      });
    });

    test('collectObject_apiErrorWithoutMessage_returnsGenericError', async () => {
      // Arrange
      const objectId = 789;
      
      const mockUpdatedStats = {
        iron: 500,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValueOnce({})
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result).toEqual({
        success: false,
        error: 'Failed to collect object',
        updatedStats: mockUpdatedStats
      });
    });

    test('collectObject_successfulCollection_statsServiceError_returnsSuccessWithoutStats', async () => {
      // Arrange
      const objectId = 123;
      const mockResponse = {
        success: true,
        distance: 85.5,
        ironReward: 150,
        totalIron: 1150,
        objectType: 'asteroid'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });
      
      // Mock userStatsService to return an error
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce({ error: 'Stats service error' });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result).toEqual({
        success: true,
        distance: 85.5,
        ironReward: 150,
        totalIron: 1150,
        objectType: 'asteroid',
        updatedStats: undefined
      });
    });

    test('collectObject_networkError_returnsNetworkError', async () => {
      // Arrange
      const objectId = 999;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockUpdatedStats = {
        iron: 800,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('Network error during collection:', expect.any(Error));
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result).toEqual({
        success: false,
        error: 'Network error',
        updatedStats: mockUpdatedStats
      });
      
      consoleErrorSpy.mockRestore();
    });

    test('collectObject_networkError_statsServiceAlsoFails_returnsBareNetworkError', async () => {
      // Arrange
      const objectId = 999;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(userStatsService.getUserStats).mockRejectedValueOnce(new Error('Stats service also failed'));

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('Network error during collection:', expect.any(Error));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch updated stats after network error:', expect.any(Error));
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result).toEqual({
        success: false,
        error: 'Network error'
      });
      
      consoleErrorSpy.mockRestore();
    });

    test('collectObject_objectTooFar_returnsDistanceError', async () => {
      // Arrange
      const objectId = 111;
      const mockErrorResponse = {
        error: 'Object too far away'
      };
      
      const mockUpdatedStats = {
        iron: 600,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce(mockErrorResponse)
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Object too far away');
      expect(result.updatedStats).toEqual(mockUpdatedStats);
    });

    test('collectObject_cannotCollectShips_returnsError', async () => {
      // Arrange
      const objectId = 222;
      const mockErrorResponse = {
        error: 'Cannot collect player ships'
      };
      
      const mockUpdatedStats = {
        iron: 700,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce(mockErrorResponse)
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot collect player ships');
      expect(result.updatedStats).toEqual(mockUpdatedStats);
    });

    test('collectObject_asteroidCollection_returnsIronReward', async () => {
      // Arrange
      const objectId = 333;
      const mockResponse = {
        success: true,
        distance: 75.2,
        ironReward: 175,
        totalIron: 2175,
        objectType: 'asteroid'
      };
      
      const mockUpdatedStats = {
        iron: 2175,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);
      expect(result.ironReward).toBe(175);
      expect(result.totalIron).toBe(2175);
      expect(result.objectType).toBe('asteroid');
      expect(result.updatedStats).toEqual(mockUpdatedStats);
    });

    test('collectObject_shipwreckCollection_returnsHigherIronReward', async () => {
      // Arrange
      const objectId = 444;
      const mockResponse = {
        success: true,
        distance: 95.8,
        ironReward: 750,
        totalIron: 3750,
        objectType: 'shipwreck'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const mockUpdatedStats = {
        iron: 3750,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);
      expect(result.ironReward).toBe(750);
      expect(result.totalIron).toBe(3750);
      expect(result.objectType).toBe('shipwreck');
      expect(result.updatedStats).toEqual(mockUpdatedStats);
    });

    test('collectObject_escapePodCollection_returnsZeroReward', async () => {
      // Arrange
      const objectId = 555;
      const mockResponse = {
        success: true,
        distance: 45.3,
        ironReward: 0,
        totalIron: 1000,
        objectType: 'escape_pod'
      };
      
      const mockUpdatedStats = {
        iron: 1000,
        last_updated: 1234567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });
      
      vi.mocked(userStatsService.getUserStats).mockResolvedValueOnce(mockUpdatedStats);

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(userStatsService.getUserStats).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);
      expect(result.ironReward).toBe(0);
      expect(result.totalIron).toBe(1000);
      expect(result.objectType).toBe('escape_pod');
      expect(result.updatedStats).toEqual(mockUpdatedStats);
    });
  });
});
