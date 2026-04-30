// ---
// TechFactory - Manages ship technology and equipment
// ---

import { getWeaponReloadTimeModifierFromTree, TechTree } from './techtree';

export type WeaponSubtype = 'Projectile' | 'Energy';
export type WeaponStrength = 'Weak' | 'Medium' | 'Strong';

export interface BuildQueueItem {
  itemKey: string;
  itemType: 'weapon' | 'defense';
  completionTime: number; // Unix timestamp when build completes
  isRecurring?: boolean;
}

export interface WeaponSpec {
  name: string;
  subtype: WeaponSubtype;
  strength: WeaponStrength;
  reloadTimeMinutes: number; // time in minutes to reload
  baseDamage: number;
  baseAccuracy: number; // percentage (0-100)
  baseCost: number; // iron cost
  shieldDamageRatio: number; // percentage of damage that goes to shields
  armorDamageRatio: number; // percentage of damage that goes to armor
  buildDurationMinutes: number;
  advantage: string;
  disadvantage: string;
  // Battle system properties
  damage: number; // actual damage per shot in battle
  // Note: Battle cooldown is calculated from reloadTimeMinutes using getBaseBattleCooldown()
}

export interface DefenseSpec {
  name: string;
  baseCost: number; // iron cost
  baseValue: number; // base defense value (HP)
  buildDurationMinutes: number;
  description: string;
}

export interface TechCounts {
  // Weapons
  pulse_laser: number;
  auto_turret: number;
  plasma_lance: number;
  gauss_rifle: number;
  photon_torpedo: number;
  rocket_launcher: number;

  // Defense
  ship_hull: number;
  kinetic_armor: number;
  energy_shield: number;
  missile_jammer: number;
}

export class TechFactory {
  private static readonly WEAPON_CATALOG: Record<string, WeaponSpec> = {
    auto_turret: {
      name: 'Auto Turret',
      subtype: 'Projectile',
      strength: 'Weak',
      reloadTimeMinutes: 12,
      baseDamage: 10,
      baseAccuracy: 50,
      baseCost: 100,
      shieldDamageRatio: 80,
      armorDamageRatio: 20,
      buildDurationMinutes: 1,
      advantage: 'Cheap, fast reload; full damage against shields',
      disadvantage: 'Reduced damage against kinetic armor',
      damage: 10 // 10 damage per shot
    },
    pulse_laser: {
      name: 'Pulse Laser',
      subtype: 'Energy',
      strength: 'Weak',
      reloadTimeMinutes: 12,
      baseDamage: 7,
      baseAccuracy: 80,
      baseCost: 150,
      shieldDamageRatio: 90,
      armorDamageRatio: 10,
      buildDurationMinutes: 2,
      advantage: 'High accuracy; full damage against armor',
      disadvantage: 'Reduced damage against energy shields; low base damage',
      damage: 8 // 8 damage per shot
    },
    gauss_rifle: {
      name: 'Gauss Rifle',
      subtype: 'Projectile',
      strength: 'Medium',
      reloadTimeMinutes: 15,
      baseDamage: 40,
      baseAccuracy: 70,
      baseCost: 500,
      shieldDamageRatio: 10,
      armorDamageRatio: 90,
      buildDurationMinutes: 5,
      advantage: 'Increasingly penetrates shields with higher projectile research; full damage against shields',
      disadvantage: 'Reduced damage against kinetic armor',
      damage: 35 // 35 damage per shot
    },
    plasma_lance: {
      name: 'Plasma Lance',
      subtype: 'Energy',
      strength: 'Medium',
      reloadTimeMinutes: 15,
      baseDamage: 30,
      baseAccuracy: 90,
      baseCost: 500,
      shieldDamageRatio: 70,
      armorDamageRatio: 30,
      buildDurationMinutes: 5,
      advantage: 'High accuracy bypasses a portion of armor — the more accurate, the more armor it skips',
      disadvantage: 'Reduced damage against energy shields',
      damage: 30 // 30 damage per shot
    },
    rocket_launcher: {
      name: 'Rocket Launcher',
      subtype: 'Projectile',
      strength: 'Strong',
      reloadTimeMinutes: 20,
      baseDamage: 200,
      baseAccuracy: 100,
      baseCost: 3500,
      shieldDamageRatio: 40,
      armorDamageRatio: 60,
      buildDurationMinutes: 20,
      advantage: 'Guided; always hits unless ECM Jammer is active; full damage against shields',
      disadvantage: 'Reduced damage against kinetic armor; susceptible to ECM jammers',
      damage: 150 // 150 damage per shot (huge!)
    },
    photon_torpedo: {
      name: 'Photon Torpedo',
      subtype: 'Energy',
      strength: 'Strong',
      reloadTimeMinutes: 20,
      baseDamage: 200,
      baseAccuracy: 75,
      baseCost: 2000,
      shieldDamageRatio: 90,
      armorDamageRatio: 10,
      buildDurationMinutes: 10,
      advantage: 'Heavy armor and hull damage; full damage against armor',
      disadvantage: 'Reduced damage against energy shields; slightly susceptible to ECM jammers',
      damage: 120 // 120 damage per shot (heavy)
    }
  };

