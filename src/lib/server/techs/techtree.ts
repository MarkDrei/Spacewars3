// ---
// File responsibilities:
// Defines the types and initial data for the tech tree and research system, which models user research progress and upgrades.
// ---

import { ResearchType } from '@/shared/src/types/gameTypes';

// Re-export ResearchType for convenience
export { ResearchType };

// Subset of implemented researches for reference
export const IMPLEMENTED_RESEARCHES: ReadonlySet<ResearchType> = new Set([
  ResearchType.IronHarvesting,
  ResearchType.ShipSpeed,
  ResearchType.IronCapacity,
  ResearchType.HullStrength,
  ResearchType.ArmorEffectiveness,
  ResearchType.ShieldEffectiveness,
  ResearchType.ProjectileDamage,
  ResearchType.ProjectileReloadRate,
  ResearchType.EnergyDamage,
  ResearchType.EnergyRechargeRate,
  ResearchType.InventorySlots,
]);

/**
 * Represents a research item in the tech tree.
 */
export interface Research {
  type: ResearchType;
  name: string; // human-readable name, e.g. 'Iron Harvesting'
  level: number;
  baseUpgradeCost: number; // in iron
  baseUpgradeDuration: number; // in seconds
  baseValue: number; // base value for this research (e.g. iron/sec, speed)
  upgradeCostIncrease: number; // multiplier for cost increase per level
  baseValueIncrease: { type: 'constant' | 'factor' | 'polynomial'; value: number }; // how the effect increases per level
  description: string;
  treeKey: keyof TechTree; // Add this property
  unit: string; // Unit for the research effect, e.g., 'iron/sec', '%'
}

/**
 * Hardcoded list of all available research definitions.
 */
