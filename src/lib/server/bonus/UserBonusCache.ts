// ---
// UserBonusCache — singleton that lazily computes and caches per-user bonus values.
//
// Dependencies (injected via configureDependencies()):
//   - UserCache        — reads User from in-memory cache (LOCK_4 held by caller)
//   - InventoryService — reads bridge grid (acquires LOCK_5 internally; lock order 4→5 is valid)
//
// Lock usage:
//   - getBonuses / updateBonuses require the caller to hold USER_LOCK (LOCK_4).
//   - invalidateBonuses / discardAllBonuses are synchronous and require no lock.
// ---

import { HasLock4Context, IronLocks } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '../user/userCache';
import { InventoryService } from '../inventory/InventoryService';
import { Commander, COMMANDER_STAT_KEYS, CommanderStatKey, CommanderData } from '../inventory/Commander';
import {
  getResearchEffectFromTree,
  getWeaponDamageModifierFromTree,
  getWeaponAccuracyModifierFromTree,
  getWeaponReloadTimeModifierFromTree,
  ResearchType,
} from '../techs/techtree';
import { BASE_REGEN_RATE, UserBonuses } from './userBonusTypes';

// Representative weapon keys used when querying per-weapon-category research.
const PROJECTILE_WEAPON_KEY = 'auto_turret';
const ENERGY_WEAPON_KEY = 'pulse_laser';

type UserBonusCacheDependencies = {
  userCache: UserCache;
  inventoryService: InventoryService;
};

declare global {
  // eslint-disable-next-line no-var
  var userBonusCacheInstance: UserBonusCache | null;  // required for globalThis augmentation
}

/**
 * Singleton cache of pre-computed per-user bonus values.
 *
 * Lifecycle:
 *  - Lazily computed on first `getBonuses()` call per user.
 *  - Invalidated (deleted from map) via `invalidateBonuses()` / `discardAllBonuses()`.
 *  - Not persisted to DB: lost on server restart and rebuilt on next access.
 */
export class UserBonusCache {
  private static dependencies: UserBonusCacheDependencies | null = null;

  private readonly bonusMap: Map<number, UserBonuses> = new Map();

  private constructor() {}

  // ─── Singleton management ──────────────────────────────────────────────────

  private static get instance(): UserBonusCache | null {
    return globalThis.userBonusCacheInstance ?? null;
  }

  private static set instance(value: UserBonusCache | null) {
    globalThis.userBonusCacheInstance = value;
  }

  /** Configure required dependencies before calling getInstance(). */
  static configureDependencies(deps: UserBonusCacheDependencies): void {
    UserBonusCache.dependencies = deps;
  }

  /** Get or create the singleton instance. */
  static getInstance(): UserBonusCache {
    if (!UserBonusCache.instance) {
      UserBonusCache.instance = new UserBonusCache();
    }
    return UserBonusCache.instance;
  }

