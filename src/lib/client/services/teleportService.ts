// ---
// Teleport service for ship teleportation API calls
// ---

export interface TeleportRequest {
  x: number;
  y: number;
  preserveVelocity: boolean;
}

export interface TeleportResponse {
  success: boolean;
  ship: {
    x: number;
    y: number;
    speed: number;
    angle: number;
  };
  remainingCharges: number;
}

export interface TeleportError {
  error: string;
}

/**
 * Teleport the player's ship to the specified world coordinates.
 * @param params.x - Target world X coordinate (0 to worldWidth)
 * @param params.y - Target world Y coordinate (0 to worldHeight)
 * @param params.preserveVelocity - If true, keep current ship speed; if false, zero velocity
 */
export async function teleportShip(
  params: TeleportRequest
): Promise<TeleportResponse> {
  const response = await fetch('/api/teleport', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Teleport failed');
  }

  return response.json();
}
