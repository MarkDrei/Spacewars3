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
  description: string;
  level: number; // Current level, 0 means not researched
  maxLevel: number; // Maximum level
  cost: (level: number) => number; // Function to calculate cost at a given level
  effect: (level: number) => number; // Function to calculate effect at a given level
}

/**
 * Represents the entire tech tree of a user.
 */
export interface TechTree {
  research: Record<ResearchType, Research>;
  researchInProgress: ResearchInProgress | null;
}

/**
 * Represents a research item currently being researched.
 */
export interface ResearchInProgress {
  type: ResearchType;
  startTime: number; // Unix timestamp when research started
  targetLevel: number; // Level being researched to
  duration: number; // Duration in seconds
}

/**
 * Calculates the total cost of researching from current level to target level.
 */
export function calculateResearchCost(research: Research, targetLevel: number): number {
  let totalCost = 0;
  for (let level = research.level; level < targetLevel; level++) {
    totalCost += research.cost(level);
  }
  return totalCost;
}

/**
 * Calculates the duration for researching a technology to the next level.
 */
export function calculateResearchDuration(research: Research, targetLevel: number): number {
  // Base duration is 30 seconds per level
  return 30 * (targetLevel - research.level);
}

/**
 * Gets the effect value for a research type at its current level.
 */
export function getResearchEffectFromTree(techTree: TechTree, type: ResearchType): number {
  const research = techTree.research[type];
  return research ? research.effect(research.level) : 0;
}

/**
 * Creates the initial tech tree with all research items at level 0.
 */
export function createInitialTechTree(): TechTree {
  return {
    research: {
      [ResearchType.IronHarvesting]: {
        type: ResearchType.IronHarvesting,
        name: 'Iron Harvesting',
        description: 'Improves the rate at which your ship collects iron',
        level: 0,
        maxLevel: 5,
        cost: (level) => 100 * Math.pow(2, level), // 100, 200, 400, 800, 1600
        effect: (level) => 1 + 0.2 * level, // +20% per level (multiplier: 1, 1.2, 1.4, 1.6, 1.8, 2.0)
      },
      [ResearchType.ShipVelocity]: {
        type: ResearchType.ShipVelocity,
        name: 'Ship Velocity',
        description: 'Increases your ship\'s maximum velocity',
        level: 0,
        maxLevel: 5,
        cost: (level) => 150 * Math.pow(2, level), // 150, 300, 600, 1200, 2400
        effect: (level) => 1 + 0.15 * level, // +15% per level (multiplier: 1, 1.15, 1.3, 1.45, 1.6, 1.75)
      },
      [ResearchType.Afterburner]: {
        type: ResearchType.Afterburner,
        name: 'Afterburner',
        description: 'Temporary speed boost ability',
        level: 0,
        maxLevel: 3,
        cost: (level) => 300 * Math.pow(2, level), // 300, 600, 1200
        effect: (level) => level > 0 ? 1 + 0.5 * level : 0, // +50% per level, 0 if not researched
      },
    },
    researchInProgress: null,
  };
}

/**
 * Starts researching a technology.
 */
export function startResearch(techTree: TechTree, type: ResearchType, iron: number): { updatedTechTree: TechTree, cost: number, remainingIron: number } {
  const research = techTree.research[type];
  
  // Check if already at max level
  if (research.level >= research.maxLevel) {
    throw new Error(`Research ${research.name} is already at maximum level`);
  }
  
  // Check if already researching something
  if (techTree.researchInProgress) {
    throw new Error('Another research is already in progress');
  }
  
  const targetLevel = research.level + 1;
  const cost = research.cost(research.level);
  
  // Check if user has enough iron
  if (iron < cost) {
    throw new Error(`Not enough iron to start research. Need ${cost}, have ${iron}`);
  }
  
  const duration = calculateResearchDuration(research, targetLevel);
  
  const updatedTechTree: TechTree = {
    ...techTree,
    researchInProgress: {
      type,
      startTime: Math.floor(Date.now() / 1000),
      targetLevel,
      duration,
    },
  };
  
  return {
    updatedTechTree,
    cost,
    remainingIron: iron - cost,
  };
}

/**
 * Checks if research is complete and updates the tech tree if it is.
 */
export function checkResearchProgress(techTree: TechTree): { updatedTechTree: TechTree, completed: boolean, completedResearch: Research | null } {
  if (!techTree.researchInProgress) {
    return { updatedTechTree: techTree, completed: false, completedResearch: null };
  }
  
  const { type, startTime, targetLevel, duration } = techTree.researchInProgress;
  const research = techTree.research[type];
  
  const currentTime = Math.floor(Date.now() / 1000);
  const elapsedTime = currentTime - startTime;
  
  if (elapsedTime >= duration) {
    // Research is complete
    const updatedResearch: Research = {
      ...research,
      level: targetLevel,
    };
    
    const updatedTechTree: TechTree = {
      research: {
        ...techTree.research,
        [type]: updatedResearch,
      },
      researchInProgress: null,
    };
    
    return {
      updatedTechTree,
      completed: true,
      completedResearch: updatedResearch,
    };
  }
  
  // Research is still in progress
  return { updatedTechTree: techTree, completed: false, completedResearch: null };
}

/**
 * Calculates the remaining time for the current research in progress.
 * @returns Remaining time in seconds, or 0 if no research is in progress or if research is complete.
 */
export function getResearchRemainingTime(techTree: TechTree): number {
  if (!techTree.researchInProgress) {
    return 0;
  }
  
  const { startTime, duration } = techTree.researchInProgress;
  const currentTime = Math.floor(Date.now() / 1000);
  const elapsedTime = currentTime - startTime;
  
  return Math.max(0, duration - elapsedTime);
}

/**
 * Calculates the progress percentage of the current research.
 * @returns Progress percentage between 0 and 100, or 0 if no research is in progress.
 */
export function getResearchProgressPercentage(techTree: TechTree): number {
  if (!techTree.researchInProgress) {
    return 0;
  }
  
  const { startTime, duration } = techTree.researchInProgress;
  const currentTime = Math.floor(Date.now() / 1000);
  const elapsedTime = currentTime - startTime;
  
  return Math.min(100, Math.floor((elapsedTime / duration) * 100));
}

/**
 * Gets the total cost to upgrade a research to its maximum level from the current level.
 */
export function getTotalCostToMax(research: Research): number {
  let totalCost = 0;
  for (let level = research.level; level < research.maxLevel; level++) {
    totalCost += research.cost(level);
  }
  return totalCost;
}

/**
 * Gets all researched effects as multipliers for each type.
 */
export function getAllResearchEffects(techTree: TechTree): Record<ResearchType, number> {
  const effects: Record<ResearchType, number> = {} as Record<ResearchType, number>;
  
  for (const type of Object.values(ResearchType)) {
    effects[type] = getResearchEffectFromTree(techTree, type);
  }
  
  return effects;
}

/**
 * Returns whether a research can be started (has not reached max level and no other research is in progress).
 */
export function canStartResearch(techTree: TechTree, type: ResearchType): boolean {
  const research = techTree.research[type];
  return research.level < research.maxLevel && !techTree.researchInProgress;
}

/**
 * Returns the cost of the next level of research.
 */
export function getNextLevelCost(techTree: TechTree, type: ResearchType): number {
  const research = techTree.research[type];
  if (research.level >= research.maxLevel) {
    return 0; // Already at max level
  }
  return research.cost(research.level);
}
