import { calculateToroidalDistance, type WorldBounds } from '@shared/physics';

/** Distance threshold in world units above which a full charge is consumed. */
const FULL_CHARGE_DISTANCE = 2000;

/**
 * Calculate the teleport charge cost based on the jump distance.
 * The world wraps at its edges, so the distance is the shortest (toroidal) one: a jump across
 * an edge costs as little as the neighbouring position on the other side suggests.
 * Jumps beyond FULL_CHARGE_DISTANCE cost exactly 1 charge; shorter jumps cost proportionally less.
 */
export function calculateTeleportChargeCost(
  from: { x: number; y: number },
  to: { x: number; y: number },
  worldSize: WorldBounds
): number {
  const distance = calculateToroidalDistance(from, to, worldSize);
  return Math.min(1, distance / FULL_CHARGE_DISTANCE);
}