export const AllResearches: Record<ResearchType, Research> = {
  [ResearchType.IronHarvesting]: {
    type: ResearchType.IronHarvesting,
    name: 'Iron Harvesting',
    level: 1,
    baseUpgradeCost: 100,
    baseUpgradeDuration: 10,
    baseValue: 1,
    upgradeCostIncrease: 2,
    baseValueIncrease: { type: 'factor', value: 1.1 },
    description: 'Determines how much iron is harvested per second.',
    treeKey: 'ironHarvesting',
    unit: 'iron/sec',
  },
  [ResearchType.ShipSpeed]: {
    type: ResearchType.ShipSpeed,
    name: 'Ship Speed',
    level: 1,
    baseUpgradeCost: 500,
    baseUpgradeDuration: 30,
    baseValue: 25,
    upgradeCostIncrease: 2,
    baseValueIncrease: { type: 'constant', value: 5 },
    description: 'Determines how fast your ship travels.',
    treeKey: 'shipSpeed',
    unit: 'units',
  },
  [ResearchType.Afterburner]: {
    type: ResearchType.Afterburner,
    name: 'Afterburner',
    level: 0,
    baseUpgradeCost: 5000,
    baseUpgradeDuration: 120,
    baseValue: 100,
    upgradeCostIncrease: 1.5,
    baseValueIncrease: { type: 'factor', value: 1.2 },
    description: 'Gives the spaceship a much higher speed (% speed increase).',
    treeKey: 'afterburner',
    unit: '%',
  },
  // Projectile Weapons
  [ResearchType.ProjectileDamage]: {
    type: ResearchType.ProjectileDamage,
    name: 'Projectile Damage',
    level: 1,
    baseUpgradeCost: 1000,
    baseUpgradeDuration: 60,
    baseValue: 50,
    upgradeCostIncrease: 2.0,
    baseValueIncrease: { type: 'factor', value: 1.15 },
    description: 'Increases damage output of projectile weapons.',
    treeKey: 'projectileDamage',
    unit: 'damage',
  },
  [ResearchType.ProjectileReloadRate]: {
    type: ResearchType.ProjectileReloadRate,
    name: 'Projectile Reload Rate',
    level: 1,
    baseUpgradeCost: 800,
    baseUpgradeDuration: 50,
    baseValue: 10,
    upgradeCostIncrease: 1.8,
    baseValueIncrease: { type: 'constant', value: 10 },
    description: 'Reduces reload time for projectile weapons.',
    treeKey: 'projectileReloadRate',
    unit: '%',
  },
  [ResearchType.ProjectileAccuracy]: {
    type: ResearchType.ProjectileAccuracy,
    name: 'Projectile Accuracy',
    level: 1,
    baseUpgradeCost: 1200,
    baseUpgradeDuration: 70,
    baseValue: 70,
    upgradeCostIncrease: 1.9,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Improves accuracy of projectile weapons.',
    treeKey: 'projectileAccuracy',
    unit: '%',
  },
  [ResearchType.ProjectileWeaponTier]: {
    type: ResearchType.ProjectileWeaponTier,
    name: 'Projectile Weapon Tier',
    level: 0,
    baseUpgradeCost: 5000,
    baseUpgradeDuration: 180,
    baseValue: 1,
    upgradeCostIncrease: 2.5,
    baseValueIncrease: { type: 'constant', value: 1 },
    description: 'Unlocks higher tier projectile weapons.',
    treeKey: 'projectileWeaponTier',
    unit: 'tier',
  },
  // Energy Weapons
  [ResearchType.EnergyDamage]: {
    type: ResearchType.EnergyDamage,
    name: 'Energy Damage',
    level: 1,
    baseUpgradeCost: 1100,
    baseUpgradeDuration: 65,
    baseValue: 60,
    upgradeCostIncrease: 2.0,
    baseValueIncrease: { type: 'factor', value: 1.15 },
    description: 'Increases damage output of energy weapons.',
    treeKey: 'energyDamage',
    unit: 'damage',
  },
  [ResearchType.EnergyRechargeRate]: {
    type: ResearchType.EnergyRechargeRate,
    name: 'Energy Recharge Rate',
    level: 1,
    baseUpgradeCost: 900,
    baseUpgradeDuration: 55,
    baseValue: 15,
    upgradeCostIncrease: 1.8,
    baseValueIncrease: { type: 'constant', value: 15 },
    description: 'Increases recharge rate of energy weapons.',
    treeKey: 'energyRechargeRate',
    unit: '%',
  },
  [ResearchType.EnergyAccuracy]: {
    type: ResearchType.EnergyAccuracy,
    name: 'Energy Accuracy',
    level: 1,
    baseUpgradeCost: 1300,
    baseUpgradeDuration: 75,
    baseValue: 65,
    upgradeCostIncrease: 1.9,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Improves accuracy of energy weapons.',
    treeKey: 'energyAccuracy',
    unit: '%',
  },
  [ResearchType.EnergyWeaponTier]: {
    type: ResearchType.EnergyWeaponTier,
    name: 'Energy Weapon Tier',
    level: 0,
    baseUpgradeCost: 5500,
    baseUpgradeDuration: 200,
    baseValue: 1,
    upgradeCostIncrease: 2.5,
    baseValueIncrease: { type: 'constant', value: 1 },
    description: 'Unlocks higher tier energy weapons.',
    treeKey: 'energyWeaponTier',
    unit: 'tier',
  },
  // Defense
  [ResearchType.HullStrength]: {
    type: ResearchType.HullStrength,
    name: 'Hull Strength',
    level: 1,
    baseUpgradeCost: 1500,
    baseUpgradeDuration: 90,
    baseValue: 100,
    upgradeCostIncrease: 2.2,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Increases hull strength of your ship for each hull plate installed.',
    treeKey: 'hullStrength',
    unit: '%',
  },
  [ResearchType.RepairSpeed]: {
    type: ResearchType.RepairSpeed,
    name: 'Repair Speed',
    level: 1,
    baseUpgradeCost: 1000,
    baseUpgradeDuration: 60,
    baseValue: 5,
    upgradeCostIncrease: 2.0,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Increases repair speed for hull, armor and engine. Repairs do not happen during combat.',
    treeKey: 'repairSpeed',
    unit: 'HP/sec',
  },
  [ResearchType.ArmorEffectiveness]: {
    type: ResearchType.ArmorEffectiveness,
    name: 'Armor Effectiveness',
    level: 1,
    baseUpgradeCost: 1800,
    baseUpgradeDuration: 100,
    baseValue: 100,
    upgradeCostIncrease: 2.1,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Increases additional armor value per armor plate.',
    treeKey: 'armorEffectiveness',
    unit: '%',
  },
  [ResearchType.ShieldEffectiveness]: {
    type: ResearchType.ShieldEffectiveness,
    name: 'Shield Effectiveness',
    level: 1,
    baseUpgradeCost: 1600,
    baseUpgradeDuration: 95,
    baseValue: 100,
    upgradeCostIncrease: 2.1,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Increases additional shield value per installed shield.',
    treeKey: 'shieldEffectiveness',
    unit: '%',
  },
  [ResearchType.ShieldRechargeRate]: {
    type: ResearchType.ShieldRechargeRate,
    name: 'Shield Recharge Rate',
    level: 1,
    baseUpgradeCost: 1200,
    baseUpgradeDuration: 70,
    baseValue: 1,
    upgradeCostIncrease: 1.9,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Increases shield recharge rate. Shield regenerate per second and also during combat.',
    treeKey: 'shieldRechargeRate',
    unit: 'HP/sec',
  },
  // Ship
  [ResearchType.AfterburnerSpeedIncrease]: {
    type: ResearchType.AfterburnerSpeedIncrease,
    name: 'Afterburner Speed',
    level: 1,
    baseUpgradeCost: 2000,
    baseUpgradeDuration: 120,
    baseValue: 50,
    upgradeCostIncrease: 2.0,
    baseValueIncrease: { type: 'constant', value: 10 },
    description: 'Increases speed boost from afterburner.',
    treeKey: 'afterburnerSpeedIncrease',
    unit: '%',
  },
  [ResearchType.AfterburnerDuration]: {
    type: ResearchType.AfterburnerDuration,
    name: 'Afterburner Duration',
    level: 1,
    baseUpgradeCost: 1500,
    baseUpgradeDuration: 90,
    baseValue: 5,
    upgradeCostIncrease: 1.9,
    baseValueIncrease: { type: 'constant', value: 2 },
    description: 'Increases duration of afterburner boost.',
    treeKey: 'afterburnerDuration',
    unit: 'seconds',
  },
  [ResearchType.Teleport]: {
    type: ResearchType.Teleport,
    name: 'Teleport',
    level: 0,
    baseUpgradeCost: 10000,
    baseUpgradeDuration: 300,
    baseValue: 100,
    upgradeCostIncrease: 3.0,
    baseValueIncrease: { type: 'factor', value: 1.3 },
    description: 'Unlocks and improves teleport range.',
    treeKey: 'teleport',
    unit: 'units',
  },
  [ResearchType.IronCapacity]: {
    type: ResearchType.IronCapacity,
    name: 'Iron Capacity',
    level: 1,
    baseUpgradeCost: 800,
    baseUpgradeDuration: 45,
    baseValue: 5000,
    upgradeCostIncrease: 1.7,
    baseValueIncrease: { type: 'factor', value: 2 },
    description: 'Increases iron storage capacity.',
    treeKey: 'ironCapacity',
    unit: 'iron',
  },
  [ResearchType.InventorySlots]: {
    type: ResearchType.InventorySlots,
    name: 'Inventory Slots',
    level: 1,
    baseUpgradeCost: 5000,
    baseUpgradeDuration: 120,
    baseValue: 16,
    upgradeCostIncrease: 1.8,
    baseValueIncrease: { type: 'constant', value: 8 },
    description: 'Increases the number of available inventory slots (+8 per level).',
    treeKey: 'inventorySlots',
    unit: 'slots',
  },
  [ResearchType.ConstructionSpeed]: {
    type: ResearchType.ConstructionSpeed,
    name: 'Construction Speed',
    level: 1,
    baseUpgradeCost: 1400,
    baseUpgradeDuration: 80,
    baseValue: 10,
    upgradeCostIncrease: 2.0,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Reduces construction time for buildings and ships.',
    treeKey: 'constructionSpeed',
    unit: '%',
  },
  // Spies
  [ResearchType.SpyChance]: {
    type: ResearchType.SpyChance,
    name: 'Spy Chance',
    level: 0,
    baseUpgradeCost: 2500,
    baseUpgradeDuration: 150,
    baseValue: 10,
    upgradeCostIncrease: 2.5,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Increases chance of successful spy missions.',
    treeKey: 'spyChance',
    unit: '%',
  },
  [ResearchType.SpySpeed]: {
    type: ResearchType.SpySpeed,
    name: 'Spy Speed',
    level: 0,
    baseUpgradeCost: 2000,
    baseUpgradeDuration: 120,
    baseValue: 60,
    upgradeCostIncrease: 2.3,
    baseValueIncrease: { type: 'constant', value: -10 },
    description: 'Reduces time required for spy missions.',
    treeKey: 'spySpeed',
    unit: 'seconds',
  },
  [ResearchType.SpySabotageDamage]: {
    type: ResearchType.SpySabotageDamage,
    name: 'Spy Sabotage',
    level: 0,
    baseUpgradeCost: 3000,
    baseUpgradeDuration: 180,
    baseValue: 50,
    upgradeCostIncrease: 2.5,
    baseValueIncrease: { type: 'factor', value: 1.25 },
    description: 'Increases damage dealt by sabotage missions.',
    treeKey: 'spySabotageDamage',
    unit: 'damage',
  },
  [ResearchType.Counterintelligence]: {
    type: ResearchType.Counterintelligence,
    name: 'Counterintelligence',
    level: 0,
    baseUpgradeCost: 2800,
    baseUpgradeDuration: 160,
    baseValue: 15,
    upgradeCostIncrease: 2.5,
    baseValueIncrease: { type: 'polynomial', value: 0.1 },
    description: 'Reduces chance of enemy spy success.',
    treeKey: 'counterintelligence',
    unit: '%',
  },
  [ResearchType.StealIron]: {
    type: ResearchType.StealIron,
    name: 'Steal Iron',
    level: 0,
    baseUpgradeCost: 3500,
    baseUpgradeDuration: 200,
    baseValue: 100,
    upgradeCostIncrease: 2.7,
    baseValueIncrease: { type: 'factor', value: 1.3 },
    description: 'Increases amount of iron stolen by spies.',
    treeKey: 'stealIron',
    unit: 'iron',
  },
};

