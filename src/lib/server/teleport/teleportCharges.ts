/** Distance threshold in world units above which a full charge is consumed. */
const FULL_CHARGE_DISTANCE = 2000;

/**
 * Calculate the teleport charge cost based on travel distance.
 * Jumps beyond FULL_CHARGE_DISTANCE cost exactly 1 charge.
 * Shorter jumps cost proportionally less.
 */
export function calculateTeleportChargeCost(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.min(1, distance / FULL_CHARGE_DISTANCE);
}
