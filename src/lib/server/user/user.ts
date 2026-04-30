// ---
// Domain logic for the User and its stats, including persistence callback.
// ---

import { TechTree, ResearchType, getResearchEffectFromTree, getTimeSpeedFactorFromTree, updateTechTree, AllResearches, getResearchUpgradeCost } from '../techs/techtree';
import { TechCounts, BuildQueueItem } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { TimeMultiplierService } from '../timeMultiplier';
import { UserBonusCache } from '../bonus/UserBonusCache';
import { BASE_REGEN_RATE, UserBonuses } from '../bonus/userBonusTypes';
import { HasLock4Context, IronLocks, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';

class User {
  id: number;
  username: string;
  password_hash: string;
  iron: number;
  xp: number;
  score: number = 0;
  last_updated: number;
  techTree: TechTree;
  ship_id?: number; // Optional ship ID for linking to player's ship
  techCounts: TechCounts; // Tech counts for weapons and defense

  // Email address (optional)
  email: string | null = null;
  emailVerified: boolean = false;

  // Locale preference (persisted)
  preferredLocale: string = 'en';

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

  // for testing we allow injection of helpers that are otherwise singletons
  bonusCache: UserBonusCache;
  timeMultiplierService: TimeMultiplierService;

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
    ship_id?: number,
    // dependencies injected for testing; production callers may omit and defaults will grab the
    // global singletons. Placed at end so existing call sites are unaffected.
    bonusCache: UserBonusCache = UserBonusCache.getInstance(),
    timeMultiplierService: TimeMultiplierService = TimeMultiplierService.getInstance()
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

    // store injected dependencies for later use
    this.bonusCache = bonusCache;
    this.timeMultiplierService = timeMultiplierService;
  }

  /**
   * Convenience factory that avoids having to think about the injectable
   * dependencies in most call sites. Equivalent to calling the constructor
   * without the last two parameters, which default to the global singletons.
   */
  static create(
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
  ): User {
    return new User(
      id,
      username,
      password_hash,
      iron,
      xp,
      last_updated,
      techTree,
      saveCallback,
      techCounts,
      hullCurrent,
      armorCurrent,
      shieldCurrent,
      defenseLastRegen,
      inBattle,
      currentBattleId,
      buildQueue,
      buildStartSec,
      teleportCharges,
      teleportLastRegen,
      ship_id
    );
  }

  getIronPerSecond(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.IronHarvesting);
  }


  /**
   * Get the ship's theoretical maximum speed based on the provided bonuses.
   *
   * The `bonuses` object is required; if the caller simply needs the research
   * effect they can compute it independently via
   * `getResearchEffectFromTree(this.techTree, ResearchType.ShipSpeed)`
   * 
   * @param bonuses Pre-computed bonuses.
   */
  getMaxShipSpeed(bonuses: UserBonuses): number {
    return bonuses.maxShipSpeed;
  }

  /**
   * Async helper: use the provided lock context to look up the current bonuses
   * then delegate to the synchronous `getMaxShipSpeed` above.
   */
  async getMaxShipSpeedWithContext<THeld extends IronLocks>(context: HasLock4Context<THeld>): Promise<number> {
    const bonuses = await this.bonusCache.getBonuses(context, this.id);
    return this.getMaxShipSpeed(bonuses);
  }

  /**
   * Get the user's **current** maximum speed.  This will normally equal the
   * theoretical max returned by `getMaxShipSpeed(bonuses)` (and in fact simply
   * delegates to that method) but it exists as a distinct call so callers can
   * later subtract modifiers such as damage or temporary slowdowns.
   *
   * @param bonuses Pre-computed bonuses.
   */
  getCurrentMaxShipSpeed(bonuses: UserBonuses): number {
    return this.getMaxShipSpeed(bonuses);
  }

  /**
   * Convenience variant that looks up bonuses for this user under the supplied
   * lock context, then returns the resulting speed.
   */
  async getCurrentMaxShipSpeedWithContext<THeld extends IronLocks>(context: HasLock4Context<THeld>): Promise<number> {
    const bonuses = await this.bonusCache.getBonuses(context, this.id);
    return this.getCurrentMaxShipSpeed(bonuses);
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

  private getLevelMultiplier(): number {
    return Math.pow(1.15, this.getLevel() - 1);
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
      this.bonusCache.invalidateBonuses(this.id);
      return { leveledUp: true, oldLevel, newLevel };
    }

    return undefined;
  }

  /**
   * Add score to the user (economic progression metric).
   * Unlike addXp, this does not trigger level-ups.
   * @param amount Amount of score to add (must be positive; non-positive amounts are ignored)
   */
  addScore(amount: number): void {
    if (amount <= 0) return;
    this.score += amount;
  }

  /**
   * @param now Current timestamp in seconds
   * @param context Held user lock context used for build-queue refresh and bonus lookups.
   * @param bonuses Pre-computed user bonuses (optional). When provided, bonused iron rate and
   *   capacity are used. When omitted, falls back to direct tech-tree lookups (backward-compat).
   */
  async updateStats(now: number, context: LockContext<LocksAtMostAndHas4>, bonuses?: UserBonuses): Promise<{ researchCompleted?: { type: ResearchType; completedLevel: number; researchName: string; scoreReward: number } }> {
    // Process any completed builds so tech counts are up-to-date
    // (e.g., if this user was offline and builds completed in the DB)
    const techService = TechService.getInstance();
    await techService.processCompletedBuilds(this.id, context);

    const elapsed = now - this.last_updated;
    if (elapsed <= 0) return {};

    // Apply time multiplier to accelerate game progression
    const gameElapsed = elapsed * this.timeMultiplierService.getMultiplier();
    const researchSpeedFactor = bonuses?.researchSpeedFactor
      ?? getTimeSpeedFactorFromTree(this.techTree, ResearchType.ArtificialIntelligence, this.getLevelMultiplier());
    const researchElapsed = gameElapsed * researchSpeedFactor;

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
      researchResult = updateTechTree(techTree, researchElapsed);
    } else {
      const timeToComplete = active.remainingDuration;
      const gameSecondsToComplete = timeToComplete / researchSpeedFactor;
      if (gameElapsed < gameSecondsToComplete) {
        // Research does not complete in this interval
        const ironRate = ironRateFromBonuses ?? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
        ironToAdd += ironRate * gameElapsed;
        researchResult = updateTechTree(techTree, researchElapsed);
      } else {
        // Research completes during this interval
        // 1. Award up to research completion at old rate
        const ironRateBefore = ironRateFromBonuses ?? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
        ironToAdd += ironRateBefore * gameSecondsToComplete;
        researchResult = updateTechTree(techTree, timeToComplete);
        // 2. After research completes, award remaining time at new rate (if any)
        const remaining = gameElapsed - gameSecondsToComplete;
        if (remaining > 0) {
          // Bonuses are stale (computed before research completed).
          // Re-compute the new iron rate from the updated tech tree, scaled by the cached level multiplier.
          const ironRateAfter = bonuses
            ? getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * bonuses.levelMultiplier
            : getResearchEffectFromTree(techTree, ResearchType.IronHarvesting);
          ironToAdd += ironRateAfter * remaining;
          updateTechTree(techTree, remaining * researchSpeedFactor);
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

    // Check if research completed and award score
    let researchCompletedInfo: { type: ResearchType; completedLevel: number; researchName: string; scoreReward: number } | undefined;
    if (researchResult?.completed) {
      // Invalidate cached bonuses because research-derived values have changed.
      this.bonusCache.invalidateBonuses(this.id);

      const research = AllResearches[researchResult.type];
      // Get the cost of the level that was just completed
      const cost = getResearchUpgradeCost(research, researchResult.completedLevel);
      const scoreReward = Math.floor(cost / 25);
      this.addScore(scoreReward);

      researchCompletedInfo = {
        type: researchResult.type,
        completedLevel: researchResult.completedLevel,
        researchName: research.name,
        scoreReward,
      };
    }

    const result: { researchCompleted?: typeof researchCompletedInfo } = {};
    if (researchCompletedInfo) result.researchCompleted = researchCompletedInfo;
    return result;
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

    const timeMultiplier = this.timeMultiplierService.getMultiplier();
    const gameElapsed = elapsed * timeMultiplier;

    const chargeGain = gameElapsed / rechargeTimeSec;
    this.teleportCharges = Math.min(maxCharges, this.teleportCharges + chargeGain);
    this.teleportLastRegen = now;
  }

  /**
   * Update defense values based on elapsed time since last regeneration
   * Shield recharge is always active. Hull/armor repair shares a single repair pool and is disabled
   * during battle.
   * Capped at maximum values (cannot exceed)
   * @param now Current timestamp in seconds
   * @param bonuses Pre-computed user bonuses (optional). When provided, bonused regen rates and
   *   level-multiplied max defense are used. When omitted, falls back to base rates.
   */
  updateDefenseValues(now: number, bonuses?: UserBonuses): void {
    const elapsed = now - this.defenseLastRegen;
    if (elapsed <= 0) return;

    // Apply time multiplier to accelerate regeneration
    const gameElapsed = elapsed * this.timeMultiplierService.getMultiplier();

    // Calculate maximum values based on tech counts and research (with optional level multiplier)
    const levelMultiplier = bonuses?.levelMultiplier;
    const maxStats = TechService.calculateMaxDefense(this.techCounts, this.techTree, levelMultiplier);
    const maxHull = maxStats.hull;
    const maxArmor = maxStats.armor;
    const maxShield = maxStats.shield;

    const shieldRechargeRate = this.resolveShieldRechargeRate(bonuses);
    this.shieldCurrent = Math.min(this.shieldCurrent + shieldRechargeRate * gameElapsed, maxShield);

    if (!this.inBattle) {
      const repairRate = this.resolveRepairRate(bonuses);
      let remainingRepairTime = gameElapsed;

      while (remainingRepairTime > 0) {
        const hullDamaged = this.hullCurrent < maxHull;
        const armorDamaged = this.armorCurrent < maxArmor;

        if (!hullDamaged && !armorDamaged) {
          break;
        }

        if (hullDamaged && armorDamaged) {
          const splitRepairRate = repairRate / 2;
          if (splitRepairRate <= 0) {
            break;
          }

          const hullTimeToFull = (maxHull - this.hullCurrent) / splitRepairRate;
          const armorTimeToFull = (maxArmor - this.armorCurrent) / splitRepairRate;
          const step = Math.min(remainingRepairTime, hullTimeToFull, armorTimeToFull);

          if (step <= 0) {
            break;
          }

          this.hullCurrent = Math.min(this.hullCurrent + splitRepairRate * step, maxHull);
          this.armorCurrent = Math.min(this.armorCurrent + splitRepairRate * step, maxArmor);
          remainingRepairTime -= step;
          continue;
        }

        if (hullDamaged) {
          this.hullCurrent = Math.min(this.hullCurrent + repairRate * remainingRepairTime, maxHull);
          break;
        }

        this.armorCurrent = Math.min(this.armorCurrent + repairRate * remainingRepairTime, maxArmor);
        break;
      }
    }

    // Update last regeneration timestamp (remains in real time)
    this.defenseLastRegen = now;
  }

  getDefenseRegenRates(bonuses?: UserBonuses): { hull: number; armor: number; shield: number } {
    const maxStats = TechService.calculateMaxDefense(this.techCounts, this.techTree, bonuses?.levelMultiplier);
    return this.calculateDefenseRegenRates(maxStats, bonuses);
  }

  private calculateDefenseRegenRates(
    maxStats: { hull: number; armor: number; shield: number },
    bonuses?: UserBonuses
  ): { hull: number; armor: number; shield: number } {
    const repairRate = this.resolveRepairRate(bonuses);
    const shieldRechargeRate = this.resolveShieldRechargeRate(bonuses);

    if (this.inBattle) {
      return { hull: 0, armor: 0, shield: shieldRechargeRate };
    }

    const hullDamaged = this.hullCurrent < maxStats.hull;
    const armorDamaged = this.armorCurrent < maxStats.armor;

    if (hullDamaged && armorDamaged) {
      return {
        hull: repairRate / 2,
        armor: repairRate / 2,
        shield: shieldRechargeRate,
      };
    }

    if (hullDamaged) {
      return { hull: repairRate, armor: 0, shield: shieldRechargeRate };
    }

    if (armorDamaged) {
      return { hull: 0, armor: repairRate, shield: shieldRechargeRate };
    }

    return { hull: 0, armor: 0, shield: shieldRechargeRate };
  }

  private resolveRepairRate(bonuses?: UserBonuses): number {
    return bonuses?.repairRate ?? BASE_REGEN_RATE;
  }

  private resolveShieldRechargeRate(bonuses?: UserBonuses): number {
    return bonuses?.shieldRechargeRate ?? BASE_REGEN_RATE;
  }

  async save(): Promise<void> {
    await this.saveCallback(this);
  }

  /**
   * Handle collection of space objects
   * @param objectType Type of the collected object
   * @param maxCapacity Optional bonused max capacity; defaults to getMaxIronCapacity() (research only)
   */
  collected(objectType: 'asteroid' | 'shipwreck' | 'escape_pod', maxCapacity?: number): void {
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
    const actualAdded = this.addIron(ironReward, maxCapacity);

    console.log(`User ${this.username} collected a ${objectType} and received ${actualAdded} iron (total: ${this.iron})`);
  }
}

type SaveUserCallback = (user: User) => Promise<void>;
export { User };
export type { SaveUserCallback };