/**
 * Weapon type categorization for damage modifier calculations
 */
const PROJECTILE_WEAPONS = ['auto_turret', 'gauss_rifle', 'rocket_launcher'] as const;
const ENERGY_WEAPONS = ['pulse_laser', 'plasma_lance', 'photon_torpedo'] as const;

/**
 * Represents the tech tree, which hosts all researches for a user.
 * Stores only the level for each research, all other data is immutable and referenced from AllResearches.
 * If a research is currently being upgraded, 'activeResearch' tracks which one and its remaining duration.
 */
export interface TechTree {
  ironHarvesting: number; // level
  shipSpeed: number;   // level
  afterburner: number;    // level
  // Projectile Weapons
  projectileDamage: number;
  projectileReloadRate: number;
  projectileAccuracy: number;
  projectileWeaponTier: number;
  // Energy Weapons
  energyDamage: number;
  energyRechargeRate: number;
  energyAccuracy: number;
  energyWeaponTier: number;
  // Defense
  hullStrength: number;
  repairSpeed: number;
  armorEffectiveness: number;
  shieldEffectiveness: number;
  shieldRechargeRate: number;
  // Ship
  afterburnerSpeedIncrease: number;
  afterburnerDuration: number;
  teleport: number;
  ironCapacity: number;
  /** @deprecated TECH DEBT: Old DB key - remove fallback after migration. See TechnicalDebt.md */
  inventoryCapacity?: number;
  inventorySlots: number;
  constructionSpeed: number;
  // Spies
  spyChance: number;
  spySpeed: number;
  spySabotageDamage: number;
  counterintelligence: number;
  stealIron: number;
  /**
   * The research currently being upgraded, if any.
   * Contains the type and remaining duration in seconds.
   */
  activeResearch?: {
    type: ResearchType;
    remainingDuration: number; // in seconds
  };
}

