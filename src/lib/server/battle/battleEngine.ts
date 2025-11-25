// ---
// BattleEngine: Encapsulates pure domain battle mechanics and calculations.
// Responsibilities:
//   - Executes combat turns, damage calculations, cooldown logic, and determines battle outcome.
//   - Updates user defense values through cache manager (proper delegation)
//   - Remains stateless (operates on Battle object passed in constructor)
// Main interaction partners:
//   - BattleService (for orchestration)
//   - getUserWorldCache (for updating user defense values)
// Status: ✅ Properly delegates user state updates to cache manager
// ---

import type { Battle, BattleStats, BattleEvent } from './battleTypes';
import { TechFactory } from '../techs/TechFactory';
import { LockContext } from '@markdrei/ironguard-typescript-locks';
import { LocksAtMost3, LocksAtMostAndHas2, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks/dist/core/ironGuardTypes';
import { USER_LOCK } from '../typedLocks';

import { UserCache } from '../user/userCache';
import { TechService } from '../techs/TechService';
import { TechTree, createInitialTechTree } from '../techs/techtree';
import { TechCounts } from '../techs/TechFactory';

/**
 * Battle class - Encapsulates battle state and combat mechanics
 * 
 * ARCHITECTURE:
 * - startStats and endStats are "write once" snapshots (beginning and end of battle)
 * - During battle, we read/update actual User defense values from TypedCacheManager
 * - This ensures defense values persist correctly through cache system
 */
export class BattleEngine {
  private battle: Battle;

  constructor(battle: Battle) {
    this.battle = battle;
  }

  /**
   * Get the battle state
   */
  getBattle(): Battle {
    return this.battle;
  }

  /**
   * Check if a weapon is ready to fire (cooldown expired)
   */
  isWeaponReady(userId: number, weaponType: string, currentTime: number): boolean {
    const isAttacker = this.battle.attackerId === userId;
    const cooldowns = isAttacker ? this.battle.attackerWeaponCooldowns : this.battle.attackeeWeaponCooldowns;

    const nextReadyTime = cooldowns[weaponType] || 0;

    // Cooldown stores "next ready time" - weapon is ready if current time >= that
    return currentTime >= nextReadyTime;
  }

  /**
   * Get all weapons that are ready to fire for a user
   */
  getReadyWeapons(userId: number, currentTime: number): string[] {
    const isAttacker = this.battle.attackerId === userId;
    const stats = isAttacker ? this.battle.attackerStartStats : this.battle.attackeeStartStats;

    const readyWeapons: string[] = [];

    for (const [weaponType, weaponData] of Object.entries(stats.weapons)) {
      if (weaponData.count > 0 && this.isWeaponReady(userId, weaponType, currentTime)) {
        readyWeapons.push(weaponType);
      }
    }

    return readyWeapons;
  }

  /**
   * Determine which weapon fires next (shortest remaining cooldown)
   * Returns: { userId, weaponType, timeUntilReady }
   */
  getNextWeaponToFire(currentTime: number): {
    userId: number;
    weaponType: string;
    timeUntilReady: number;
  } | null {
    let nextShot: { userId: number; weaponType: string; timeUntilReady: number } | null = null;
    let shortestWait = Infinity;

    // Check attacker's weapons
    const attackerReadyWeapons = this.getReadyWeapons(this.battle.attackerId, currentTime);
    if (attackerReadyWeapons.length > 0) {
      // Attacker has weapons ready now
      return {
        userId: this.battle.attackerId,
        weaponType: attackerReadyWeapons[0], // Pick first ready weapon

        timeUntilReady: 0
      };
    }

    // Check attackee's weapons
    const attackeeReadyWeapons = this.getReadyWeapons(this.battle.attackeeId, currentTime);
    if (attackeeReadyWeapons.length > 0) {
      // Attackee has weapons ready now
      return {
        userId: this.battle.attackeeId,
        weaponType: attackeeReadyWeapons[0],
        timeUntilReady: 0
      };
    }

    // No weapons ready now, find the next one to become ready
    for (const userId of [this.battle.attackerId, this.battle.attackeeId]) {
      const isAttacker = userId === this.battle.attackerId;
      const stats = isAttacker ? this.battle.attackerStartStats : this.battle.attackeeStartStats;
      const cooldowns = isAttacker ? this.battle.attackerWeaponCooldowns : this.battle.attackeeWeaponCooldowns;

      for (const [weaponType, weaponData] of Object.entries(stats.weapons)) {
        if (weaponData.count === 0) continue;

        const lastFired = cooldowns[weaponType] || 0;
        const weaponSpec = TechFactory.getWeaponSpec(weaponType);
        if (!weaponSpec) continue;

        const cooldownPeriod = weaponSpec.cooldown || 5;
        const readyAt = lastFired + cooldownPeriod;
        const timeUntilReady = readyAt - currentTime;

        if (timeUntilReady < shortestWait) {
          shortestWait = timeUntilReady;
          nextShot = { userId, weaponType, timeUntilReady };
        }
      }
    }

    return nextShot;
  }

  /**
   * Fire a weapon and update cooldown
   */
  updateWeaponCooldown(userId: number, weaponType: string, currentTime: number): void {
    const isAttacker = this.battle.attackerId === userId;
    const cooldowns = isAttacker ? this.battle.attackerWeaponCooldowns : this.battle.attackeeWeaponCooldowns;

    // Update cooldown
    cooldowns[weaponType] = currentTime;

    if (isAttacker) {
      this.battle.attackerWeaponCooldowns = cooldowns;
    } else {
      this.battle.attackeeWeaponCooldowns = cooldowns;
    }
  }

  /**
   * Apply pre-calculated damage values directly to user's defenses
   * 
   * CRITICAL: This method applies damage values already calculated by TechFactory.calculateWeaponDamage
   * which accounts for weapon types, defense penetration, and damage distribution.
   * startStats and endStats are NOT modified here - they are write-once snapshots.
   */
  async applyDamageWithLock(
    context: LockContext<LocksAtMostAndHas4>,
    targetUserId: number,
    shieldDamage: number,
    armorDamage: number,
    hullDamage: number
  ): Promise<{
    remainingShield: number;
    remainingArmor: number;
    remainingHull: number;
  }> {
    const userWorldCache = UserCache.getInstance2();
    const user = await userWorldCache.getUserByIdWithLock(context, targetUserId);

    if (!user) {
      throw new Error(`User ${targetUserId} not found during battle`);
    }

    // Apply pre-calculated damage to each defense layer
    user.shieldCurrent = Math.max(0, user.shieldCurrent - shieldDamage);
    user.armorCurrent = Math.max(0, user.armorCurrent - armorDamage);
    user.hullCurrent = Math.max(0, user.hullCurrent - hullDamage);

    // Update user in cache (marks as dirty for persistence)
    userWorldCache.updateUserInCache(context, user);

    return {
      remainingShield: user.shieldCurrent,
      remainingArmor: user.armorCurrent,
      remainingHull: user.hullCurrent
    };
  }

  /**
   * Apply damage to a target's defenses (legacy method - no longer used)
   * Uses simple waterfall logic: shield → armor → hull
   * 
   * NOTE: This method is deprecated. Both battleEngine.executeTurn and 
   * battleScheduler.fireWeapon now use TechFactory.calculateWeaponDamage + applyDamageWithLock.
   * This method is kept for backward compatibility with any external code that may depend on it.
   * @deprecated Use TechFactory.calculateWeaponDamage + applyDamageWithLock directly.
   */
  async applyDamage(
    context: LockContext<LocksAtMost3>,
    targetUserId: number,
    totalDamage: number
  ): Promise<{
    shieldDamage: number;
    armorDamage: number;
    hullDamage: number;
    remainingShield: number;
    remainingArmor: number;
    remainingHull: number;
  }> {
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const userWorldCache = UserCache.getInstance2();
      const user = await userWorldCache.getUserByIdWithLock(userContext, targetUserId);

      if (!user) {
        throw new Error(`User ${targetUserId} not found during battle`);
      }

      let remainingDamage = totalDamage;
      let shieldDamage = 0;
      let armorDamage = 0;
      let hullDamage = 0;

      // 1. Apply to shield first
      if (user.shieldCurrent > 0 && remainingDamage > 0) {
        shieldDamage = Math.min(remainingDamage, user.shieldCurrent);
        remainingDamage -= shieldDamage;
      }

      // 2. Apply to armor second
      if (user.armorCurrent > 0 && remainingDamage > 0) {
        armorDamage = Math.min(remainingDamage, user.armorCurrent);
        remainingDamage -= armorDamage;
      }

      // 3. Apply to hull last
      if (user.hullCurrent > 0 && remainingDamage > 0) {
        hullDamage = Math.min(remainingDamage, user.hullCurrent);
        remainingDamage -= hullDamage;
      }

      // Apply the calculated damage
      const result = await this.applyDamageWithLock(userContext, targetUserId, shieldDamage, armorDamage, hullDamage);

      return {
        shieldDamage,
        armorDamage,
        hullDamage,
        remainingShield: result.remainingShield,
        remainingArmor: result.remainingArmor,
        remainingHull: result.remainingHull
      };
    });
  }

  /**
   * Check if the battle is over (someone's hull reached 0)
   * Checks actual User defense values from cache, not battle stats
   */
  async isBattleOver(context: LockContext<LocksAtMost3>): Promise<boolean> {
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return this.isBattleOverWithLock(userContext);
    });
  }

  async isBattleOverWithLock(context: LockContext<LocksAtMostAndHas4>): Promise<boolean> {
    const userWorldCache = UserCache.getInstance2();
    const attacker = await userWorldCache.getUserByIdWithLock(context, this.battle.attackerId);
    const attackee = await userWorldCache.getUserByIdWithLock(context, this.battle.attackeeId);

    if (!attacker || !attackee) {
      throw new Error('Users not found during battle');
    }

    return attacker.hullCurrent <= 0 || attackee.hullCurrent <= 0;
  }

  /**
   * Get the winner and loser IDs
   * Checks actual User defense values from cache
   */
  async getBattleOutcome(context: LockContext<LocksAtMost3>): Promise<{ winnerId: number; loserId: number } | null> {
    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const isOver = await this.isBattleOverWithLock(userContext);
      if (!isOver) {
        return null;
      }

      const userWorldCache = UserCache.getInstance2();
      const attacker = await userWorldCache.getUserByIdWithLock(userContext, this.battle.attackerId);
      const attackee = await userWorldCache.getUserByIdWithLock(userContext, this.battle.attackeeId);

      if (!attacker || !attackee) {
        throw new Error('Users not found during battle');
      }

      if (attacker.hullCurrent <= 0) {
        return {
          winnerId: this.battle.attackeeId,
          loserId: this.battle.attackerId
        };
      } else {
        return {
          winnerId: this.battle.attackerId,
          loserId: this.battle.attackeeId
        };
      }

    });
  }

  /**
   * Create a battle event for logging
   */
  createBattleEvent(
    type: BattleEvent['type'],
    actor: 'attacker' | 'attackee',
    data: BattleEvent['data']
  ): BattleEvent {
    return {
      timestamp: Math.floor(Date.now() / 1000),
      type,
      actor,
      data
    };
  }

  /**
   * Execute a single combat turn (one weapon fires)
   * Returns the event generated from this turn
   */
  async executeTurn(context: LockContext<LocksAtMostAndHas2>, currentTime: number): Promise<BattleEvent | null> {
    // Find next weapon ready to fire
    const nextShot = this.getNextWeaponToFire(currentTime);
    if (!nextShot || nextShot.timeUntilReady > 0) {
      return null; // No weapon ready to fire yet
    }

    const { userId, weaponType } = nextShot;
    const isAttacker = userId === this.battle.attackerId;
    const actor = isAttacker ? 'attacker' : 'attackee';
    const targetUserId = isAttacker ? this.battle.attackeeId : this.battle.attackerId;
    const targetActor = isAttacker ? 'attackee' : 'attacker';

    // Get weapon stats
    const stats = isAttacker ? this.battle.attackerStartStats : this.battle.attackeeStartStats;
    const weaponData = stats.weapons[weaponType];
    if (!weaponData || weaponData.count === 0) {
      return null; // Weapon no longer available
    }

    return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Get attacker and target users for tech counts and defense values
      const userWorldCache = UserCache.getInstance2();
      const attackerUser = await userWorldCache.getUserByIdWithLock(userContext, userId);
      const targetUser = await userWorldCache.getUserByIdWithLock(userContext, targetUserId);

      if (!attackerUser || !targetUser) {
        throw new Error('User not found during battle');
      }

      // Calculate damage using TechFactory with actual defense values and tech counts
      const damageCalc = TechFactory.calculateWeaponDamage(
        weaponType,
        attackerUser.techCounts as TechCounts,
        targetUser.shieldCurrent,
        targetUser.armorCurrent,
        0, // positiveAccuracyModifier - hardcoded for now
        0, // negativeAccuracyModifier - hardcoded for now
        1.0, // baseDamageModifier - hardcoded for now
        0, // ecmEffectiveness - hardcoded for now
        1.0 // spreadValue - hardcoded for now
      );

      // Apply the pre-calculated damage values to each defense layer
      const damageResult = await this.applyDamageWithLock(
        userContext,
        targetUserId,
        damageCalc.shieldDamage,
        damageCalc.armorDamage,
        damageCalc.hullDamage
      );

      // Track total damage dealt by attacker/attackee
      if (isAttacker) {
        this.battle.attackerTotalDamage += damageCalc.overallDamage;
      } else {
        this.battle.attackeeTotalDamage += damageCalc.overallDamage;
      }

      // Fire the weapon (update cooldown)
      this.updateWeaponCooldown(userId, weaponType, currentTime);

      // Determine primary target defense layer (for event reporting)
      let targetDefense: 'shield' | 'armor' | 'hull' = 'hull';
      if (damageCalc.shieldDamage > 0) {
        targetDefense = 'shield';
      } else if (damageCalc.armorDamage > 0) {
        targetDefense = 'armor';
      }

      const event = this.createBattleEvent('damage_dealt', actor, {
        weaponType,
        damageDealt: damageCalc.overallDamage,
        targetDefense,
        remainingValue: damageResult.remainingHull,
        shieldDamage: damageCalc.shieldDamage,
        armorDamage: damageCalc.armorDamage,
        hullDamage: damageCalc.hullDamage,
        message: `${actor} fired ${weaponType} (${damageCalc.weaponsHit} hits): ${damageCalc.shieldDamage} shield, ${damageCalc.armorDamage} armor, ${damageCalc.hullDamage} hull damage`
      });

      // Add event to battle log
      this.battle.battleLog.push(event);

      // Check for defense layer destruction using the remaining values
      if (damageCalc.shieldDamage > 0 && damageResult.remainingShield === 0) {
        const shieldBrokenEvent = this.createBattleEvent('shield_broken', targetActor, {
          message: `${targetActor}'s shield has been destroyed!`
        });
        this.battle.battleLog.push(shieldBrokenEvent);
      }

      if (damageCalc.armorDamage > 0 && damageResult.remainingArmor === 0) {
        const armorBrokenEvent = this.createBattleEvent('armor_broken', targetActor, {
          message: `${targetActor}'s armor has been destroyed!`
        });
        this.battle.battleLog.push(armorBrokenEvent);
      }

      // Check for hull destruction (battle over)
      if (damageResult.remainingHull <= 0) {
        const hullDestroyedEvent = this.createBattleEvent('hull_destroyed', targetActor, {
          message: `${targetActor}'s hull has been destroyed! Battle over.`
        });
        this.battle.battleLog.push(hullDestroyedEvent);
      }
      return event;
    });
  }

  /**
   * Process battle until a weapon is ready or battle ends
   * Returns the list of events that occurred
   */
  async processBattleUntilNextShot(context: LockContext<LocksAtMostAndHas2>, maxTurns: number = 100): Promise<BattleEvent[]> {
    const events: BattleEvent[] = [];
    let turns = 0;
    const currentTime = Math.floor(Date.now() / 1000);

    while (turns < maxTurns && !(await this.isBattleOver(context))) {
      const event = await this.executeTurn(context, currentTime + turns);

      if (!event) {
        // No weapon ready, would need to wait
        break;
      }

      events.push(event);
      turns++;

      if (await this.isBattleOver(context)) {
        break;
      }
    }

    return events;
  }
}

