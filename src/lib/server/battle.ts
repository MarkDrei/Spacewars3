// ---
// BattleEngine: Encapsulates pure domain battle mechanics and calculations.
// Responsibilities:
//   - Executes combat turns, damage calculations, cooldown logic, and determines battle outcome.
//   - Remains stateless and pure, with no direct persistence or orchestration.
// Main interaction partners:
//   - BattleService (for orchestration)
//   - BattleRepository/BattleCacheManager (for state access)
// Responsibilities to move:
//   - Any cache/database or user/world state updates should move to BattleService or repository/cache managers.
// ---

import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from '../../shared/battleTypes';
import { TechFactory } from './TechFactory';
import { getTypedCacheManager } from './typedCacheManager';
import { createLockContext } from './typedLocks';
import type { User } from './user';

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
  fireWeapon(userId: number, weaponType: string, currentTime: number): void {
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
   * Calculate damage dealt by a weapon
   */
  calculateDamage(weaponType: string, weaponCount: number): number {
    const weaponSpec = TechFactory.getWeaponSpec(weaponType);
    if (!weaponSpec) {
      return 0;
    }

    const baseDamage = weaponSpec.damage || 10; // Default damage if not specified
    return baseDamage * weaponCount;
  }

  /**
   * Apply damage to a target's defenses (shield → armor → hull)
   * Returns the amount of damage actually dealt to each layer
   * 
   * CRITICAL: This method reads and updates User defense values from TypedCacheManager
   * startStats and endStats are NOT modified here - they are write-once snapshots
   */
  async applyDamage(
    targetUserId: number,
    totalDamage: number
  ): Promise<{
    shieldDamage: number;
    armorDamage: number;
    hullDamage: number;
    remainingHull: number;
  }> {
    // Load user from cache to get current defense values
    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    
    try {
      let user = cacheManager.getUserUnsafe(targetUserId, userCtx);
      if (!user) {
        // Load from DB if not in cache
        const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
        try {
          user = await cacheManager.loadUserFromDbUnsafe(targetUserId, dbCtx);
          if (user) {
            cacheManager.setUserUnsafe(user, userCtx);
          }
        } finally {
          dbCtx.dispose();
        }
      }
      
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
        user.shieldCurrent -= shieldDamage;
        remainingDamage -= shieldDamage;
      }

      // 2. Apply to armor second
      if (user.armorCurrent > 0 && remainingDamage > 0) {
        armorDamage = Math.min(remainingDamage, user.armorCurrent);
        user.armorCurrent -= armorDamage;
        remainingDamage -= armorDamage;
      }

      // 3. Apply to hull last
      if (user.hullCurrent > 0 && remainingDamage > 0) {
        hullDamage = Math.min(remainingDamage, user.hullCurrent);
        user.hullCurrent -= hullDamage;
        remainingDamage -= hullDamage;
      }

      // Update user in cache (marks as dirty for persistence)
      cacheManager.updateUserUnsafe(user, userCtx);

      return {
        shieldDamage,
        armorDamage,
        hullDamage,
        remainingHull: user.hullCurrent
      };
    } finally {
      userCtx.dispose();
    }
  }

  /**
   * Check if the battle is over (someone's hull reached 0)
   * Checks actual User defense values from cache, not battle stats
   */
  async isBattleOver(): Promise<boolean> {
    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    
    try {
      const attacker = await this.getUserFromCache(this.battle.attackerId, cacheManager, userCtx);
      const attackee = await this.getUserFromCache(this.battle.attackeeId, cacheManager, userCtx);
      
      if (!attacker || !attackee) {
        throw new Error('Users not found during battle');
      }
      
      return attacker.hullCurrent <= 0 || attackee.hullCurrent <= 0;
    } finally {
      userCtx.dispose();
    }
  }
  
  /**
   * Helper to get user from cache (loads from DB if needed)
   */
  private async getUserFromCache(
    userId: number,
    cacheManager: ReturnType<typeof getTypedCacheManager>,
    userCtx: import('./typedCacheManager').UserContext
  ): Promise<User | null> {
    let user = cacheManager.getUserUnsafe(userId, userCtx);
    if (!user) {
      const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
      try {
        user = await cacheManager.loadUserFromDbUnsafe(userId, dbCtx);
        if (user) {
          cacheManager.setUserUnsafe(user, userCtx);
        }
      } finally {
        dbCtx.dispose();
      }
    }
    return user;
  }

  /**
   * Get the winner and loser IDs
   * Checks actual User defense values from cache
   */
  async getBattleOutcome(): Promise<{ winnerId: number; loserId: number } | null> {
    const isOver = await this.isBattleOver();
    if (!isOver) {
      return null;
    }

    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    
    try {
      const attacker = await this.getUserFromCache(this.battle.attackerId, cacheManager, userCtx);
      const attackee = await this.getUserFromCache(this.battle.attackeeId, cacheManager, userCtx);
      
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
    } finally {
      userCtx.dispose();
    }
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
  async executeTurn(currentTime: number): Promise<BattleEvent | null> {
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

    // Calculate and apply damage
    const totalDamage = this.calculateDamage(weaponType, weaponData.count);
    const damageResult = await this.applyDamage(targetUserId, totalDamage);

    // Track total damage dealt by attacker/attackee
    if (isAttacker) {
      this.battle.attackerTotalDamage += totalDamage;
    } else {
      this.battle.attackeeTotalDamage += totalDamage;
    }

    // Fire the weapon (update cooldown)
    this.fireWeapon(userId, weaponType, currentTime);

    // Create damage event
    let targetDefense: 'shield' | 'armor' | 'hull' = 'shield';
    let damageDealt = damageResult.shieldDamage;
    
    if (damageResult.shieldDamage > 0) {
      targetDefense = 'shield';
      damageDealt = damageResult.shieldDamage;
    } else if (damageResult.armorDamage > 0) {
      targetDefense = 'armor';
      damageDealt = damageResult.armorDamage;
    } else if (damageResult.hullDamage > 0) {
      targetDefense = 'hull';
      damageDealt = damageResult.hullDamage;
    }

    const event = this.createBattleEvent('damage_dealt', actor, {
      weaponType,
      damageDealt: totalDamage,
      targetDefense,
      remainingValue: damageResult.remainingHull,
      message: `${actor} fired ${weaponType} dealing ${totalDamage} damage to ${targetActor}'s ${targetDefense}`
    });

    // Add event to battle log
    this.battle.battleLog.push(event);

    // Check for defense layer destruction by reading current user values
    const cacheManager = getTypedCacheManager();
    const ctx = createLockContext();
    const userCtx = await cacheManager.acquireUserLock(ctx);
    
    try {
      const targetUser = await this.getUserFromCache(targetUserId, cacheManager, userCtx);
      
      if (targetUser) {
        if (damageResult.shieldDamage > 0 && targetUser.shieldCurrent === 0) {
          const shieldBrokenEvent = this.createBattleEvent('shield_broken', targetActor, {
            message: `${targetActor}'s shield has been destroyed!`
          });
          this.battle.battleLog.push(shieldBrokenEvent);
        }

        if (damageResult.armorDamage > 0 && targetUser.armorCurrent === 0) {
          const armorBrokenEvent = this.createBattleEvent('armor_broken', targetActor, {
            message: `${targetActor}'s armor has been destroyed!`
          });
          this.battle.battleLog.push(armorBrokenEvent);
        }

        // Check for hull destruction (battle over)
        if (targetUser.hullCurrent <= 0) {
          const hullDestroyedEvent = this.createBattleEvent('hull_destroyed', targetActor, {
            message: `${targetActor}'s hull has been destroyed! Battle over.`
          });
          this.battle.battleLog.push(hullDestroyedEvent);
        }
      }
    } finally {
      userCtx.dispose();
    }

    return event;
  }

  /**
   * Process battle until a weapon is ready or battle ends
   * Returns the list of events that occurred
   */
  async processBattleUntilNextShot(maxTurns: number = 100): Promise<BattleEvent[]> {
    const events: BattleEvent[] = [];
    let turns = 0;
    const currentTime = Math.floor(Date.now() / 1000);

    while (turns < maxTurns && !(await this.isBattleOver())) {
      const event = await this.executeTurn(currentTime + turns);
      
      if (!event) {
        // No weapon ready, would need to wait
        break;
      }

      events.push(event);
      turns++;

      if (await this.isBattleOver()) {
        break;
      }
    }

    return events;
  }
}

/**
 * Helper function to create initial battle stats from user tech counts
 */
export function createBattleStats(techCounts: {
  [key: string]: number;
}): BattleStats {
  const stats: BattleStats = {
    hull: { current: 0, max: 0 },
    armor: { current: 0, max: 0 },
    shield: { current: 0, max: 0 },
    weapons: {}
  };

  // Calculate defense values
  const hullCount = techCounts.ship_hull || 0;
  const armorCount = techCounts.kinetic_armor || 0;
  const shieldCount = techCounts.energy_shield || 0;

  stats.hull.max = hullCount * 100;
  stats.hull.current = stats.hull.max; // Start at full health

  stats.armor.max = armorCount * 100;
  stats.armor.current = stats.armor.max;

  stats.shield.max = shieldCount * 100;
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