  /** Destroy the singleton and clear dependencies (use in tests for isolation). */
  static resetInstance(): void {
    UserBonusCache.instance = null;
    UserBonusCache.dependencies = null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Return cached bonuses for the user, computing them on first access.
   * Caller must hold USER_LOCK (LOCK_4).
   */
  async getBonuses<THeld extends IronLocks>(
    ctx: HasLock4Context<THeld>,
    userId: number
  ): Promise<UserBonuses> {
    const cached = this.bonusMap.get(userId);
    if (cached !== undefined) {
      return cached;
    }
    return this.updateBonuses(ctx, userId);
  }

  /**
   * Force recomputation of bonuses for the user, bypassing the cache.
   * Caller must hold USER_LOCK (LOCK_4).
   */
  async updateBonuses<THeld extends IronLocks>(
    ctx: HasLock4Context<THeld>,
    userId: number
  ): Promise<UserBonuses> {
    const deps = this.getDeps();

    // 1. Read User from UserCache (synchronous, LOCK_4 held by caller).
    const user = deps.userCache.getUserByIdFromCache(ctx, userId);
    if (!user) {
      throw new Error(`UserBonusCache: user ${userId} not found in cache`);
    }

    // 2. Level multiplier.
    const levelMultiplier = Math.pow(1.15, user.getLevel() - 1);

    // 3. Read bridge grid — InventoryService acquires LOCK_5 internally (order 4→5 is valid).
    const maxBridgeSlots = Math.floor(
      getResearchEffectFromTree(user.techTree, ResearchType.BridgeSlots)
    );
    const bridgeGrid = await deps.inventoryService.getBridge(userId, maxBridgeSlots);

    // 4. Collect commanders from the bridge grid.
    const commanders: CommanderData[] = bridgeGrid.flatMap(row =>
      row.filter((slot): slot is CommanderData => slot !== null && slot.itemType === 'commander')
    );

    // 5. Compute raw commander bonus percentages, then convert to multipliers.
    const bonusPercentages = Commander.calculateBonuses(commanders);
    const commanderMultipliers = buildCommanderMultipliers(bonusPercentages);

    // 6. Read research effects from the tech tree.
    const tree = user.techTree;

    const ironCapacity = getResearchEffectFromTree(tree, ResearchType.IronCapacity);
    const ironHarvesting = getResearchEffectFromTree(tree, ResearchType.IronHarvesting);
    const shipSpeedEffect = getResearchEffectFromTree(tree, ResearchType.ShipSpeed);
    const afterburnerEffect = getResearchEffectFromTree(tree, ResearchType.Afterburner);

    const projDamageMod = getWeaponDamageModifierFromTree(tree, PROJECTILE_WEAPON_KEY);
    const projReloadMod = getWeaponReloadTimeModifierFromTree(tree, PROJECTILE_WEAPON_KEY);
    const projAccuracyMod = getWeaponAccuracyModifierFromTree(tree, PROJECTILE_WEAPON_KEY);

    const energyDamageMod = getWeaponDamageModifierFromTree(tree, ENERGY_WEAPON_KEY);
    const energyReloadMod = getWeaponReloadTimeModifierFromTree(tree, ENERGY_WEAPON_KEY);
    const energyAccuracyMod = getWeaponAccuracyModifierFromTree(tree, ENERGY_WEAPON_KEY);

    // 7. Combine: finalValue = researchEffect × levelMultiplier × commanderMultiplier (where applicable).
    const bonuses: UserBonuses = {
      levelMultiplier,
      commanderMultipliers,

      ironStorageCapacity: ironCapacity * levelMultiplier,
      ironRechargeRate: ironHarvesting * levelMultiplier,

      hullRepairSpeed: BASE_REGEN_RATE * levelMultiplier,
      armorRepairSpeed: BASE_REGEN_RATE * levelMultiplier,
      shieldRechargeRate: BASE_REGEN_RATE * levelMultiplier,

      maxShipSpeed:
        shipSpeedEffect * (1 + afterburnerEffect / 100) * levelMultiplier * commanderMultipliers.shipSpeed,

      projectileWeaponDamageFactor:
        projDamageMod * levelMultiplier * commanderMultipliers.projectileWeaponDamage,
      projectileWeaponReloadFactor:
        projReloadMod * levelMultiplier * commanderMultipliers.projectileWeaponReloadRate,
      projectileWeaponAccuracyFactor:
        projAccuracyMod * levelMultiplier * commanderMultipliers.projectileWeaponAccuracy,

      energyWeaponDamageFactor:
        energyDamageMod * levelMultiplier * commanderMultipliers.energyWeaponDamage,
      energyWeaponReloadFactor:
        energyReloadMod * levelMultiplier * commanderMultipliers.energyWeaponReloadRate,
      energyWeaponAccuracyFactor:
        energyAccuracyMod * levelMultiplier * commanderMultipliers.energyWeaponAccuracy,
    };

    // 8. Store in map and return.
    this.bonusMap.set(userId, bonuses);
    return bonuses;
  }

  /**
   * Mark the bonuses for the user as stale (removes them from the cache).
   * The next call to getBonuses() will trigger recalculation.
   * Synchronous — no lock needed.
   */
  invalidateBonuses(userId: number): void {
    this.bonusMap.delete(userId);
  }

  /**
   * Clear the entire bonus cache.
   * Synchronous — no lock needed.
   */
  discardAllBonuses(): void {
    this.bonusMap.clear();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private getDeps(): UserBonusCacheDependencies {
    if (!UserBonusCache.dependencies) {
      throw new Error('UserBonusCache: dependencies not configured. Call configureDependencies() first.');
    }
    return UserBonusCache.dependencies;
  }
}

// ---------------------------------------------------------------------------
// Module-private utility
// ---------------------------------------------------------------------------

/**
 * Convert Commander.calculateBonuses() bonus-percentages into a full multiplier
 * record (all CommanderStatKey keys present, value 1.0 when no commander bonus).
 */
function buildCommanderMultipliers(
  bonusPercentages: Partial<Record<CommanderStatKey, number>>
): Record<CommanderStatKey, number> {
  const multipliers = {} as Record<CommanderStatKey, number>;
  for (const key of COMMANDER_STAT_KEYS) {
    const bonusPct = bonusPercentages[key];
    multipliers[key] = bonusPct !== undefined ? 1 + bonusPct / 100 : 1.0;
  }
  return multipliers;
}