/**
 * Helper function to create initial battle stats from user tech counts
 */
export function createBattleStats(
  techCounts: { [key: string]: number },
  techTree: TechTree = createInitialTechTree()
): BattleStats {
  const stats: BattleStats = {
    hull: { current: 0, max: 0 },
    armor: { current: 0, max: 0 },
    shield: { current: 0, max: 0 },
    weapons: {}
  };

  // Calculate defense values
  const maxStats = TechService.calculateMaxDefense(techCounts as unknown as TechCounts, techTree);

  stats.hull.max = maxStats.hull;
  stats.hull.current = stats.hull.max; // Start at full health

  stats.armor.max = maxStats.armor;
  stats.armor.current = stats.armor.max;

  stats.shield.max = maxStats.shield;
  stats.shield.current = stats.shield.max;

  // Add weapons
  const weaponTypes = [
    'pulse_laser',
    'auto_turret',
    'plasma_lance',
    'gauss_rifle',
    'photon_torpedo',
    'rocket_launcher'
  ];

  for (const weaponType of weaponTypes) {
    const count = techCounts[weaponType] || 0;
    if (count > 0) {
      const weaponSpec = TechFactory.getWeaponSpec(weaponType);
      if (weaponSpec) {
        stats.weapons[weaponType] = {
          count,
          damage: weaponSpec.damage || 10,
          cooldown: weaponSpec.cooldown || 5
        };
      }
    }
  }

  return stats;
}
