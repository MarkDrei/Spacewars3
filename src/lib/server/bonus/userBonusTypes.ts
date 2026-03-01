// ---
// UserBonuses interface and related types
// Centralises pre-computed per-user bonus values derived from:
//   - Player level:      levelMultiplier = 1.15^(level - 1)
//   - Bridge commanders: commanderMultipliers via Commander.calculateBonuses()
//   - Tech-tree research: getResearchEffectFromTree() / weapon modifier functions
// ---

import type { CommanderStatKey } from '../inventory/Commander';

/** Base regeneration rate per second for hull, armor, and shield (no research involved). */
export const BASE_REGEN_RATE = 1.0;

/**
 * Pre-computed per-user bonus values.
 *
 * Layout:
 *  1. Raw multipliers — kept for mid-tick recalculation and debugging.
 *  2. Pre-computed final values — iron economy, defense regen, ship speed.
 *  3. Pre-computed weapon factors — combined multipliers for the battle system.
 */
export interface UserBonuses {
  // ─── Raw multipliers ────────────────────────────────────────────────────────

  /** 1.15^(level − 1).  Level 1 → 1.0, level 2 → 1.15, level 3 → 1.3225, … */
  levelMultiplier: number;

  /**
   * Per-stat commander multipliers (all keys always present).
   * Value 1.0 means no commander bonus for that stat.
   * Derived from Commander.calculateBonuses() bonus percentages: multiplier = 1 + bonusPercent/100.
   */
  commanderMultipliers: Record<CommanderStatKey, number>;

  // ─── Pre-computed final values ───────────────────────────────────────────────

  /** getResearchEffect(IronCapacity) × levelMultiplier */
  ironStorageCapacity: number;

  /** getResearchEffect(IronHarvesting) × levelMultiplier */
  ironRechargeRate: number;

  /** BASE_REGEN_RATE × levelMultiplier (no research involved) */
  hullRepairSpeed: number;

  /** BASE_REGEN_RATE × levelMultiplier (no research involved) */
  armorRepairSpeed: number;

  /** BASE_REGEN_RATE × levelMultiplier (no research involved) */
  shieldRechargeRate: number;

  /**
   * getResearchEffect(ShipSpeed) × (1 + afterburner/100) × levelMultiplier
   *   × commanderMultipliers.shipSpeed
   */
  maxShipSpeed: number;

  // ─── Pre-computed weapon factors ─────────────────────────────────────────────

  /** researchDamageMod(projectile) × levelMultiplier × commanderMultipliers.projectileWeaponDamage */
  projectileWeaponDamageFactor: number;

  /** researchReloadSpeedMod(projectile) × levelMultiplier × commanderMultipliers.projectileWeaponReloadRate */
  projectileWeaponReloadFactor: number;

  /** researchAccuracyMod(projectile) × levelMultiplier × commanderMultipliers.projectileWeaponAccuracy */
  projectileWeaponAccuracyFactor: number;

  /** researchDamageMod(energy) × levelMultiplier × commanderMultipliers.energyWeaponDamage */
  energyWeaponDamageFactor: number;

  /** researchReloadSpeedMod(energy) × levelMultiplier × commanderMultipliers.energyWeaponReloadRate */
  energyWeaponReloadFactor: number;

  /** researchAccuracyMod(energy) × levelMultiplier × commanderMultipliers.energyWeaponAccuracy */
  energyWeaponAccuracyFactor: number;
}