// Utility to create a new TechTree with all initial researches
export function createInitialTechTree(): TechTree {
  return {
    ironHarvesting: AllResearches[ResearchType.IronHarvesting].level,
    shipSpeed: AllResearches[ResearchType.ShipSpeed].level,
    afterburner: AllResearches[ResearchType.Afterburner].level,
    // Projectile Weapons
    projectileDamage: AllResearches[ResearchType.ProjectileDamage].level,
    projectileReloadRate: AllResearches[ResearchType.ProjectileReloadRate].level,
    projectileAccuracy: AllResearches[ResearchType.ProjectileAccuracy].level,
    projectileWeaponTier: AllResearches[ResearchType.ProjectileWeaponTier].level,
    // Energy Weapons
    energyDamage: AllResearches[ResearchType.EnergyDamage].level,
    energyRechargeRate: AllResearches[ResearchType.EnergyRechargeRate].level,
    energyAccuracy: AllResearches[ResearchType.EnergyAccuracy].level,
    energyWeaponTier: AllResearches[ResearchType.EnergyWeaponTier].level,
    // Defense
    hullStrength: AllResearches[ResearchType.HullStrength].level,
    repairSpeed: AllResearches[ResearchType.RepairSpeed].level,
    armorEffectiveness: AllResearches[ResearchType.ArmorEffectiveness].level,
    shieldEffectiveness: AllResearches[ResearchType.ShieldEffectiveness].level,
    shieldRechargeRate: AllResearches[ResearchType.ShieldRechargeRate].level,
    // Ship
    afterburnerSpeedIncrease: AllResearches[ResearchType.AfterburnerSpeedIncrease].level,
    afterburnerDuration: AllResearches[ResearchType.AfterburnerDuration].level,
    teleport: AllResearches[ResearchType.Teleport].level,
    ironCapacity: AllResearches[ResearchType.IronCapacity].level,
    inventorySlots: AllResearches[ResearchType.InventorySlots].level,
    constructionSpeed: AllResearches[ResearchType.ConstructionSpeed].level,
    // Spies
    spyChance: AllResearches[ResearchType.SpyChance].level,
    spySpeed: AllResearches[ResearchType.SpySpeed].level,
    spySabotageDamage: AllResearches[ResearchType.SpySabotageDamage].level,
    counterintelligence: AllResearches[ResearchType.Counterintelligence].level,
    stealIron: AllResearches[ResearchType.StealIron].level,
  };
}

