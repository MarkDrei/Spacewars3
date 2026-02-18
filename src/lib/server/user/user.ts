// ---
// Domain logic for the User and its stats, including persistence callback.
// ---

import { TechTree, ResearchType, getResearchEffectFromTree, updateTechTree, AllResearches, getResearchUpgradeCost } from '../techs/techtree';
import { TechCounts, BuildQueueItem } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { TimeMultiplierService } from '../timeMultiplier';
import { InventoryItem, INVENTORY_ROWS, INVENTORY_COLS } from '../../../shared/src/types/inventory';

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

  // Inventory (persisted) - 10×10 grid
  inventory: (InventoryItem | null)[][];

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
    inventory: (InventoryItem | null)[][],
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
    this.inventory = inventory;
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
      return { leveledUp: true, oldLevel, newLevel };
    }

    return undefined;
  }

  updateStats(now: number): { levelUp?: { leveledUp: boolean; oldLevel: number; newLevel: number; xpReward: number; source: 'research' } } {
    const elapsed = now - this.last_updated;
    if (elapsed <= 0) return {};

    // Apply time multiplier to accelerate game progression
    const gameElapsed = elapsed * TimeMultiplierService.getInstance().getMultiplier();

    let ironToAdd = 0;
    let researchResult: { completed: boolean; type: ResearchType; completedLevel: number } | undefined;
    const techTree = this.techTree;
    const active = techTree.activeResearch;
    if (!active || active.type !== ResearchType.IronHarvesting) {
      // No relevant research in progress, just award all time
      ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * gameElapsed;
      researchResult = updateTechTree(techTree, gameElapsed);
    } else {
      const timeToComplete = active.remainingDuration;
      if (gameElapsed < timeToComplete) {
        // Research does not complete in this interval
        ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * gameElapsed;
        researchResult = updateTechTree(techTree, gameElapsed);
      } else {
        // Research completes during this interval
        // 1. Award up to research completion at old rate
        ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * timeToComplete;
        researchResult = updateTechTree(techTree, timeToComplete);
        // 2. After research completes, award remaining time at new rate (if any)
        const remaining = gameElapsed - timeToComplete;
        if (remaining > 0) {
          ironToAdd += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * remaining;
          // Second updateTechTree call should not complete another research (no overwrites)
          updateTechTree(techTree, remaining);
        }
      }
    }
    // Use centralized addIron method which enforces capacity cap
    this.addIron(ironToAdd);
    this.last_updated = now;

    // Also update defense values (regeneration)
    this.updateDefenseValues(now);

    // Check if research completed and award XP
    let levelUpInfo: { leveledUp: boolean; oldLevel: number; newLevel: number; xpReward: number; source: 'research' } | undefined;
    if (researchResult?.completed) {
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
   * Update defense values based on elapsed time since last regeneration
   * Regeneration rate: 1 point per second per defense type
   * Capped at maximum values (cannot exceed)
   */
  updateDefenseValues(now: number): void {
    const elapsed = now - this.defenseLastRegen;
    if (elapsed <= 0) return;

    // Apply time multiplier to accelerate regeneration
    const gameElapsed = elapsed * TimeMultiplierService.getInstance().getMultiplier();

    // Calculate maximum values based on tech counts and research
    const maxStats = TechService.calculateMaxDefense(this.techCounts, this.techTree);
    const maxHull = maxStats.hull;
    const maxArmor = maxStats.armor;
    const maxShield = maxStats.shield;

    // Apply regeneration (1 point/second), clamped at max
    this.hullCurrent = Math.min(this.hullCurrent + gameElapsed, maxHull);
    this.armorCurrent = Math.min(this.armorCurrent + gameElapsed, maxArmor);
    this.shieldCurrent = Math.min(this.shieldCurrent + gameElapsed, maxShield);

    // Update last regeneration timestamp (remains in real time)
    this.defenseLastRegen = now;
  }

  async save(): Promise<void> {
    await this.saveCallback(this);
  }

  // ========== INVENTORY METHODS ==========

  /**
   * Get the user's inventory grid.
   * @returns 10×10 2D array of inventory items (null for empty slots)
   */
  getInventory(): (InventoryItem | null)[][] {
    return this.inventory;
  }

  /**
   * Find the first free slot in the inventory, scanning row-by-row, left-to-right.
   * @returns Coordinates of the first free slot, or null if inventory is full
   */
  findFirstFreeSlot(): { row: number; col: number } | null {
    for (let row = 0; row < INVENTORY_ROWS; row++) {
      for (let col = 0; col < INVENTORY_COLS; col++) {
        if (this.inventory[row][col] === null) {
          return { row, col };
        }
      }
    }
    return null; // Inventory is full
  }

  /**
   * Add an item to the first available slot in the inventory.
   * @param item The inventory item to add
   * @returns true if added successfully, false if inventory is full
   */
  addItemToInventory(item: InventoryItem): boolean {
    const freeSlot = this.findFirstFreeSlot();
    if (freeSlot === null) {
      return false; // Inventory full
    }
    this.inventory[freeSlot.row][freeSlot.col] = item;
    return true;
  }

  /**
   * Move an item from one slot to another.
   * If the target slot is empty, the item is moved.
   * If the target slot is occupied, the items are swapped.
   * @param fromRow Source row (0-9)
   * @param fromCol Source column (0-9)
   * @param toRow Target row (0-9)
   * @param toCol Target column (0-9)
   * @returns true if successful, false if coordinates are out of bounds
   */
  moveItem(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Validate bounds
    if (
      fromRow < 0 || fromRow >= INVENTORY_ROWS ||
      fromCol < 0 || fromCol >= INVENTORY_COLS ||
      toRow < 0 || toRow >= INVENTORY_ROWS ||
      toCol < 0 || toCol >= INVENTORY_COLS
    ) {
      return false;
    }

    // Swap/move items
    const temp = this.inventory[fromRow][fromCol];
    this.inventory[fromRow][fromCol] = this.inventory[toRow][toCol];
    this.inventory[toRow][toCol] = temp;

    return true;
  }

  /**
   * Remove an item from a specific slot.
   * @param row Row index (0-9)
   * @param col Column index (0-9)
   * @returns The removed item, or null if slot was empty or coordinates invalid
   */
  removeItem(row: number, col: number): InventoryItem | null {
    // Validate bounds
    if (row < 0 || row >= INVENTORY_ROWS || col < 0 || col >= INVENTORY_COLS) {
      return null;
    }

    const item = this.inventory[row][col];
    this.inventory[row][col] = null;
    return item;
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