  // Defense catalog
  private static readonly DEFENSE_CATALOG: Record<string, DefenseSpec> = {
    ship_hull: {
      name: 'Ship Hull',
      baseCost: 150,
      baseValue: 150,
      buildDurationMinutes: 2,
      description: 'The basic structure of the ship, providing minimal protection against all damage types. Protects the engine with the same value as the hull.'
    },
    kinetic_armor: {
      name: 'Kinetic Armor',
      baseCost: 200,
      baseValue: 250,
      buildDurationMinutes: 2,
      description: 'Reinforced plating that absorbs damage from physical and projectile-based weapons. Ideal for countering turrets, railguns, and rockets.'
    },
    energy_shield: {
      name: 'Energy Shield',
      baseCost: 200,
      baseValue: 250,
      buildDurationMinutes: 2,
      description: 'A protective energy field that absorbs or deflects energy-based attacks like lasers and plasma weapons. Recharges slowly over time.'
    },
    missile_jammer: {
      name: 'Missile Jammer',
      baseCost: 350,
      baseValue: 0, // Special defense, no HP
      buildDurationMinutes: 5,
      description: 'Electronic countermeasure system that scrambles enemy targeting systems. Disrupts guided weapons such as rockets and torpedoes.'
    }
  };

  /**
   * Type-safe accessor for TechCounts properties
   * Returns the count for a given tech key if it exists, otherwise 0
   */
  private static getTechCount(techCounts: TechCounts, key: string): number {
    // Type-safe check if the key exists in TechCounts
    if (key in techCounts && typeof techCounts[key as keyof TechCounts] === 'number') {
      return techCounts[key as keyof TechCounts];
    }

    return 0;
  }

  /**
   * Get weapon specification by key
   */
  static getWeaponSpec(weaponKey: string): WeaponSpec | null {
    return this.WEAPON_CATALOG[weaponKey] || null;
  }

  /**
   * Get all available weapon specs
   */
  static getAllWeaponSpecs(): Record<string, WeaponSpec> {
    return { ...this.WEAPON_CATALOG };
  }

  /**
   * Get all weapon keys that exist in the catalog
   */
  static getWeaponKeys(): string[] {
    return Object.keys(this.WEAPON_CATALOG);
  }

  /**
   * Get defense specification by key
   */
  static getDefenseSpec(defenseKey: string): DefenseSpec | null {
    return this.DEFENSE_CATALOG[defenseKey] || null;
  }

  /**
   * Get all available defense specs
   */
  static getAllDefenseSpecs(): Record<string, DefenseSpec> {
    return { ...this.DEFENSE_CATALOG };
  }

  /**
   * Get all defense keys that exist in the catalog
   */
  static getDefenseKeys(): string[] {
    return Object.keys(this.DEFENSE_CATALOG);
  }

  /**
   * Get specification for any tech item (weapon or defense)
   */
  static getTechSpec(itemKey: string, itemType: 'weapon' | 'defense'): WeaponSpec | DefenseSpec | null {
    if (itemType === 'weapon') {
      return this.getWeaponSpec(itemKey);
    } else {
      return this.getDefenseSpec(itemKey);
    }
  }

  /**
   * Calculate base battle cooldown (in seconds) from reloadTimeMinutes
   * Converts reloadTimeMinutes directly to seconds without scale factors
   * 
   * @param weaponSpec The weapon specification
   * @returns Base battle cooldown in seconds (before research modifiers)
   */
  static getBaseBattleCooldown(weaponSpec: WeaponSpec): number {
    // Convert reloadTimeMinutes directly to seconds
    // This creates a slower-paced battle system where weapon reload times match their design values
    return weaponSpec.reloadTimeMinutes * 60;
  }

