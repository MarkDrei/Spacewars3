// ---
// Domain logic for the User and its stats, including persistence callback.
// ---

import { TechTree, ResearchType, getResearchEffectFromTree, updateTechTree, AllResearches, getResearchUpgradeCost } from '../techs/techtree';
import { TechCounts, BuildQueueItem } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { TimeMultiplierService } from '../timeMultiplier';
import { UserBonusCache } from '../bonus/UserBonusCache';
import { UserBonuses } from '../bonus/userBonusTypes';

class User {
  id: number;
  username: string;
  password_hash: string;
  iron: number;
  xp: number;
  last_updated: number;
  techTree: TechTree;
  ship_id?: number; // Optional ship ID for linking to player's ship
  techCounts: TechCounts; // Tech counts for weapons and defense

  // Defense current values (persisted)
  hullCurrent: number;
  armorCurrent: number;
  shieldCurrent: number;
  defenseLastRegen: number; // Timestamp in seconds for regeneration tracking

  // Battle state (persisted)
  inBattle: boolean;
  currentBattleId: number | null;

  // Build queue (persisted)
  buildQueue: BuildQueueItem[];
  buildStartSec: number | null;

  // Teleport charges (persisted)
  teleportCharges: number;
  teleportLastRegen: number;

  // TODO: Need to figure out where this is implemented: Should we use locks here?
  private saveCallback: SaveUserCallback;

  constructor(
    id: number,
    username: string,
    password_hash: string,
    iron: number,
    xp: number,
    last_updated: number,
    techTree: TechTree,
    saveCallback: SaveUserCallback,
    techCounts: TechCounts,
    hullCurrent: number,
    armorCurrent: number,
    shieldCurrent: number,
    defenseLastRegen: number,
    inBattle: boolean,
    currentBattleId: number | null,
    buildQueue: BuildQueueItem[],
    buildStartSec: number | null,
    teleportCharges: number,
    teleportLastRegen: number,
    ship_id?: number
  ) {
    this.id = id;
    this.username = username;
    this.password_hash = password_hash;
    this.iron = iron;
    this.xp = xp;
    this.last_updated = last_updated;
    this.techTree = techTree;
    this.techCounts = techCounts;
    this.hullCurrent = hullCurrent;
    this.armorCurrent = armorCurrent;
    this.shieldCurrent = shieldCurrent;
    this.defenseLastRegen = defenseLastRegen;
    this.inBattle = inBattle;
    this.currentBattleId = currentBattleId;
    this.buildQueue = buildQueue;
    this.buildStartSec = buildStartSec;
    this.teleportCharges = teleportCharges;
    this.teleportLastRegen = teleportLastRegen;
    this.ship_id = ship_id;
    this.saveCallback = saveCallback;
  }

