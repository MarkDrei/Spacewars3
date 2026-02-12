// ---
// Domain logic for the User and its stats, including persistence callback.
// ---

import { TechTree, ResearchType, getResearchEffectFromTree, updateTechTree } from '../techs/techtree';
import { TechCounts, BuildQueueItem } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';

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
   * Get the maximum iron capacity based on inventory capacity research
   */
  getMaxIronCapacity(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.InventoryCapacity);
  }

  /**
   * Add iron to the user's inventory with capacity enforcement
   * @param amount Amount of iron to add
   * @returns The actual amount added (may be less if cap is hit)
   */
  addIron(amount: number): number {
    if (amount <= 0) return 0;
    const maxCapacity = this.getMaxIronCapacity();
    const newIron = this.iron + amount;
    const cappedIron = Math.min(newIron, maxCapacity);
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

  updateStats(now: number): void {
    const elapsed = now - this.last_updated;
    if (elapsed <= 0) return;

    let ironToAdd = 0;
    const techTree = this.techTree;
    const active = techTree.activeResearch;
    if (!active || active.type !== ResearchType.IronHarvesting) {
      // No relevant research in progress, just award all time
      ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * elapsed;
      updateTechTree(techTree, elapsed);
    } else {
      const timeToComplete = active.remainingDuration;
      if (elapsed < timeToComplete) {
        // Research does not complete in this interval
        ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * elapsed;
        updateTechTree(techTree, elapsed);
      } else {
        // Research completes during this interval
        // 1. Award up to research completion at old rate
        ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * timeToComplete;
        updateTechTree(techTree, timeToComplete);
        // 2. After research completes, award remaining time at new rate (if any)
        const remaining = elapsed - timeToComplete;
        if (remaining > 0) {
          ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * remaining;
          updateTechTree(techTree, remaining);
        }
      }
    }
    // Use centralized addIron method which enforces capacity cap
    this.addIron(ironToAdd);
    this.last_updated = now;

    // Also update defense values (regeneration)
    this.updateDefenseValues(now);
  }

  /**
   * Update defense values based on elapsed time since last regeneration
   * Regeneration rate: 1 point per second per defense type
   * Capped at maximum values (cannot exceed)
   */
  updateDefenseValues(now: number): void {
    const elapsed = now - this.defenseLastRegen;
    if (elapsed <= 0) return;

    // Calculate maximum values based on tech counts and research
    const maxStats = TechService.calculateMaxDefense(this.techCounts, this.techTree);
    const maxHull = maxStats.hull;
    const maxArmor = maxStats.armor;
    const maxShield = maxStats.shield;

    // Apply regeneration (1 point/second), clamped at max
    this.hullCurrent = Math.min(this.hullCurrent + elapsed, maxHull);
    this.armorCurrent = Math.min(this.armorCurrent + elapsed, maxArmor);
    this.shieldCurrent = Math.min(this.shieldCurrent + elapsed, maxShield);

    // Update last regeneration timestamp
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
        // Asteroids yield between 50-250 iron
        ironReward = Math.floor(Math.random() * (250 - 50 + 1)) + 50;
        break;

      case 'shipwreck':
        // Shipwrecks yield between 50-1000 iron
        ironReward = Math.floor(Math.random() * (1000 - 50 + 1)) + 50;
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
