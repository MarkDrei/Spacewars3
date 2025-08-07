// ---
// Navigation service for ship movement API calls
// ---

import { globalEvents } from './eventService';

export interface NavigateRequest {
  speed?: number;
  angle?: number;
}

export interface NavigateResponse {
  success: boolean;
  speed: number;
  angle: number;
  maxSpeed: number;
}

/**
 * Navigate the player's ship by changing speed and/or angle
 */
export async function navigateShip(params: NavigateRequest): Promise<NavigateResponse> {
  const response = await fetch('/api/navigate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Navigation failed');
  }

  const data = await response.json();
  
  // Emit navigation event for UI updates
  globalEvents.emit('navigation', data);
  
  return data;
}

/**
 * Set ship direction by clicking on canvas coordinates
 */
export async function setShipDirection(angle: number): Promise<NavigateResponse> {
  // Convert radians to degrees for the API
  const angleInDegrees = (angle * 180 / Math.PI + 360) % 360;
  
  return navigateShip({ angle: angleInDegrees });
}

/**
 * Set ship to intercept a target with max speed
 */
export async function interceptTarget(angleInDegrees: number, maxSpeed: number): Promise<NavigateResponse> {
  
  console.debug(`🎯 [CLIENT] Intercepting target - angle: ${angleInDegrees}°, maxSpeed: ${maxSpeed}`);
  
  return navigateShip({ 
    angle: angleInDegrees,
    speed: maxSpeed
  });
}