// Helper to get the current level for a research type from a TechTree
function getResearchLevelFromTree(tree: TechTree, type: ResearchType): number {
  switch (type) {
    case ResearchType.IronHarvesting:
      return tree.ironHarvesting;
    case ResearchType.ShipSpeed:
      return tree.shipSpeed;
    case ResearchType.Afterburner:
      return tree.afterburner;
    // Projectile Weapons
    case ResearchType.ProjectileDamage:
      return tree.projectileDamage;
    case ResearchType.ProjectileReloadRate:
      return tree.projectileReloadRate;
    case ResearchType.ProjectileAccuracy:
      return tree.projectileAccuracy;
    case ResearchType.ProjectileWeaponTier:
      return tree.projectileWeaponTier;
    // Energy Weapons
    case ResearchType.EnergyDamage:
      return tree.energyDamage;
    case ResearchType.EnergyRechargeRate:
      return tree.energyRechargeRate;
    case ResearchType.EnergyAccuracy:
      return tree.energyAccuracy;
    case ResearchType.EnergyWeaponTier:
      return tree.energyWeaponTier;
    // Defense
    case ResearchType.HullStrength:
      return tree.hullStrength;
    case ResearchType.RepairSpeed:
      return tree.repairSpeed;
    case ResearchType.ArmorEffectiveness:
      return tree.armorEffectiveness;
    case ResearchType.ShieldEffectiveness:
      return tree.shieldEffectiveness;
    case ResearchType.ShieldRechargeRate:
      return tree.shieldRechargeRate;
    // Ship
    case ResearchType.AfterburnerSpeedIncrease:
      return tree.afterburnerSpeedIncrease;
    case ResearchType.AfterburnerDuration:
      return tree.afterburnerDuration;
    case ResearchType.Teleport:
      return tree.teleport;
    case ResearchType.IronCapacity:
      // TECH DEBT: fallback for old DB records with 'inventoryCapacity' key - remove after migration
      return tree.ironCapacity ?? tree.inventoryCapacity ?? AllResearches[ResearchType.IronCapacity].level;
    case ResearchType.InventorySlots:
      return tree.inventorySlots;
    case ResearchType.ConstructionSpeed:
      return tree.constructionSpeed;
    // Spies
    case ResearchType.SpyChance:
      return tree.spyChance;
    case ResearchType.SpySpeed:
      return tree.spySpeed;
    case ResearchType.SpySabotageDamage:
      return tree.spySabotageDamage;
    case ResearchType.Counterintelligence:
      return tree.counterintelligence;
    case ResearchType.StealIron:
      return tree.stealIron;
    default:
      throw new Error('Unknown research type');
  }
}

