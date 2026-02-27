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
  ship: { x: number; y: number; speed: number; angle: number };
  remainingCharges: number;
}

/**
 * Teleport the player's ship to the given world coordinates
 */
export async function teleportShip(params: TeleportRequest): Promise<TeleportResponse> {
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

  const data = await response.json();
  return data;
}
