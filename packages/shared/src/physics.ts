// ---
// Shared physics calculations for both client and server
// ---

export interface PhysicsObject {
  x: number;
  y: number;
  velocity: number;
  angle: number;
  last_position_update: number;
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
  worldBounds: WorldBounds
): { x: number; y: number } {
  const elapsedMs = currentTime - obj.last_position_update;
  
  // Calculate new position based on velocity and angle (velocity is in units per second)
  const velocityX = obj.velocity * Math.cos(obj.angle * Math.PI / 180);
  const velocityY = obj.velocity * Math.sin(obj.angle * Math.PI / 180);
  
  // Convert to milliseconds for smoother updates (divide by 1000 to get per-ms velocity)
  let newX = obj.x + (velocityX * elapsedMs / 1000);
  let newY = obj.y + (velocityY * elapsedMs / 1000);
  
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
  worldBounds: WorldBounds
): T[] {
  return objects.map(obj => {
    const newPosition = updateObjectPosition(obj, currentTime, worldBounds);
    return {
      ...obj,
      x: newPosition.x,
      y: newPosition.y,
      last_position_update: currentTime
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
