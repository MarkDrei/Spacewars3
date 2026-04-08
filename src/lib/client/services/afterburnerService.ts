// ---
// Afterburner service for triggering the afterburner ability
// ---

export interface AfterburnerResponse {
  success: boolean;
  afterburner: {
    isActive: boolean;
    boostedSpeed: number;
    oldMaxSpeed: number;
    durationSeconds: number;
    cooldownEndMs: number;
    speedBoostPercent: number;
  };
  ship: {
    id: number;
    x: number;
    y: number;
    speed: number;
    angle: number;
  };
}

export interface AfterburnerError {
  error: string;
}

/**
 * Trigger the afterburner ability
 */
export async function triggerAfterburner(): Promise<AfterburnerResponse> {
  const response = await fetch('/api/afterburner', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error: ${response.status}`);
  }

  return data;
}
