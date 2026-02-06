// ---
// TechFactory - Manages ship technology and equipment
// ---

export type WeaponSubtype = 'Projectile' | 'Energy';
export type WeaponStrength = 'Weak' | 'Medium' | 'Strong';

export interface BuildQueueItem {
  itemKey: string;
  itemType: 'weapon' | 'defense';
  completionTime: number; // Unix timestamp when build completes
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
  cooldown: number; // cooldown time in seconds between shots
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
      advantage: 'Cheap and good damage per second',
      disadvantage: 'Low accuracy vs agile targets',
      damage: 10, // 10 damage per shot
      cooldown: 3 // fires every 3 seconds (fast)
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
      advantage: 'High accuracy',
      disadvantage: 'Low damage output',
      damage: 8, // 8 damage per shot
      cooldown: 2 // fires every 2 seconds (very fast)
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
      advantage: 'High impact; penetrates shields',
      disadvantage: 'Low accuracy vs agile targets',
      damage: 35, // 35 damage per shot
      cooldown: 5 // fires every 5 seconds (medium)
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
      advantage: 'Locally overheats shields and causes hull damage',
      disadvantage: '',
      damage: 30, // 30 damage per shot
      cooldown: 4 // fires every 4 seconds (medium-fast)
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
      advantage: 'Guided; always hits unless ECM Jammer is active',
      disadvantage: 'Susceptible to ECM jammers',
      damage: 150, // 150 damage per shot (huge!)
      cooldown: 10 // fires every 10 seconds (slow but powerful)
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
      advantage: 'Heavy shield damage',
      disadvantage: 'Slightly susceptible to ECM jammers',
      damage: 120, // 120 damage per shot (heavy)
      cooldown: 8 // fires every 8 seconds (medium-slow)
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
   * Calculate actual reload time for a weapon considering research effects
   * @param weaponKey The weapon type (e.g., 'pulse_laser', 'auto_turret')
   * @param techTree The user's research tree
   * @returns Reload time in seconds for use in battles
   */
  static calculateReloadTime(weaponKey: string, techTree: { projectileReloadRate: number; energyRechargeRate: number }): number {
    const spec = this.getWeaponSpec(weaponKey);
    if (!spec) return 0;

    // Base reload time in seconds (convert from minutes)
    const baseReloadTimeSeconds = spec.reloadTimeMinutes * 60;

    // Determine which research applies based on weapon subtype
    let reloadRateReduction = 0;
    if (spec.subtype === 'Projectile') {
      // ProjectileReloadRate: 10% reduction per level
      reloadRateReduction = techTree.projectileReloadRate * 10;
    } else if (spec.subtype === 'Energy') {
      // EnergyRechargeRate: 15% reduction per level
      reloadRateReduction = techTree.energyRechargeRate * 15;
    }

    // Apply reduction (capped at 90% to prevent reload time from going to zero)
    const effectiveReduction = Math.min(reloadRateReduction, 90);
    const reloadTime = baseReloadTimeSeconds * (1 - effectiveReduction / 100);

    return reloadTime;
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
   * Calculate weapon damage effects against a target
   */
  static calculateWeaponDamage(
    weaponKey: string,
    techCounts: TechCounts,
    opponentShieldValue: number,
    opponentArmorValue: number,
    positiveAccuracyModifier: number,
    negativeAccuracyModifier: number,
    baseDamageModifier: number,
    ecmEffectiveness: number,
    spreadValue: number
  ): { weaponsHit: number; shieldDamage: number; armorDamage: number; hullDamage: number } {
    // Get weapon specification
    const weaponSpec = this.getWeaponSpec(weaponKey);
    if (!weaponSpec) {
      throw new Error(`Unknown weapon: ${weaponKey}`);
    }

    // Get number of weapons of this type
    const weaponCount = this.getTechCount(techCounts, weaponKey);
    if (weaponCount === 0) {
      return { weaponsHit: 0, shieldDamage: 0, armorDamage: 0, hullDamage: 0 };
    }

    // Calculate overall accuracy based on weapon type
    let overallAccuracy: number;

    if (weaponKey === 'rocket_launcher') {
      // Rocket Launcher: (base + positive) * (1 - ECM)
      overallAccuracy = (weaponSpec.baseAccuracy + positiveAccuracyModifier) * (1 - ecmEffectiveness);
    } else if (weaponKey === 'photon_torpedo') {
      // Photon Torpedo: (base + positive) * (1 - negative/3) * (1 - ECM/3)
      overallAccuracy = (weaponSpec.baseAccuracy + positiveAccuracyModifier) *
        (1 - (negativeAccuracyModifier / 3)) *
        (1 - (ecmEffectiveness / 3));
    } else {
      // Other weapons: (base + positive) * (1 - negative)
      overallAccuracy = (weaponSpec.baseAccuracy + positiveAccuracyModifier) * (1 - negativeAccuracyModifier);
    }

    // Calculate weapons that hit (with spread and capped at weapon count)
    const weaponsHitFloat = (overallAccuracy / 100) * weaponCount * spreadValue;
    const weaponsHit = Math.min(Math.round(weaponsHitFloat), weaponCount);

    if (weaponsHit === 0) {
      return { weaponsHit: 0, shieldDamage: 0, armorDamage: 0, hullDamage: 0 };
    }

    // Calculate overall damage
    const overallDamage = weaponsHit * weaponSpec.baseDamage * baseDamageModifier;

    // Calculate shield damage
    let shieldDamageFloat = overallDamage * (weaponSpec.shieldDamageRatio / 100);
    // Projectile weapons are less effective against shields
    if (weaponSpec.subtype === 'Projectile') {
      shieldDamageFloat = shieldDamageFloat / 2;
    }
    // Calculate actual shield damage and excess
    const actualShieldDamage = Math.min(shieldDamageFloat, opponentShieldValue);
    let excessShieldDamage = Math.max(0, shieldDamageFloat - opponentShieldValue);

    // For projectile weapons, double the excess damage (compensating for halving)
    if (weaponSpec.subtype === 'Projectile') {
      excessShieldDamage = excessShieldDamage * 2;
    }

    // Calculate armor damage
    let armorDamageFloat = (overallDamage * (weaponSpec.armorDamageRatio / 100));
    // Energy weapons are less effective against armor
    if (weaponSpec.subtype === 'Energy') {
      armorDamageFloat = armorDamageFloat / 2;
    }
    // Calculate actual armor damage and excess
    const actualArmorDamage = Math.min(armorDamageFloat, opponentArmorValue);
    let excessArmorDamage = Math.max(0, armorDamageFloat - opponentArmorValue);
    if (weaponSpec.subtype === 'Energy') {
      excessArmorDamage = excessArmorDamage * 2;
    }

    // all remaining damage goes to hull
    const hullDamageFloat = excessShieldDamage + excessArmorDamage;

    return {
      weaponsHit,
      shieldDamage: Math.round(actualShieldDamage),
      armorDamage: Math.round(actualArmorDamage),
      hullDamage: Math.round(hullDamageFloat)
    };
  }
}