  getIronPerSecond(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.IronHarvesting);
  }

  getMaxShipSpeed(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.ShipSpeed);
  }

  calculateIronIncrement(elapsedSeconds: number): number {
    return this.getIronPerSecond() * elapsedSeconds;
  }

  /**
   * Get the maximum iron capacity based on Iron Capacity research
   */
  getMaxIronCapacity(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.IronCapacity);
  }

  /**
   * Calculate player level from total XP.
   * Level 1 = 0 XP
   * Level 2 = 1,000 XP
   * Level 3 = 4,000 XP (1000 + 3000)
   * Level 4 = 10,000 XP (1000 + 3000 + 6000)
   * Pattern: Each level requires 1000 more XP than the previous increment
   * Increment for level N is triangular number N-1: (N-1)*N/2 * 1000
   */
  getLevel(): number {
    let level = 1;
    let totalXpNeeded = 0;

    // Keep adding levels while we have enough XP
    while (true) {
      // Calculate XP increment needed to reach next level
      // Increment for level (level+1) is triangular number (level): level*(level+1)/2 * 1000
      const xpForNextLevel = (level * (level + 1) / 2) * 1000;
      
      if (this.xp >= totalXpNeeded + xpForNextLevel) {
        totalXpNeeded += xpForNextLevel;
        level++;
      } else {
        break;
      }
    }

    return level;
  }

  /**
   * Get the total XP required to reach the next level.
   * Returns the XP threshold, not the remaining XP needed.
   */
  getXpForNextLevel(): number {
    const currentLevel = this.getLevel();
    const nextLevel = currentLevel + 1;

    // Calculate total XP needed for next level
    // Progression: Level N needs sum from k=1 to N-1 of (triangular number k)
    // Triangular number k = k*(k+1)/2
    // So total = sum from k=1 to N-1 of (k*(k+1)/2 * 1000)
    let totalXpNeeded = 0;
    for (let k = 1; k < nextLevel; k++) {
      totalXpNeeded += (k * (k + 1) / 2) * 1000;
    }
    return totalXpNeeded;
  }

  /**
   * Add iron to the user's inventory with capacity enforcement
   * @param amount Amount of iron to add
   * @param maxCapacity Optional bonused max capacity; defaults to getMaxIronCapacity() (research only)
   * @returns The actual amount added (may be less if cap is hit)
   */
  addIron(amount: number, maxCapacity?: number): number {
    if (amount <= 0) return 0;
    const cap = maxCapacity ?? this.getMaxIronCapacity();
    const newIron = this.iron + amount;
    const cappedIron = Math.min(newIron, cap);
    const actualAdded = cappedIron - this.iron;
    this.iron = cappedIron;
    return actualAdded;
  }

  /**
   * Subtract iron from the user's inventory
   * @param amount Amount of iron to subtract
   * @returns true if successful, false if insufficient iron
   */
  subtractIron(amount: number): boolean {
    if (this.iron < amount) {
      return false;
    }
    this.iron -= amount;
    return true;
  }

  /**
   * Add XP to the user.
   * @param amount Amount of XP to add (must be positive)
   * @returns Object with leveledUp flag and old/new levels if level increased, undefined otherwise
   */
  addXp(amount: number): { leveledUp: boolean; oldLevel: number; newLevel: number } | undefined {
    if (amount <= 0) return undefined;

    const oldLevel = this.getLevel();
    this.xp += amount;
    const newLevel = this.getLevel();

    if (newLevel > oldLevel) {
      UserBonusCache.getInstance().invalidateBonuses(this.id);
      return { leveledUp: true, oldLevel, newLevel };
    }

    return undefined;
  }

  /**
   * Update user stats based on elapsed time.
   * @param now Current timestamp in seconds
   * @param bonuses Pre-computed user bonuses (optional). When provided, bonused iron rate and
   *   capacity are used. When omitted, falls back to direct tech-tree lookups (backward-compat).
   */
  updateStats(now: number, bonuses?: UserBonuses): { levelUp?: { leveledUp: boolean; oldLevel: number; newLevel: number; xpReward: number; source: 'research' } } {
    const elapsed = now - this.last_updated;
    if (elapsed <= 0) return {};

    // Apply time multiplier to accelerate game progression
    const gameElapsed = elapsed * TimeMultiplierService.getInstance().getMultiplier();

    // Determine the effective iron rate and max capacity from bonuses (if provided)
    // or from tech tree directly (backward-compat fallback).
    const ironRateFromBonuses = bonuses?.ironRechargeRate;
    const maxCapacityFromBonuses = bonuses?.ironStorageCapacity;

    let ironToAdd = 0;
    let researchResult: { completed: boolean; type: ResearchType; completedLevel: number } | undefined;
    const techTree = this.techTree;
    const active = techTree.activeResearch;
    if (!active || active.type !== ResearchType.IronHarvesting) {
      // No relevant research in progress, just award all time
      const ironRate = ironRateFromBonuses ?? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
      ironToAdd += ironRate * gameElapsed;
      researchResult = updateTechTree(techTree, gameElapsed);
    } else {
      const timeToComplete = active.remainingDuration;
      if (gameElapsed < timeToComplete) {
        // Research does not complete in this interval
        const ironRate = ironRateFromBonuses ?? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
        ironToAdd += ironRate * gameElapsed;
        researchResult = updateTechTree(techTree, gameElapsed);
      } else {
        // Research completes during this interval
        // 1. Award up to research completion at old rate
        const ironRateBefore = ironRateFromBonuses ?? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
        ironToAdd += ironRateBefore * timeToComplete;
        researchResult = updateTechTree(techTree, timeToComplete);
        // 2. After research completes, award remaining time at new rate (if any)
        const remaining = gameElapsed - timeToComplete;
        if (remaining > 0) {
          // Bonuses are stale (computed before research completed).
          // Re-compute the new iron rate from the updated tech tree, scaled by the cached level multiplier.
          const ironRateAfter = bonuses
            ? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * bonuses.levelMultiplier
            : getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
          ironToAdd += ironRateAfter * remaining;
          // Second updateTechTree call should not complete another research (no overwrites)
          updateTechTree(techTree, remaining);
        }
      }
    }
    // Use centralized addIron method which enforces capacity cap
    this.addIron(ironToAdd, maxCapacityFromBonuses);
    this.last_updated = now;

    // Also update defense values (regeneration)
    this.updateDefenseValues(now, bonuses);

    // Update teleport charges (regeneration)
    this.updateTeleportCharges(now);

    // Check if research completed and award XP
    let levelUpInfo: { leveledUp: boolean; oldLevel: number; newLevel: number; xpReward: number; source: 'research' } | undefined;
    if (researchResult?.completed) {
      // Invalidate cached bonuses because research-derived values have changed.
      // (If addXp() also causes a level-up, it will call invalidateBonuses() again — that is harmless.)
      UserBonusCache.getInstance().invalidateBonuses(this.id);

      const research = AllResearches[researchResult.type];
      // Get the cost of the level that was just completed (completedLevel + 1)
      const cost = getResearchUpgradeCost(research, researchResult.completedLevel + 1);
      const xpReward = Math.floor(cost / 25);
      const levelUp = this.addXp(xpReward);

      if (levelUp) {
        levelUpInfo = { ...levelUp, xpReward, source: 'research' as const };
      }
    }

    return levelUpInfo ? { levelUp: levelUpInfo } : {};
  }

  /**
   * Update teleport charges based on elapsed time and recharge research.
   * Charges accumulate fractionally but only whole charges are usable.
   * @param now Current timestamp in seconds
   */
  updateTeleportCharges(now: number): void {
    const maxCharges = getResearchEffectFromTree(this.techTree, ResearchType.Teleport);
    if (maxCharges === 0) return; // no teleport research, skip

    const rechargeTimeSec = getResearchEffectFromTree(this.techTree, ResearchType.TeleportRechargeSpeed);
    if (rechargeTimeSec <= 0) return; // safety: no valid recharge time

    if (this.teleportLastRegen === 0) {
      // First call: initialize without accumulating retroactive charges
      this.teleportLastRegen = now;
      return;
    }

    const elapsed = now - this.teleportLastRegen;
    if (elapsed <= 0) return;

    const timeMultiplier = TimeMultiplierService.getInstance().getMultiplier();
    const gameElapsed = elapsed * timeMultiplier;

    const chargeGain = gameElapsed / rechargeTimeSec;
    this.teleportCharges = Math.min(maxCharges, this.teleportCharges + chargeGain);
    this.teleportLastRegen = now;
  }

  /**
   * Update defense values based on elapsed time since last regeneration
   * Regeneration rate: bonused repair speed per second (defaults to 1 point/sec if no bonuses)
   * Capped at maximum values (cannot exceed)
   * @param now Current timestamp in seconds
   * @param bonuses Pre-computed user bonuses (optional). When provided, bonused regen rates and
   *   level-multiplied max defense are used. When omitted, falls back to base rates (backward-compat).
   */
  updateDefenseValues(now: number, bonuses?: UserBonuses): void {
    const elapsed = now - this.defenseLastRegen;
    if (elapsed <= 0) return;

    // Apply time multiplier to accelerate regeneration
    const gameElapsed = elapsed * TimeMultiplierService.getInstance().getMultiplier();

    // Calculate maximum values based on tech counts and research (with optional level multiplier)
    const levelMultiplier = bonuses?.levelMultiplier;
    const maxStats = TechService.calculateMaxDefense(this.techCounts, this.techTree, levelMultiplier);
    const maxHull = maxStats.hull;
    const maxArmor = maxStats.armor;
    const maxShield = maxStats.shield;

    // Determine regen rates from bonuses or fall back to base rate (1.0/sec)
    const hullRegen = bonuses?.hullRepairSpeed ?? 1;
    const armorRegen = bonuses?.armorRepairSpeed ?? 1;
    const shieldRegen = bonuses?.shieldRechargeRate ?? 1;

    // Apply regeneration (bonused rate/second), clamped at max
    this.hullCurrent = Math.min(this.hullCurrent + hullRegen * gameElapsed, maxHull);
    this.armorCurrent = Math.min(this.armorCurrent + armorRegen * gameElapsed, maxArmor);
    this.shieldCurrent = Math.min(this.shieldCurrent + shieldRegen * gameElapsed, maxShield);

    // Update last regeneration timestamp (remains in real time)
    this.defenseLastRegen = now;
  }

  async save(): Promise<void> {
    await this.saveCallback(this);
  }

  /**
   * Handle collection of space objects
   * @param objectType Type of the collected object
   */
  collected(objectType: 'asteroid' | 'shipwreck' | 'escape_pod'): void {
    let ironReward = 0;

    switch (objectType) {
      case 'asteroid':
        // Asteroids yield between 50-700 iron
        ironReward = Math.floor(Math.random() * (700 - 50 + 1)) + 50;
        break;

      case 'shipwreck':
        // Shipwrecks yield between 50-2000 iron
        ironReward = Math.floor(Math.random() * (2000 - 50 + 1)) + 50;
        break;

      case 'escape_pod':
        // Escape pods do nothing for now
        ironReward = 0;
        break;

      default:
        console.warn(`Unknown object type collected: ${objectType}`);
        ironReward = 0;
    }

    // Award the iron using centralized method with capacity enforcement
    const actualAdded = this.addIron(ironReward);

    console.log(`User ${this.username} collected a ${objectType} and received ${actualAdded} iron (total: ${this.iron})`);
  }
}

type SaveUserCallback = (user: User) => Promise<void>;
export { User };
export type { SaveUserCallback };
