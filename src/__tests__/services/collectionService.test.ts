import { describe, expect, vi, test, beforeEach } from 'vitest';
import { collectionService } from '@/lib/client/services/collectionService';

// Mock fetch globally 
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('collectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
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
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ objectId: 123 })
      });
      expect(result).toEqual({
        success: true,
        distance: 85.5,
        ironReward: 150,
        totalIron: 1150,
        objectType: 'asteroid'
      });
    });

    test('collectObject_apiError_returnsErrorResponse', async () => {
      // Arrange
      const objectId = 456;
      const mockErrorResponse = {
        error: 'Object too far away'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce(mockErrorResponse)
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Object too far away'
      });
    });

    test('collectObject_apiErrorWithoutMessage_returnsGenericError', async () => {
      // Arrange
      const objectId = 789;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValueOnce({})
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to collect object'
      });
    });

    test('collectObject_networkError_returnsNetworkError', async () => {
      // Arrange
      const objectId = 999;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('Network error during collection:', expect.any(Error));
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
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce(mockErrorResponse)
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Object too far away');
    });

    test('collectObject_cannotCollectShips_returnsError', async () => {
      // Arrange
      const objectId = 222;
      const mockErrorResponse = {
        error: 'Cannot collect player ships'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce(mockErrorResponse)
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot collect player ships');
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
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.ironReward).toBe(175);
      expect(result.totalIron).toBe(2175);
      expect(result.objectType).toBe('asteroid');
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

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.ironReward).toBe(750);
      expect(result.totalIron).toBe(3750);
      expect(result.objectType).toBe('shipwreck');
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
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await collectionService.collectObject(objectId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.ironReward).toBe(0);
      expect(result.totalIron).toBe(1000);
      expect(result.objectType).toBe('escape_pod');
    });
  });
});
