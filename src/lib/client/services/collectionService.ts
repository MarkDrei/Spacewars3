// Collection service for collecting space objects
import { userStatsService } from './userStatsService';

export interface CollectionResult {
  success: boolean;
  distance?: number;
  ironReward?: number;
  totalIron?: number;
  objectType?: string;
  error?: string;
  updatedStats?: {
    iron: number;
    last_updated: number;
    ironPerSecond: number;
  };
}

export const collectionService = {
  async collectObject(objectId: number): Promise<CollectionResult> {
    try {
      console.log(`🚀 Collection service sending request for object ID: ${objectId}`);
      
      const requestBody = JSON.stringify({ objectId });
      console.log(`📤 Request body: ${requestBody}`);
      
      const response = await fetch('/api/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log(`📋 Response data:`, data);
      
      // Fetch updated user stats after collection attempt
      console.log(`🔄 Fetching updated user stats after collection...`);
      const updatedStats = await userStatsService.getUserStats();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to collect object',
          // Include updated stats even on failure (iron might have been updated due to time passage)
          updatedStats: 'error' in updatedStats ? undefined : updatedStats
        };
      }
      
      return {
        success: true,
        distance: data.distance,
        ironReward: data.ironReward,
        totalIron: data.totalIron,
        objectType: data.objectType,
        // Include the fresh user stats
        updatedStats: 'error' in updatedStats ? undefined : updatedStats
      };
    } catch (error) {
      console.error('Network error during collection:', error);
      
      // Even on network error, try to fetch updated stats (user might have gained iron from time passage)
      console.log(`🔄 Attempting to fetch user stats despite network error...`);
      try {
        const updatedStats = await userStatsService.getUserStats();
        return {
          success: false,
          error: 'Network error',
          updatedStats: 'error' in updatedStats ? undefined : updatedStats
        };
      } catch (statsError) {
        console.error('Failed to fetch updated stats after network error:', statsError);
        return {
          success: false,
          error: 'Network error'
        };
      }
    }
  }
};