/**
 * Returns the upgrade cost for a given research and level.
 * If the research starts at level 0, the first cost is for 0->1 (base cost), then increases for each subsequent upgrade.
 * If the research starts at level 1, the first cost is for 1->2 (base cost), then increases for each subsequent upgrade.
 * For level n, cost = base * (factor ^ (level - startLevel - 1)), where startLevel is the initial level in AllResearches.
 */
export function getResearchUpgradeCost(research: Research, level: number): number {
  const startLevel = AllResearches[research.type].level;
  if (level <= startLevel) return research.baseUpgradeCost;
  // For level n, cost = base * (factor ^ (level - startLevel - 1))
  return research.baseUpgradeCost * Math.pow(research.upgradeCostIncrease, level - startLevel - 1);
}

/**
 * Returns the upgrade duration (in seconds) for a given research and level.
 * Uses the same logic as getResearchUpgradeCost for scaling.
 */
export function getResearchUpgradeDuration(research: Research, level: number): number {
  const startLevel = AllResearches[research.type].level;
  if (level <= startLevel) return research.baseUpgradeDuration;
  return research.baseUpgradeDuration * Math.pow(research.upgradeCostIncrease, level - startLevel - 1);
}

/**
 * Returns the effect value for a given research and level.
 * Applies the baseValueIncrease logic (factor, constant, or polynomial) for each level above the research's starting level.
 * Formulas:
 * - constant: baseValue + (constant * (level - 1))
 * - factor: baseValue * (factor ^ (level - 1))
 * - polynomial: baseValue + baseValue * (value * (1.5 * level - 1.5)) ^ 1.4
 */
export function getResearchEffect(research: Research, level: number): number {
  if (level === 0) return 0; // At level 0, the effect is always 0
  const increase = research.baseValueIncrease;
  if (increase.type === 'factor') {
    // Effect = baseValue * (factor ^ (level - 1))
    return research.baseValue * Math.pow(increase.value, level - 1);
  } else if (increase.type === 'constant') {
    // Effect = baseValue + (constant * (level - 1))
    return research.baseValue + increase.value * (level - 1);
  } else {
    // polynomial: Effect = baseValue + baseValue * (value * (1.5 * level - 1.5)) ^ 1.4
    // This is the "in between" formula: 1 + (0.1 * (1.5x - 1.5)) ^ 1.4
    // For level 1: 1 + (0.1 * 0) ^ 1.4 = 1
    // For level 2: 1 + (0.1 * 1.5) ^ 1.4 = 1 + 0.15^1.4 ≈ 1.047
    const multiplier = 1 + Math.pow(increase.value * (1.5 * level - 1.5), 1.4);
    return research.baseValue * multiplier;
  }
}

/**
 * Returns the upgrade duration for a research in the given tech tree, using the current level.
 */
export function getResearchUpgradeDurationFromTree(tree: TechTree, type: ResearchType): number {
  const level = getResearchLevelFromTree(tree, type);
  return getResearchUpgradeDuration(AllResearches[type], level);
}

/**
 * Returns the effect value for a given research in the given tech tree, using the current level.
 */
export function getResearchEffectFromTree(tree: TechTree, type: ResearchType): number {
  const level = getResearchLevelFromTree(tree, type);
  return getResearchEffect(AllResearches[type], level);
}