  /**
   * Calculate total defense effects for a ship's current loadout
   */
  static calculateDefenseEffects(techCounts: TechCounts): {
    totalKineticArmor: number;
    totalEnergyShield: number;
    totalMissileJammers: number;
    totalDefenseCost: number;
  } {
    const defenseItems = [
      { key: 'kinetic_armor', count: techCounts.kinetic_armor },
      { key: 'energy_shield', count: techCounts.energy_shield },
      { key: 'missile_jammer', count: techCounts.missile_jammer }
    ];

    let totalDefenseCost = 0;

    for (const item of defenseItems) {
      const spec = this.getDefenseSpec(item.key);
      if (spec && item.count > 0) {
        totalDefenseCost += spec.baseCost * item.count;
      }
    }

    return {
      totalKineticArmor: techCounts.kinetic_armor,
      totalEnergyShield: techCounts.energy_shield,
      totalMissileJammers: techCounts.missile_jammer,
      totalDefenseCost
    };
  }

  /**
   * Calculate stacked base defense values (base value * count)
   * Does NOT include research factors.
   */
  static calculateStackedBaseDefense(techCounts: TechCounts): {
    hull: number;
    armor: number;
    shield: number;
  } {
    return {
      hull: techCounts.ship_hull * this.DEFENSE_CATALOG.ship_hull.baseValue,
      armor: techCounts.kinetic_armor * this.DEFENSE_CATALOG.kinetic_armor.baseValue,
      shield: techCounts.energy_shield * this.DEFENSE_CATALOG.energy_shield.baseValue
    };
  }

  /**
   * Check if a defense item can be built
   */
  static canBuildDefense(defenseKey: string, availableIron: number): boolean {
    const spec = this.getDefenseSpec(defenseKey);
    return spec ? availableIron >= spec.baseCost : false;
  }



  /**
   * Calculate total weapon effects for a ship's current loadout
   */
  static calculateWeaponEffects(techCounts: TechCounts): {
    totalDPS: number;
    totalAccuracy: number;
    totalCost: number;
  } {
    let totalDPS = 0;
    let weightedAccuracy = 0;
    let totalCost = 0;
    let totalDamage = 0;

    Object.entries(this.WEAPON_CATALOG).forEach(([key, spec]) => {
      const count = this.getTechCount(techCounts, key);
      if (count > 0) {
        // DPS = damage / reload time (converted to seconds)
        const weaponDPS = spec.baseDamage / (spec.reloadTimeMinutes * 60);
        const weaponTotalDPS = weaponDPS * count;

        totalDPS += weaponTotalDPS;
        weightedAccuracy += spec.baseAccuracy * weaponTotalDPS;
        totalCost += spec.baseCost * count;
        totalDamage += weaponTotalDPS;
      }
    });

    const averageAccuracy = totalDamage > 0 ? weightedAccuracy / totalDamage : 0;

    return {
      totalDPS,
      totalAccuracy: averageAccuracy,
      totalCost
    };
  }

  /**
   * Check if a weapon can be built (placeholder for future cost/requirement checks)
   */
  static canBuildWeapon(weaponKey: string, availableIron: number): boolean {
    const spec = this.getWeaponSpec(weaponKey);
    return spec ? availableIron >= spec.baseCost : false;
  }

  /**
   * Calculate total tech effects for a ship's current loadout (weapons + defense)
   */
  static calculateTotalEffects(techCounts: TechCounts): {
    weapons: {
      totalDPS: number;
      totalAccuracy: number;
      totalCost: number;
    };
    defense: {
      totalKineticArmor: number;
      totalEnergyShield: number;
      totalMissileJammers: number;
      totalDefenseCost: number;
    };
    grandTotalCost: number;
  } {
    const weaponEffects = this.calculateWeaponEffects(techCounts);
    const defenseEffects = this.calculateDefenseEffects(techCounts);

    return {
      weapons: weaponEffects,
      defense: defenseEffects,
      grandTotalCost: weaponEffects.totalCost + defenseEffects.totalDefenseCost
    };
  }

