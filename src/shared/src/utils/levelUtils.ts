/**
 * Calculates the player level from accumulated XP.
 *
 * Pattern: Each level requires 1000 more XP than the previous increment.
 * Increment for level N is the triangular number (N-1): (N-1)*N/2 * 1000
 *
 * Level 1: requires    1000 XP  (1*2/2 * 1000)
 * Level 2: requires    3000 XP  (2*3/2 * 1000)
 * Level 3: requires    6000 XP  (3*4/2 * 1000)
 * …
 */
export function calculateLevelFromXp(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (true) {
    const xpForNextLevel = (level * (level + 1) / 2) * 1000;
    if (remaining < xpForNextLevel) {
      break;
    }
    remaining -= xpForNextLevel;
    level++;
  }
  return level;
}

/**
 * Returns the name color for an enemy ship based on its level relative to the player.
 *
 * Rules:
 *   diff < -3 or diff > +3 → gray '#808080'  (attack not possible)
 *   diff == -3              → green '#00ff00'
 *   diff ==  0              → white '#ffffff'
 *   diff == +3              → red   '#ff0000'
 *   between -3…0 and 0…+3  → smooth interpolation
 */
export function getShipNameColor(playerLevel: number, otherLevel: number): string {
  const diff = otherLevel - playerLevel;

  if (diff < -3 || diff > 3) {
    return '#808080'; // gray – out of attack range
  }

  if (diff < 0) {
    // Interpolate between green (diff=-3) and white (diff=0)
    const t = (diff + 3) / 3; // 0 at diff=-3, 1 at diff=0
    const r = Math.round(0x00 + t * (0xff - 0x00)); // 0 → 255
    const g = 0xff;
    const b = Math.round(0x00 + t * (0xff - 0x00)); // 0 → 255
    return `rgb(${r},${g},${b})`;
  }

  if (diff > 0) {
    // Interpolate between white (diff=0) and red (diff=+3)
    const t = diff / 3; // 0 at diff=0, 1 at diff=+3
    const r = 0xff;
    const g = Math.round(0xff - t * 0xff); // 255 → 0
    const b = Math.round(0xff - t * 0xff); // 255 → 0
    return `rgb(${r},${g},${b})`;
  }

  return '#ffffff'; // diff == 0 → white
}

/**
 * Returns true when a battle between the two levels is allowed (level difference ≤ 3).
 */
export function isAttackAllowed(attackerLevel: number, targetLevel: number): boolean {
  return Math.abs(targetLevel - attackerLevel) <= 3;
}