/**
 * Returns the damage modifier for a weapon type based on the research in the tech tree.
 * The modifier is calculated as the research effect divided by the base value,
 * resulting in a decimal multiplier (e.g., 1.0 = 100%, 1.15 = 115%).
 * 
 * @param tree The tech tree to read research levels from
 * @param weaponType The weapon key (e.g., 'pulse_laser', 'rocket_launcher', 'photon_torpedo')
 * @returns The damage modifier as a decimal (e.g., 1.0 for 100%, 1.15 for 115%)
 */
export function getWeaponDamageModifierFromTree(tree: TechTree, weaponType: string): number {
  // Determine research type based on weapon type
  let researchType: ResearchType;
  if (PROJECTILE_WEAPONS.includes(weaponType as typeof PROJECTILE_WEAPONS[number])) {
    researchType = ResearchType.ProjectileDamage;
  } else if (ENERGY_WEAPONS.includes(weaponType as typeof ENERGY_WEAPONS[number])) {
    researchType = ResearchType.EnergyDamage;
  } else {
    // Default to 1.0 (100%) for unknown weapon types
    return 1.0;
  }
  
  const research = AllResearches[researchType];
  // Guard against division by zero
  if (research.baseValue === 0) {
    return 1.0;
  }
  const effect = getResearchEffectFromTree(tree, researchType);
  // Modifier = current effect / base value
  return effect / research.baseValue;
}

/**
 * Returns the reload rate modifier for a weapon type based on the research in the tech tree.
 * The modifier represents the percentage reduction in reload time (faster firing).
 * For example, 10% research = 0.9x reload time (10% faster), 20% = 0.8x reload time (20% faster).
 * 
 * @param tree The tech tree to read research levels from
 * @param weaponType The weapon key (e.g., 'pulse_laser', 'rocket_launcher', 'auto_turret')
 * @returns The reload time multiplier as a decimal (e.g., 1.0 = no change, 0.8 = 20% faster)
 */
export function getWeaponReloadTimeModifierFromTree(tree: TechTree, weaponType: string): number {
  // Determine research type based on weapon type
  let researchType: ResearchType;
  if (PROJECTILE_WEAPONS.includes(weaponType as typeof PROJECTILE_WEAPONS[number])) {
    researchType = ResearchType.ProjectileReloadRate;
  } else if (ENERGY_WEAPONS.includes(weaponType as typeof ENERGY_WEAPONS[number])) {
    researchType = ResearchType.EnergyRechargeRate;
  } else {
    // Default to 1.0 (no change) for unknown weapon types
    return 1.0;
  }
  
  const effect = getResearchEffectFromTree(tree, researchType);
  // Effect is a percentage (e.g., 10, 20, 30)
  // Reload time multiplier = 1 - (effect / 100)
  // Example: 10% faster = 1 - 0.10 = 0.9x reload time
  // Cap at 0.1 (90% reduction max) to prevent near-zero reload times
  const multiplier = 1 - (effect / 100);
  return Math.max(0.1, multiplier);
}

/**
 * Triggers a research upgrade on the tech tree if no research is currently in progress.
 * Sets the activeResearch and its initial remainingDuration based on the next upgrade duration.
 * Throws an error if a research is already in progress.
 */
export function triggerResearch(tree: TechTree, type: ResearchType): void {
  if (tree.activeResearch) {
    throw new Error('A research is already in progress.');
  }
  const currentLevel = getResearchLevelFromTree(tree, type);
  const nextLevel = currentLevel + 1;
  const duration = getResearchUpgradeDuration(AllResearches[type], nextLevel);
  tree.activeResearch = {
    type,
    remainingDuration: duration,
  };
}

/**
 * Updates the tech tree's active research by decreasing its remaining duration.
 * If the research completes (remainingDuration <= 0), increases the level and unsets activeResearch.
 * @param tree The tech tree to update
 * @param timeSeconds The time in seconds to advance
 * @returns Information about research completion if any research completed, undefined otherwise
 */