  /**
   * Calculate research-modified reload time for a weapon in seconds.
   * Applies research effects from the tech tree to the base cooldown value.
   *
   * @param weaponKey The weapon key (e.g., 'pulse_laser', 'rocket_launcher')
   * @param techTree The tech tree containing research levels
   * @param totalReloadFactor Optional pre-computed combined bonus factor (research × level × commander).
   *   When provided, it replaces the internal techtree lookup so the caller can apply
   *   the full `bonuses.projectile/energyWeaponReloadFactor` directly.
   *   When omitted, the factor is derived from techtree research only.
   * @returns The reload time in seconds, modified by research (and bonus if provided)
   */
  static calculateWeaponReloadTime(weaponKey: string, techTree: TechTree, totalReloadFactor?: number): number {
    const weaponSpec = this.getWeaponSpec(weaponKey);
    if (!weaponSpec) {
      throw new Error(`Unknown weapon: ${weaponKey}`);
    }

    // Get base battle cooldown from reloadTimeMinutes
    const baseCooldown = this.getBaseBattleCooldown(weaponSpec);

    // Use the provided total factor (includes research + level + commander) or
    // fall back to research-only factor from the tech tree.
    const factor = totalReloadFactor ?? getWeaponReloadTimeModifierFromTree(techTree, weaponKey);

    // Divide base cooldown by factor: baseCooldown / factor
    return baseCooldown / factor;
  }

