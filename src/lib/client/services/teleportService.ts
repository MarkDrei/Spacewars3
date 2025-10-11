// ---
// Teleport service for teleportation API calls
// ---

export interface TeleportStatsResponse {
  level: number;
  range: number;
  available: boolean;
}

export interface TeleportRequest {
  targetX: number;
  targetY: number;
}

export interface TeleportResponse {
  success: boolean;
  ship: {
    id: number;
    x: number;
    y: number;
    speed: number;
    angle: number;
    lastUpdate: number;
  };
  teleportation: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    distance: number;
    maxRange: number;
  };
  message: string;
}

export interface TeleportError {
  error: string;
}

/**
 * Get teleport statistics including level and range
 */
export async function getTeleportStats(): Promise<TeleportStatsResponse | TeleportError> {
  try {
    const response = await fetch('/api/techtree', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      return { error: data.error || `Server error: ${response.status}` };
    }

    const data = await response.json();
    
    // Extract teleport info from tech tree
    const teleportLevel = data.teleport || 0;
    const teleportRange = data.effects?.teleport || 0;
    
    return {
      level: teleportLevel,
      range: teleportRange,
      available: teleportLevel > 0
    };
  } catch (error) {
    console.error('Teleport stats service error:', error);
    return { error: 'Network error' };
  }
}

/**
 * Teleport the player's ship to target coordinates
 */
export async function teleportShip(targetX: number, targetY: number): Promise<TeleportResponse | TeleportError> {
  try {
    const response = await fetch('/api/teleport', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ targetX, targetY }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || data.message || `Server error: ${response.status}` };
    }

    return data;
  } catch (error) {
    console.error('Teleport service error:', error);
    return { error: 'Network error' };
  }
}
