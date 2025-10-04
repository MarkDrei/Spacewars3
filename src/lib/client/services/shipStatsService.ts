// ---
// Ship stats service for fetching current ship data
// ---

import { DefenseValues } from '@/shared/defenseValues';

export interface ShipStatsResponse {
  x: number;
  y: number;
  speed: number;
  angle: number;
  maxSpeed: number;
  last_position_update_ms: number;
  defenseValues: DefenseValues;
}

export interface ShipStatsError {
  error: string;
}

/**
 * Get current ship statistics including position, speed, angle, and max speed
 */
export async function getShipStats(): Promise<ShipStatsResponse | ShipStatsError> {
  try {
    const response = await fetch('/api/ship-stats', {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `Server error: ${response.status}` };
    }

    return data;
  } catch (error) {
    console.error('Ship stats service error:', error);
    return { error: 'Network error' };
  }
}