  /**
   * Calculate weapon damage effects against a target.
   *
   * Damage flows sequentially: shield → armor → hull.  Each layer has a
   * resistance modifier that determines how many real-damage units are needed
   * to remove one HP from that layer.  Any damage not absorbed by a layer
   * carries through to the next.
   *
   * Layer resistances:
   *   - Shields resist energy weapons  (energy weapons deal 0.5× to shields)
   *   - Armor   resists projectile weapons (projectile weapons deal 0.5× to armor)
   *   - Hull    has no resistance (all weapon types deal full damage)
   *
   * Special weapon mechanics:
   *   - Gauss Rifle (Projectile): progressively penetrates shields based on
   *     `projectileResearchLevel`.  Bypass fraction = 1 − 0.95^level.
   *     At level 0: 0% bypass.  Level 10: ~40%.  Level 20: ~64%.
   *   - Plasma Lance (Energy): accuracy above 100% bypasses a portion of armor.
   *     Bypass fraction = max(0, 1 − 1/accuracyMultiplier).
   *     At 1.0× accuracy: 0% bypass.  2.0×: 50%.  3.0×: ~67%.
   *
   * @param weaponKey                Key for the weapon (e.g. 'pulse_laser').
   * @param weaponCount              Number of weapons of this type firing.
   * @param opponentShieldValue      Current shield HP of the defending ship.
   * @param opponentArmorValue       Current armor HP of the defending ship.
   * @param accuracyMultiplier       Multiplicative accuracy bonus
   *                                 (1.0 = no bonus, >1.0 = better accuracy).
   * @param negativeAccuracyModifier Decimal accuracy penalty
   *                                 (e.g. ECM or torpedo penalty; 0 = no penalty).
   * @param baseDamageModifier       Damage multiplier (1.0 = normal damage).
   * @param ecmEffectiveness         ECM effectiveness against guided weapons
   *                                 (0 = none, 1 = full effectiveness).
   * @param spreadValue              Randomisation factor for hit calculation
   *                                 (1.0 = normal spread).
   * @param projectileResearchLevel  Projectile weapon tier research level;
   *                                 controls Gauss Rifle shield penetration
   *                                 (default 0 = no penetration).
   * @returns Object containing
   *          `{ weaponsHit, shieldDamage, armorDamage, hullDamage }`.
   */
  static calculateWeaponDamage(
    weaponKey: string,
    weaponCount: number,
    opponentShieldValue: number,
    opponentArmorValue: number,
    accuracyMultiplier: number,
    negativeAccuracyModifier: number,
    baseDamageModifier: number,
    ecmEffectiveness: number,
    spreadValue: number,
    projectileResearchLevel: number = 0
  ): { weaponsHit: number; shieldDamage: number; armorDamage: number; hullDamage: number } {
    // Get weapon specification
    const weaponSpec = this.getWeaponSpec(weaponKey);
    if (!weaponSpec) {
      throw new Error(`Unknown weapon: ${weaponKey}`);
    }

    // If no weapons of this type are present, nothing can hit
    if (weaponCount === 0) {
      return { weaponsHit: 0, shieldDamage: 0, armorDamage: 0, hullDamage: 0 };
    }

    // Calculate overall accuracy based on weapon type
    // accuracyMultiplier is a multiplicative factor (1.0 = no bonus, >1.0 = better accuracy)
    let overallAccuracy: number;

    if (weaponKey === 'rocket_launcher') {
      // Rocket Launcher: (base × multiplier) * (1 - ECM)
      overallAccuracy = (weaponSpec.baseAccuracy * accuracyMultiplier) * (1 - ecmEffectiveness);
    } else if (weaponKey === 'photon_torpedo') {
      // Photon Torpedo: (base × multiplier) * (1 - negative/3) * (1 - ECM/3)
      overallAccuracy = (weaponSpec.baseAccuracy * accuracyMultiplier) *
        (1 - (negativeAccuracyModifier / 3)) *
        (1 - (ecmEffectiveness / 3));
    } else {
      // Other weapons: (base × multiplier) * (1 - negative)
      overallAccuracy = (weaponSpec.baseAccuracy * accuracyMultiplier) * (1 - negativeAccuracyModifier);
    }

    // Calculate weapons that hit (with spread and capped at weapon count)
    const weaponsHitFloat = (overallAccuracy / 100) * weaponCount * spreadValue;
    const weaponsHit = Math.min(Math.round(weaponsHitFloat), weaponCount);

    if (weaponsHit === 0) {
      return { weaponsHit: 0, shieldDamage: 0, armorDamage: 0, hullDamage: 0 };
    }

    // Total raw damage from all hits
    let remainingDamage = weaponsHit * weaponSpec.baseDamage * baseDamageModifier;

    // ------------------------------------------------------------------ //
    // SHIELD LAYER                                                         //
    // Shields resist energy weapons: energy deals 0.5× effective damage.  //
    // Projectile weapons deal full damage to shields.                      //
    //                                                                      //
    // Gauss Rifle special: a fraction of damage bypasses shields entirely, //
    // determined by projectile research level.                             //
    // ------------------------------------------------------------------ //
    const shieldMod = weaponSpec.subtype === 'Energy' ? 0.5 : 1.0;

    // Gauss Rifle shield bypass: bypass fraction = 1 - 0.95^level
    const gaussBypassFraction =
      weaponKey === 'gauss_rifle' ? 1 - Math.pow(0.95, projectileResearchLevel) : 0;
    const shieldBypassDamage = remainingDamage * gaussBypassFraction;
    const shieldFacingDamage = remainingDamage - shieldBypassDamage;

    // Effective damage to shield HP = shieldFacingDamage × shieldMod
    const effectiveDamageAtShield = shieldFacingDamage * shieldMod;
    const shieldHPRemoved = Math.min(effectiveDamageAtShield, opponentShieldValue);
    // Real damage consumed by shield = HP removed / shieldMod
    const damageConsumedByShield = shieldHPRemoved / shieldMod;
    remainingDamage = shieldFacingDamage - damageConsumedByShield + shieldBypassDamage;

    // ------------------------------------------------------------------ //
    // ARMOR LAYER                                                          //
    // Armor resists projectile weapons: projectile deals 0.5× effective.  //
    // Energy weapons deal full damage to armor.                            //
    //                                                                      //
    // Plasma Lance special: high accuracy bypasses a portion of armor.    //
    // bypass fraction = max(0, 1 - 1/accuracyMultiplier).                 //
    // ------------------------------------------------------------------ //
    const armorMod = weaponSpec.subtype === 'Projectile' ? 0.5 : 1.0;

    // Plasma Lance armor bypass: bypass fraction = max(0, 1 - 1/accuracyMultiplier)
    const plasmaBypassFraction =
      weaponKey === 'plasma_lance' ? Math.max(0, 1 - 1 / accuracyMultiplier) : 0;
    const armorBypassDamage = remainingDamage * plasmaBypassFraction;
    const armorFacingDamage = remainingDamage - armorBypassDamage;

    // Effective damage to armor HP = armorFacingDamage × armorMod
    const effectiveDamageAtArmor = armorFacingDamage * armorMod;
    const armorHPRemoved = Math.min(effectiveDamageAtArmor, opponentArmorValue);
    // Real damage consumed by armor = HP removed / armorMod
    const damageConsumedByArmor = armorHPRemoved / armorMod;
    remainingDamage = armorFacingDamage - damageConsumedByArmor + armorBypassDamage;

    // ------------------------------------------------------------------ //
    // HULL LAYER                                                           //
    // No resistance — all remaining damage hits hull directly.            //
    // ------------------------------------------------------------------ //
    const hullDamage = remainingDamage;

    return {
      weaponsHit,
      shieldDamage: Math.round(shieldHPRemoved),
      armorDamage: Math.round(armorHPRemoved),
      hullDamage: Math.round(hullDamage)
    };
  }
}
