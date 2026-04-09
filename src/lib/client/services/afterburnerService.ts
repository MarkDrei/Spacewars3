// ---
// Client-side afterburner service for activating afterburner ability
// ---

/** Response from the afterburner activation API */
export interface AfterburnerActivateResponse {
  success: boolean;
  boostedSpeed: number;
  previousSpeed: number;
  durationMs: number;
  cooldownMs: number;
  maxSpeed: number;
}

/** Afterburner status included in ship-stats response */
export interface AfterburnerStatus {
  isActive: boolean;
  boostRemainingMs: number;
  cooldownRemainingMs: number;
  canActivate: boolean;
  durationResearchLevel: number;
  boostedSpeed: number;
}

/**
 * Activate the afterburner ability for the current user's ship.
 * Requires AfterburnerDuration research level >= 1.
 */
export async function activateAfterburner(): Promise<AfterburnerActivateResponse> {
  const response = await fetch('/api/afterburner', {
    method: 'POST',
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error: ${response.status}`);
  }

  return data;
}
