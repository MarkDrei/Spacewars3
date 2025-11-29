import { WorldData } from '@shared/types/gameTypes';

interface WorldDataWithTiming {
  data: WorldData;
  responseReceivedAt: number;
  roundTripTime: number;
}

class WorldDataService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api';
  }

  /**
   * Fetch world data from the server
   */
  async getWorldData(): Promise<{ success: true; data: WorldDataWithTiming } | { success: false; error: string }> {
    try {
      const requestStartTime = Date.now();
      
      const response = await fetch(`${this.baseUrl}/world`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseReceivedAt = Date.now();
      const roundTripTime = responseReceivedAt - requestStartTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        return { success: false, error: errorData.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { 
        success: true, 
        data: {
          data,
          responseReceivedAt,
          roundTripTime
        }
      };
    } catch (error) {
      console.error('World data service error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

export const worldDataService = new WorldDataService();
