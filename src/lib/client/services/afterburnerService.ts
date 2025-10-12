// ---
// Afterburner service for afterburner activation API calls
// ---

import { globalEvents } from './eventService';

export interface AfterburnerResponse {
  success: boolean;
  afterburner: {
    baseSpeed: number;
    boostedSpeed: number;
    speedIncrease: number;
    duration: number;
    cooldownEndMs: number;
    currentSpeed: number;
  };
  ship: {
    id: number;
    x: number;
    y: number;
    speed: number;
    angle: number;
    lastUpdate: number;
  };
  message: string;
}

export interface AfterburnerErrorResponse {
  error: string;
}

/**
 * Trigger the afterburner to boost ship speed
 */
export async function triggerAfterburner(): Promise<AfterburnerResponse | AfterburnerErrorResponse> {
  try {
    const response = await fetch('/api/afterburner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Failed to trigger afterburner' };
    }

    // Emit afterburner event for UI updates
    globalEvents.emit('afterburner-activated', data);
    
    return data;
  } catch (error) {
    console.error('❌ [CLIENT] Afterburner error:', error);
    return { error: 'Failed to trigger afterburner' };
  }
}
