import { userStatsService } from '../src/services/userStatsService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('userStatsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('getUserStats', () => {
    test('getUserStats_successfulResponse_returnsUserStats', async () => {
      // Arrange
      const mockResponse = {
        iron: 1000,
        last_updated: 1674567890,
        ironPerSecond: 2.5
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Act
      const result = await userStatsService.getUserStats();

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/user-stats', {
        method: 'GET',
        credentials: 'include'
      });
      expect(result).toEqual(mockResponse);
    });

    test('getUserStats_serverError_returnsErrorObject', async () => {
      // Arrange
      const errorResponse = { error: 'Internal server error' };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce(errorResponse)
      });

      // Act
      const result = await userStatsService.getUserStats();

      // Assert
      expect(result).toEqual({ error: 'Internal server error' });
    });

    test('getUserStats_serverErrorWithoutMessage_returnsGenericError', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValueOnce({})
      });

      // Act
      const result = await userStatsService.getUserStats();

      // Assert
      expect(result).toEqual({ error: 'Server error: 404' });
    });

    test('getUserStats_networkError_returnsNetworkError', async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await userStatsService.getUserStats();

      // Assert
      expect(result).toEqual({ error: 'Network error' });
    });

    test('getUserStats_unauthorizedResponse_returnsUnauthorizedError', async () => {
      // Arrange
      const errorResponse = { error: 'Not authenticated' };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce(errorResponse)
      });

      // Act
      const result = await userStatsService.getUserStats();

      // Assert
      expect(result).toEqual({ error: 'Not authenticated' });
    });
  });
});
