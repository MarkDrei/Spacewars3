// User stats service for fetching iron and other user data
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://spacewars3.onrender.com/api' 
  : '/api';

export interface UserStatsResponse {
  iron: number;
  last_updated: number;
  ironPerSecond: number;
  maxIronCapacity: number;
  xp: number;
  level: number;
  xpForNextLevel: number;
}

export interface UserStatsError {
  error: string;
}

export const userStatsService = {
  async getUserStats(): Promise<UserStatsResponse | UserStatsError> {
    try {
      const response = await fetch(`${API_BASE}/user-stats`, {
        method: 'GET',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: data.error || `Server error: ${response.status}` };
      }
      
      return data;
    } catch (error) {
      console.error('Network error during getUserStats:', error);
      return { error: 'Network error' };
    }
  }
};
