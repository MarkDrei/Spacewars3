// ---
// File responsibilities:
// Defines the types and initial data for the tech tree and research system, which models user research progress and upgrades.
// ---

/**
 * Enum of all available research types in the tech tree.
 */
export enum ResearchType {
  IronHarvesting = 'IronHarvesting',
  ShipVelocity = 'ShipVelocity',
  Afterburner = 'Afterburner',
}

/**
 * Represents a research item in the tech tree.
 */
export interface Research {
  type: ResearchType;
  name: string; // human-readable name, e.g. 'Iron Harvesting'
  level: number;
  baseUpgradeCost: number; // in iron
  baseUpgradeDuration: number; // in seconds
  baseValue: number; // base value for this research (e.g. iron/sec, velocity)
  upgradeCostIncrease: number; // multiplier for cost increase per level
  baseValueIncrease: { type: 'constant' | 'factor'; value: number }; // how the effect increases per level
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
  [ResearchType.ShipVelocity]: {
    type: ResearchType.ShipVelocity,
    name: 'Ship Velocity',
    level: 1,
    baseUpgradeCost: 500,
    baseUpgradeDuration: 30,
    baseValue: 25,
    upgradeCostIncrease: 2,
    baseValueIncrease: { type: 'constant', value: 5 },
    description: 'Determines how fast your ship travels.',
    treeKey: 'shipVelocity',
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
};

/**
 * Represents the tech tree, which hosts all researches for a user.
 * Stores only the level for each research, all other data is immutable and referenced from AllResearches.
 * If a research is currently being upgraded, 'activeResearch' tracks which one and its remaining duration.
 */
export interface TechTree {
  ironHarvesting: number; // level
  shipVelocity: number;   // level
  afterburner: number;    // level
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
    shipVelocity: AllResearches[ResearchType.ShipVelocity].level,
    afterburner: AllResearches[ResearchType.Afterburner].level,
  };
}

// Helper to get the current level for a research type from a TechTree
function getResearchLevelFromTree(tree: TechTree, type: ResearchType): number {
  switch (type) {
    case ResearchType.IronHarvesting:
      return tree.ironHarvesting;
    case ResearchType.ShipVelocity:
      return tree.shipVelocity;
    case ResearchType.Afterburner:
      return tree.afterburner;
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
 * Applies the baseValueIncrease logic (factor or constant) for each level above the research's starting level.
 */
export function getResearchEffect(research: Research, level: number): number {
  if (level === 0) return 0; // At level 0, the effect is always 0
  const increase = research.baseValueIncrease;
  if (increase.type === 'factor') {
    // Effect = baseValue * (factor ^ (level - 1))
    return research.baseValue * Math.pow(increase.value, level - 1);
  } else {
    // Effect = baseValue + (constant * (level - 1))
    return research.baseValue + increase.value * (level - 1);
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
 */
export function updateTechTree(tree: TechTree, timeSeconds: number): void {
  if (!tree.activeResearch) return;
  tree.activeResearch.remainingDuration -= timeSeconds;
  if (tree.activeResearch.remainingDuration <= 0) {
    // Research complete: increase level
    switch (tree.activeResearch.type) {
      case ResearchType.IronHarvesting:
        tree.ironHarvesting += 1;
        break;
      case ResearchType.ShipVelocity:
        tree.shipVelocity += 1;
        break;
      case ResearchType.Afterburner:
        tree.afterburner += 1;
        break;
      default:
        throw new Error('Unknown research type');
    }
    tree.activeResearch = undefined;
  }
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
