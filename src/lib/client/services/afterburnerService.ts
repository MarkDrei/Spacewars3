// ---
// Client-side afterburner service for afterburner actions
// ---

/** Response from the afterburner action API */
export interface AfterburnerActionResponse {
  success: boolean;
  action: 'activated' | 'deactivated';
  boostedSpeed: number;
  previousSpeed: number;
  durationMs: number;
  cooldownMs: number;
  maxSpeed: number;
  fuelRemainingMs: number;
  fuelCapacityMs: number;
  fuelPercent: number;
}

/** Afterburner status included in ship-stats response */
export interface AfterburnerStatus {
  isActive: boolean;
  boostRemainingMs: number;
  cooldownRemainingMs: number;
  canActivate: boolean;
  durationResearchLevel: number;
  boostedSpeed: number;
  fuelRemainingMs: number;
  fuelCapacityMs: number;
  fuelPercent: number;
  timeToActivationMs: number;
  activationThresholdPercent: number;
}

/**
 * Activate the afterburner ability for the current user's ship.
 * Requires AfterburnerDuration research level >= 1.
 */
export async function activateAfterburner(): Promise<AfterburnerActionResponse> {
  return performAfterburnerAction('activate');
}

/**
 * Deactivate the afterburner ability and preserve the remaining fuel.
 */
export async function deactivateAfterburner(): Promise<AfterburnerActionResponse> {
  return performAfterburnerAction('deactivate');
}

async function performAfterburnerAction(action: 'activate' | 'deactivate'): Promise<AfterburnerActionResponse> {
  const response = await fetch('/api/afterburner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ action }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error: ${response.status}`);
  }

  return data;
}