export function updateTechTree(tree: TechTree, timeSeconds: number): { completed: boolean; type: ResearchType; completedLevel: number } | undefined {
  if (!tree.activeResearch) return undefined;
  tree.activeResearch.remainingDuration -= timeSeconds;
  if (tree.activeResearch.remainingDuration <= 0) {
    // Research complete: increase level
    // Store the level BEFORE incrementing for XP calculation
    const completedType = tree.activeResearch.type;
    const completedLevel = getResearchLevelFromTree(tree, completedType);
    switch (tree.activeResearch.type) {
      case ResearchType.IronHarvesting:
        tree.ironHarvesting += 1;
        break;
      case ResearchType.ShipSpeed:
        tree.shipSpeed += 1;
        break;
      case ResearchType.Afterburner:
        tree.afterburner += 1;
        break;
      // Projectile Weapons
      case ResearchType.ProjectileDamage:
        tree.projectileDamage += 1;
        break;
      case ResearchType.ProjectileReloadRate:
        tree.projectileReloadRate += 1;
        break;
      case ResearchType.ProjectileAccuracy:
        tree.projectileAccuracy += 1;
        break;
      case ResearchType.ProjectileWeaponTier:
        tree.projectileWeaponTier += 1;
        break;
      // Energy Weapons
      case ResearchType.EnergyDamage:
        tree.energyDamage += 1;
        break;
      case ResearchType.EnergyRechargeRate:
        tree.energyRechargeRate += 1;
        break;
      case ResearchType.EnergyAccuracy:
        tree.energyAccuracy += 1;
        break;
      case ResearchType.EnergyWeaponTier:
        tree.energyWeaponTier += 1;
        break;
      // Defense
      case ResearchType.HullStrength:
        tree.hullStrength += 1;
        break;
      case ResearchType.RepairSpeed:
        tree.repairSpeed += 1;
        break;
      case ResearchType.ArmorEffectiveness:
        tree.armorEffectiveness += 1;
        break;
      case ResearchType.ShieldEffectiveness:
        tree.shieldEffectiveness += 1;
        break;
      case ResearchType.ShieldRechargeRate:
        tree.shieldRechargeRate += 1;
        break;
      // Ship
      case ResearchType.AfterburnerSpeedIncrease:
        tree.afterburnerSpeedIncrease += 1;
        break;
      case ResearchType.AfterburnerDuration:
        tree.afterburnerDuration += 1;
        break;
      case ResearchType.Teleport:
        tree.teleport += 1;
        break;
      case ResearchType.IronCapacity:
        // TECH DEBT: fallback for old DB records with 'inventoryCapacity' key - remove after migration
        tree.ironCapacity = (tree.ironCapacity ?? tree.inventoryCapacity ?? AllResearches[ResearchType.IronCapacity].level) + 1;
        break;
      case ResearchType.InventorySlots:
        tree.inventorySlots += 1;
        break;
      case ResearchType.ConstructionSpeed:
        tree.constructionSpeed += 1;
        break;
      // Spies
      case ResearchType.SpyChance:
        tree.spyChance += 1;
        break;
      case ResearchType.SpySpeed:
        tree.spySpeed += 1;
        break;
      case ResearchType.SpySabotageDamage:
        tree.spySabotageDamage += 1;
        break;
      case ResearchType.Counterintelligence:
        tree.counterintelligence += 1;
        break;
      case ResearchType.StealIron:
        tree.stealIron += 1;
        break;
      default:
        throw new Error('Unknown research type');
    }
    tree.activeResearch = undefined;
    return { completed: true, type: completedType, completedLevel };
  }
  return undefined;
}

/**
 * Returns info about the currently active research, or undefined if none is active.
 * The info includes the type, the next level, and the remaining time in seconds.
 */
export function getActiveResearch(tree: TechTree): { type: ResearchType; nextLevel: number; remainingDuration: number } | undefined {
  if (!tree.activeResearch) return undefined;
  const currentLevel = getResearchLevelFromTree(tree, tree.activeResearch.type);
  return {
    type: tree.activeResearch.type,
    nextLevel: currentLevel + 1,
    remainingDuration: tree.activeResearch.remainingDuration,
  };
}
