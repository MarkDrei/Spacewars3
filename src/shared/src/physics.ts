// ---
// Shared physics calculations for both client and server
// ---

export interface PhysicsObject {
  x: number;
  y: number;
  speed: number;
  angle: number; // Always in degrees (0-360)
  last_position_update_ms: number;
}

export interface WorldBounds {
  width: number;
  height: number;
}

/**
 * Calculate new position for an object based on elapsed time
 * Used for both optimistic updates (client) and authoritative updates (server)
 */
export function updateObjectPosition(
  obj: PhysicsObject,
  currentTime: number,
  worldBounds: WorldBounds,
  factor: number = 50
): { x: number; y: number } {
  const elapsedMs = currentTime - obj.last_position_update_ms;
  
  // Calculate new position based on speed and angle
  // Speed is in units per minute, angle is in degrees
  const angleRadians = obj.angle * Math.PI / 180; // Convert degrees to radians for math functions
  const speedX = obj.speed * Math.cos(angleRadians);
  const speedY = obj.speed * Math.sin(angleRadians);
  
  // Convert from units/minute to units/ms: divide by 60 (seconds/minute) * 1000 (ms/second) = 60000
  // Add a factor to adjust speed for testing (try 10-100 for reasonable speeds)
  let newX = obj.x + ((speedX * elapsedMs / 60000) * factor);
  let newY = obj.y + ((speedY * elapsedMs / 60000) * factor);

  // Toroidal world wrapping
  newX = ((newX % worldBounds.width) + worldBounds.width) % worldBounds.width;
  newY = ((newY % worldBounds.height) + worldBounds.height) % worldBounds.height;
  
  return { x: newX, y: newY };
}

/**
 * Calculate new position for an object using client-side time correction
 * Accounts for clock drift and network latency
 */
export function updateObjectPositionWithTimeCorrection(
  obj: PhysicsObject,
  clientCurrentTime: number,
  responseReceivedAt: number,
  roundTripTime: number,
  worldBounds: WorldBounds,
  factor: number = 50
): { x: number; y: number } {
  // Calculate time elapsed using your specification:
  // "client time" - "time when response was received" + "estimation of roundtrip time"
  // where estimation of roundtrip time is half the total roundtrip time
  const networkDelayEstimate = roundTripTime / 2;
  const timeSinceResponse = clientCurrentTime - responseReceivedAt;
  const correctedElapsedMs = timeSinceResponse + networkDelayEstimate;
  
  // Calculate new position based on speed and angle
  // Speed is in units per minute, angle is in degrees
  const angleRadians = obj.angle * Math.PI / 180; // Convert degrees to radians for math functions
  const speedX = obj.speed * Math.cos(angleRadians);
  const speedY = obj.speed * Math.sin(angleRadians);
  
  // Convert from units/minute to units/ms: divide by 60 (seconds/minute) * 1000 (ms/second) = 60000
  // Add a factor to adjust speed for testing (try 10-100 for reasonable speeds)
  let newX = obj.x + ((speedX * correctedElapsedMs / 60000) * factor);
  let newY = obj.y + ((speedY * correctedElapsedMs / 60000) * factor);

  // Toroidal world wrapping
  newX = ((newX % worldBounds.width) + worldBounds.width) % worldBounds.width;
  newY = ((newY % worldBounds.height) + worldBounds.height) % worldBounds.height;
  
  return { x: newX, y: newY };
}

/**
 * Update multiple objects' positions
 */
export function updateAllObjectPositions<T extends PhysicsObject>(
  objects: T[],
  currentTime: number,
  worldBounds: WorldBounds,
  factor?: number
): T[] {
  return objects.map(obj => {
    const newPosition = updateObjectPosition(obj, currentTime, worldBounds, factor);
    return {
      ...obj,
      x: newPosition.x,
      y: newPosition.y,
      last_position_update_ms: currentTime
    };
  });
}

/**
 * Update multiple objects' positions with client-side time correction
 */
export function updateAllObjectPositionsWithTimeCorrection<T extends PhysicsObject>(
  objects: T[],
  clientCurrentTime: number,
  responseReceivedAt: number,
  roundTripTime: number,
  worldBounds: WorldBounds,
  factor?: number
): T[] {
  // Calculate corrected time for timestamp updates
  const networkDelayEstimate = roundTripTime / 2;
  const timeSinceResponse = clientCurrentTime - responseReceivedAt;
  const correctedTimestamp = responseReceivedAt + timeSinceResponse + networkDelayEstimate;
  
  return objects.map(obj => {
    const newPosition = updateObjectPositionWithTimeCorrection(
      obj, 
      clientCurrentTime, 
      responseReceivedAt, 
      roundTripTime, 
      worldBounds, 
      factor
    );
    return {
      ...obj,
      x: newPosition.x,
      y: newPosition.y,
      last_position_update_ms: correctedTimestamp
    };
  });
}

/**
 * Calculate distance between two points (considering toroidal world)
 */
export function calculateToroidalDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  worldBounds: WorldBounds
): number {
  const dx = Math.min(
    Math.abs(pos1.x - pos2.x),
    worldBounds.width - Math.abs(pos1.x - pos2.x)
  );
  const dy = Math.min(
    Math.abs(pos1.y - pos2.y),
    worldBounds.height - Math.abs(pos1.y - pos2.y)
  );
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two objects are within collision distance
 */
export function isColliding(
  obj1: PhysicsObject & { radius?: number },
  obj2: PhysicsObject & { radius?: number },
  worldBounds: WorldBounds
): boolean {
  const distance = calculateToroidalDistance(obj1, obj2, worldBounds);
  const combinedRadius = (obj1.radius || 10) + (obj2.radius || 10);
  return distance <= combinedRadius;
}
