// ---
// BattleScheduler: Automates periodic processing of active battles.
// Responsibilities:
//   - Triggers battle rounds at regular intervals
//   - Processes weapon firing using TechFactory.calculateWeaponDamage for centralized damage calculation
//   - Applies damage directly to user defense values via cache
//   - Sends notifications/messages to users about battle events
//   - Resolves battles when they end (winner/loser determination, teleportation)
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - UserCache (for user state access)
//   - MessageCache (for notifications) - injectable via config
//   - TechFactory (for centralized weapon damage calculations)
//   - TimeProvider (for time) - injectable via config
// ---

import { BattleRepo } from './BattleCache';
import type { Battle, BattleEvent, BattleStats } from './battleTypes';
import { DAMAGE_CALC_DEFAULTS } from './battleTypes';
import { TechFactory, TechCounts } from '../techs/TechFactory';
import { getBattleCache } from './BattleCache';
import { BATTLE_LOCK, USER_LOCK, WORLD_LOCK } from '../typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas2, LocksAtMost3, LocksAtMostAndHas4, LocksAtMost4 } from '@markdrei/ironguard-typescript-locks';
import type { BattleSchedulerConfig, TimeProvider } from './battleSchedulerUtils';
import { realTimeProvider, setupBattleScheduler, cancelBattleScheduler } from './battleSchedulerUtils';
import type { MessageCache } from '../messages/MessageCache';
import { WorldCache } from '../world/worldCache';
import { UserCache } from '../user/userCache';
import { ApiError } from '../errors';
import { calculateToroidalDistance } from '@shared/physics';

// ========================================
// Module-level configuration and state
// ========================================

/** Module-level configuration - set via initializeBattleScheduler */
let config: BattleSchedulerConfig | null = null;

/** Scheduler interval handle */
let schedulerInterval: NodeJS.Timeout | null = null;

/** Stored scheduler function for testability */
let schedulerFn: typeof setInterval = setInterval;

/** Stored canceller function for testability */
let cancellerFn: typeof clearInterval = clearInterval;

// ========================================
// Configuration and Lifecycle
// ========================================

/**
 * Initialize the battle scheduler with injectable dependencies
 * Merges provided config with defaults and automatically starts the scheduler
 * 
 * @param cfg - Partial configuration (messageCache is required)
 * @param scheduler - Optional scheduler function (for testing)
 * @param canceller - Optional canceller function (for testing)
 */
export function initializeBattleScheduler(
  cfg: Partial<BattleSchedulerConfig> & { messageCache: MessageCache },
  scheduler: typeof setInterval = setInterval,
  canceller: typeof clearInterval = clearInterval
): void {
  // Merge with defaults
  config = {
    timeProvider: cfg.timeProvider ?? realTimeProvider,
    messageCache: cfg.messageCache,
    defaultCooldown: cfg.defaultCooldown ?? 5,
    schedulerIntervalMs: cfg.schedulerIntervalMs ?? 1000
  };
  
  // Store scheduler/canceller functions
  schedulerFn = scheduler;
  cancellerFn = canceller;
  
  // Start the scheduler automatically
  startBattleScheduler(config.schedulerIntervalMs);
}

/**
 * Reset the battle scheduler (for testing)
 * Stops the scheduler and clears all configuration
 */
export function resetBattleScheduler(): void {
  stopBattleScheduler();
  config = null;
  schedulerFn = setInterval;
  cancellerFn = clearInterval;
}

/**
 * Get the current time provider (exposed for internal use)
 */
function getTimeProvider(): TimeProvider {
  if (!config) {
    // Fallback to real time if not initialized (shouldn't happen in production)
    return realTimeProvider;
  }
  return config.timeProvider;
}

/**
 * Get the current time in seconds
 */
function getCurrentTime(): number {
  return getTimeProvider().now();
}

// ========================================
// Battle Helper Functions
// ========================================

/**
 * Check if a weapon is ready to fire (cooldown expired)
 */
function isWeaponReady(battle: Battle, userId: number, weaponType: string, currentTime: number): boolean {
  const isAttacker = battle.attackerId === userId;
  const cooldowns = isAttacker ? battle.attackerWeaponCooldowns : battle.attackeeWeaponCooldowns;
  const nextReadyTime = cooldowns[weaponType] || 0;
  
  // Cooldown stores "next ready time" - weapon is ready if current time >= that
  return currentTime >= nextReadyTime;
}

/**
 * Get all weapons that are ready to fire for a user
 */
function getReadyWeapons(battle: Battle, userId: number, currentTime: number): string[] {
  const isAttacker = battle.attackerId === userId;
  const stats = isAttacker ? battle.attackerStartStats : battle.attackeeStartStats;
  const readyWeapons: string[] = [];

  for (const [weaponType, weaponData] of Object.entries(stats.weapons)) {
    if (weaponData.count > 0 && isWeaponReady(battle, userId, weaponType, currentTime)) {
      readyWeapons.push(weaponType);
    }
  }

  return readyWeapons;
}

/**
 * Apply pre-calculated damage values directly to user's defenses
 * 
 * CRITICAL: This method applies damage values already calculated by TechFactory.calculateWeaponDamage
 * which accounts for weapon types, defense penetration, and damage distribution.
 */
async function applyDamageWithLock(
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
 * Check if the battle is over (someone's hull reached 0)
 */
async function isBattleOver(battle: Battle, context: LockContext<LocksAtMost3>): Promise<boolean> {
  return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const userWorldCache = UserCache.getInstance2();
    const attacker = await userWorldCache.getUserByIdWithLock(userContext, battle.attackerId);
    const attackee = await userWorldCache.getUserByIdWithLock(userContext, battle.attackeeId);

    if (!attacker || !attackee) {
      throw new Error('Users not found during battle');
    }

    return attacker.hullCurrent <= 0 || attackee.hullCurrent <= 0;
  });
}

/**
 * Get the winner and loser IDs
 */
async function getBattleOutcome(battle: Battle, context: LockContext<LocksAtMost3>): Promise<{ winnerId: number; loserId: number } | null> {
  return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const userWorldCache = UserCache.getInstance2();
    const attacker = await userWorldCache.getUserByIdWithLock(userContext, battle.attackerId);
    const attackee = await userWorldCache.getUserByIdWithLock(userContext, battle.attackeeId);

    if (!attacker || !attackee) {
      throw new Error('Users not found during battle');
    }

    const isOver = attacker.hullCurrent <= 0 || attackee.hullCurrent <= 0;
    if (!isOver) {
      return null;
    }

    if (attacker.hullCurrent <= 0) {
      return {
        winnerId: battle.attackeeId,
        loserId: battle.attackerId
      };
    } else {
      return {
        winnerId: battle.attackerId,
        loserId: battle.attackeeId
      };
    }
  });
}

/**
 * Helper to create a message for a user via MessageCache
 * Uses the injected messageCache from config
 */
async function createMessage(userId: number, message: string): Promise<void> {
  if (!config) {
    console.warn('⚠️ Battle scheduler not initialized, cannot send message');
    return;
  }
  await config.messageCache.createMessage(userId, message);
}



/**
 * Process all active battles automatically  
 * Acquires BATTLE write lock once for all battle processing
 */
export async function processActiveBattles(context: LockContext<LocksAtMostAndHas2>): Promise<void> {
  try {
      const battleCache = getBattleCache();
      // Pass battleContext so getActiveBattles doesn't try to acquire another lock
      const activeBattles = await battleCache.getActiveBattles(context);
      
      if (activeBattles.length === 0) {
        return;
      }
      
      console.log(`⚔️ Processing ${activeBattles.length} active battle(s)...`);
      
      for (const battle of activeBattles) {
        try {
          await processBattleRoundInternal(context, battle.id);
        } catch (error) {
          console.error(`❌ Error processing battle ${battle.id}:`, error);
        }
      }
  } catch (error) {
    console.error('❌ Error processing active battles:', error);
  }
}

/**
 * Process one round for a specific battle
 * Called from processActiveBattles which already holds BATTLE write lock
 */
async function processBattleRoundInternal(context: LockContext<LocksAtMostAndHas2>, battleId: number): Promise<void> {
  const battle = await BattleRepo.getBattle(context, battleId);
  
  if (!battle || battle.battleEndTime) {
    return;
  }
  
  const currentTime = getCurrentTime();
    
    // Get all ready weapons for both players
    const attackerReadyWeapons = getReadyWeapons(battle, battle.attackerId, currentTime);
    const attackeeReadyWeapons = getReadyWeapons(battle, battle.attackeeId, currentTime);
    
    // Process attacker's weapons
    for (const weaponType of attackerReadyWeapons) {
      await fireWeapon(
        context,
        battle,
        battle.attackerId,
        battle.attackeeId,
        weaponType,
        currentTime,
        'attacker'
      );
    }
    
    // Process attackee's weapons
    for (const weaponType of attackeeReadyWeapons) {
      await fireWeapon(
        context,
        battle,
        battle.attackeeId,
        battle.attackerId,
        weaponType,
        currentTime,
        'attackee'
      );
    }
    
    // Check if battle is over after this round
    const updatedBattle = await BattleRepo.getBattle(context, battleId);
    if (updatedBattle) {
      if (await isBattleOver(updatedBattle, context)) {
        const outcome = await getBattleOutcome(updatedBattle, context);
        if (outcome) {
          // Resolve battle (handles endStats snapshotting and teleportation)
          await resolveBattle(context, battleId, outcome.winnerId);
          
          // Send victory/defeat messages
          const winnerId = outcome.winnerId;
          const loserId = outcome.loserId;
          await createMessage(winnerId, `P: 🎉 **Victory!** You won the battle!`);
          await createMessage(loserId, `A: 💀 **Defeat!** You lost the battle and have been teleported away.`);
          
          console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId}`);
        }
      }
    }
}

/**
 * Fire a weapon and apply damage using TechFactory.calculateWeaponDamage
 * 
 * This function uses the centralized damage calculation from TechFactory
 * which properly handles weapon types, defense penetration, and damage distribution.
 */
async function fireWeapon(
  context: LockContext<LocksAtMostAndHas2>,
  battle: Battle,
  attackerId: number,
  defenderId: number,
  weaponType: string,
  currentTime: number,
  actorLabel: 'attacker' | 'attackee'
): Promise<void> {
  const weaponSpec = TechFactory.getWeaponSpec(weaponType);
  
  if (!weaponSpec) {
    console.error(`❌ Unknown weapon type: ${weaponType}`);
    return;
  }
  
  const isAttacker = attackerId === battle.attackerId;
  const attackerStats = isAttacker ? battle.attackerStartStats : battle.attackeeStartStats;
  
  const weaponData = attackerStats.weapons[weaponType];
  if (!weaponData || weaponData.count === 0) {
    return;
  }
  
  const shotsPerSalvo = weaponData.count;
  
  // Use TechFactory.calculateWeaponDamage for centralized damage calculation
  // Acquire USER_LOCK to access user data from cache
  await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const userWorldCache = UserCache.getInstance2();
    const attackerUser = await userWorldCache.getUserByIdWithLock(userContext, attackerId);
    const defenderUser = await userWorldCache.getUserByIdWithLock(userContext, defenderId);
    
    if (!attackerUser || !defenderUser) {
      console.error(`❌ User not found: attacker=${attackerId}, defender=${defenderId}`);
      return;
    }
    
    // Calculate damage using TechFactory with actual defense values and tech counts
    const damageCalc = TechFactory.calculateWeaponDamage(
      weaponType,
      attackerUser.techCounts as TechCounts,
      defenderUser.shieldCurrent,
      defenderUser.armorCurrent,
      DAMAGE_CALC_DEFAULTS.POSITIVE_ACCURACY_MODIFIER,
      DAMAGE_CALC_DEFAULTS.NEGATIVE_ACCURACY_MODIFIER,
      DAMAGE_CALC_DEFAULTS.BASE_DAMAGE_MODIFIER,
      DAMAGE_CALC_DEFAULTS.ECM_EFFECTIVENESS,
      DAMAGE_CALC_DEFAULTS.SPREAD_VALUE
    );
    
    if (damageCalc.weaponsHit === 0) {
      // All shots missed
      const missEvent: BattleEvent = {
        timestamp: currentTime,
        type: 'shot_fired',
        actor: actorLabel,
        data: {
          weaponType,
          shots: shotsPerSalvo,
          hits: 0,
          damage: 0,
          message: `${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s) - all missed!`
        }
      };
      
      await BattleRepo.addBattleEvent(context, battle.id, missEvent);
      
      // Send message to both players
      await createMessage(attackerId, `Your ${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s) but all missed!`);
      await createMessage(defenderId, `A: Enemy ${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s) but all missed!`);
      
      // Update cooldown - set to when weapon will be ready next
      const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
      await BattleRepo.setWeaponCooldown(context, battle.id, attackerId, weaponType, nextReadyTime);
      
      return;
    }
    
    // Apply the pre-calculated damage values to each defense layer
    const damageResult = await applyDamageWithLock(
      userContext,
      defenderId,
      damageCalc.shieldDamage,
      damageCalc.armorDamage,
      damageCalc.hullDamage
    );
    
    // Extract remaining defense values
    const remainingShield = damageResult.remainingShield;
    const remainingArmor = damageResult.remainingArmor;
    const remainingHull = damageResult.remainingHull;
    
    // Track total damage dealt by attacker/attackee
    await BattleRepo.updateTotalDamage(context, battle.id, attackerId, damageCalc.overallDamage);
    
    // Create battle event
    const hitEvent: BattleEvent = {
      timestamp: currentTime,
      type: 'shot_fired',
      actor: actorLabel,
      data: {
        weaponType,
        shots: shotsPerSalvo,
        hits: damageCalc.weaponsHit,
        damage: damageCalc.overallDamage,
        shieldDamage: damageCalc.shieldDamage,
        armorDamage: damageCalc.armorDamage,
        hullDamage: damageCalc.hullDamage,
        message: `${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s), ${damageCalc.weaponsHit} hit for ${damageCalc.overallDamage} damage (Shield: ${damageCalc.shieldDamage}, Armor: ${damageCalc.armorDamage}, Hull: ${damageCalc.hullDamage})`
      }
    };
    
    await BattleRepo.addBattleEvent(context, battle.id, hitEvent);
    
    // Format defense status for messages - ALWAYS show all three defense values
    const defenseStatus = `Hull: ${remainingHull}, Armor: ${remainingArmor}, Shield: ${remainingShield}`;
    
    // Format damage breakdown
    const damageBreakdown = `Shield: ${damageCalc.shieldDamage}, Armor: ${damageCalc.armorDamage}, Hull: ${damageCalc.hullDamage}`;
    
    // Send detailed messages to both players
    const attackerMessage = `P: ⚔️ Your **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${damageCalc.weaponsHit} hit** for **${damageCalc.overallDamage} total damage** (${damageBreakdown})! Enemy remaining: ${defenseStatus}`;
    const defenderMessage = `N: 🛡️ Enemy **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${damageCalc.weaponsHit} hit** you for **${damageCalc.overallDamage} total damage** (${damageBreakdown})! Your remaining: ${defenseStatus}`;
    
    await createMessage(attackerId, attackerMessage);
    await createMessage(defenderId, defenderMessage);
    
    // Update cooldown - set to when weapon will be ready next
    const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
    await BattleRepo.setWeaponCooldown(context, battle.id, attackerId, weaponType, nextReadyTime);
    
    console.log(`⚔️ Battle ${battle.id}: User ${attackerId} ${weaponType} - ${damageCalc.weaponsHit}/${shotsPerSalvo} hits, ${damageCalc.overallDamage} damage`);
  });
}

/**
 * Start the battle scheduler (call from server startup)
 */
export function startBattleScheduler(intervalMs: number = 1000): void {
  if (schedulerInterval) {
    console.log('⚔️ Battle scheduler already running');
    return;
  }
  
  console.log(`⚔️ Starting battle scheduler (interval: ${intervalMs}ms)`);
  
  schedulerInterval = setupBattleScheduler(async () => {
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      await processActiveBattles(battleContext).catch(error => {
        console.error('❌ Battle scheduler error:', error);
      });
    });
  }, intervalMs, schedulerFn);
}

export function stopBattleScheduler(): void {
  if (schedulerInterval) {
    cancelBattleScheduler(schedulerInterval, cancellerFn);
    schedulerInterval = null;
    console.log('⚔️ Battle scheduler stopped');
  }
}

// ========================================
// Battle Resolution (moved from battleService.ts)
// ========================================

/**
 * Get world dimensions
 * World size is 500x500 as defined in src/lib/server/world/world.ts
 * This matches the default in World.createDefault() and worldRepo.ts
 */
function getWorldSize(): { width: number; height: number } {
  // The world size is configured in src/lib/server/world/world.ts
  // and src/lib/server/world/worldRepo.ts with default value { width: 500, height: 500 }
  return { width: 500, height: 500 };
}

/**
 * Calculate minimum teleport distance (world width / 3)
 */
function getMinTeleportDistance(): number {
  const worldSize = getWorldSize();
  return worldSize.width / 3;
}

/**
 * Get ship position from World cache
 */
async function getShipPosition(context: LockContext<LocksAtMost4>, shipId: number): Promise<{ x: number; y: number } | null> {
  const worldCache = WorldCache.getInstance();
  return await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    return ship ? { x: ship.x, y: ship.y } : null;
  });
}

/**
 * Update user battle state via User cache
 */
async function updateUserBattleState(context: LockContext<LocksAtMostAndHas4>, userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
  const userWorldCache = UserCache.getInstance2();
  const user = userWorldCache.getUserByIdFromCache(context, userId);
  if (user) {
    user.inBattle = inBattle;
    user.currentBattleId = battleId;
    userWorldCache.updateUserInCache(context, user);
  }
}

/**
 * Generate random position with minimum distance from a point
 * Uses toroidal distance calculation to consider world wrapping
 */
function generateTeleportPosition(
  fromX: number,
  fromY: number,
  minDistance: number
): { x: number; y: number } {
  const worldSize = getWorldSize();
  let x: number, y: number, distance: number;

  // Try up to 100 times to find a valid position
  for (let i = 0; i < 100; i++) {
    x = Math.random() * worldSize.width;
    y = Math.random() * worldSize.height;
    distance = calculateToroidalDistance(
      { x: fromX, y: fromY },
      { x, y },
      worldSize
    );

    if (distance >= minDistance) {
      return { x, y };
    }
  }

  // Fallback: place at opposite side of the world
  return {
    x: fromX > worldSize.width / 2 ? 0 : worldSize.width - 1,
    y: fromY > worldSize.height / 2 ? 0 : worldSize.height - 1
  };
}

/**
 * Teleport ship to new position via World cache
 */
async function teleportShip(context: LockContext<LocksAtMostAndHas4>, shipId: number, x: number, y: number): Promise<void> {
  const worldCache = WorldCache.getInstance();
  await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    if (ship) {
      ship.x = x;
      ship.y = y;
      ship.speed = 0;
      ship.last_position_update_ms = Date.now();
      worldCache.updateWorldUnsafe(worldContext, world);
    }
  });
}

/**
 * Get user's ship ID from User cache
 */
async function getUserShipId(context: LockContext<LocksAtMostAndHas4>, userId: number): Promise<number> {
  const userWorldCache = UserCache.getInstance2();

  const user = userWorldCache.getUserByIdFromCache(context, userId);
  if (!user || user.ship_id === undefined) {
    throw new Error('User not found or has no ship');
  }
  return user.ship_id;
}

/**
 * Resolve a battle (determine winner and apply consequences)
 * This function handles:
 * - Creating end stats snapshots
 * - Logging battle end event
 * - Ending the battle in database
 * - Clearing battle state for users
 * - Teleporting the loser away
 */
export async function resolveBattle(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  winnerId: number
): Promise<void> {
  const battle = await BattleRepo.getBattle(context, battleId);

  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }

  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }

  const loserId = winnerId === battle.attackerId ? battle.attackeeId : battle.attackerId;

  // Snapshot final defense values from User objects to create endStats
  const userWorldCache = UserCache.getInstance2();
  const [attackerEndStats, attackeeEndStats] = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const attacker = await userWorldCache.getUserByIdWithLock(userContext, battle.attackerId);
    const attackee = await userWorldCache.getUserByIdWithLock(userContext, battle.attackeeId);

    if (!attacker || !attackee) {
      throw new Error('Users not found when resolving battle');
    }

    // Create endStats from current user defense values
    const attackerStats: BattleStats = {
      hull: { current: attacker.hullCurrent, max: attacker.techCounts.ship_hull * 100 },
      armor: { current: attacker.armorCurrent, max: attacker.techCounts.kinetic_armor * 100 },
      shield: { current: attacker.shieldCurrent, max: attacker.techCounts.energy_shield * 100 },
      weapons: battle.attackerStartStats.weapons
    };

    const attackeeStats: BattleStats = {
      hull: { current: attackee.hullCurrent, max: attackee.techCounts.ship_hull * 100 },
      armor: { current: attackee.armorCurrent, max: attackee.techCounts.kinetic_armor * 100 },
      shield: { current: attackee.shieldCurrent, max: attackee.techCounts.energy_shield * 100 },
      weapons: battle.attackeeStartStats.weapons
    };

    return [attackerStats, attackeeStats] as const;
  });

  // Log battle end event BEFORE ending battle
  try {
    const endEvent: BattleEvent = {
      timestamp: getCurrentTime(),
      type: 'battle_ended',
      actor: winnerId === battle.attackerId ? 'attacker' : 'attackee',
      data: {
        message: `Battle ended. Winner: User ${winnerId}`
      }
    };

    await BattleRepo.addBattleEvent(context, battleId, endEvent);
  } catch (error) {
    console.error(`⚠️ Failed to log battle end event for battle ${battleId}:`, error);
    // Continue with battle resolution even if event logging fails
  }

  // End the battle in database (this removes it from cache)
  await BattleRepo.endBattle(
    context,
    battleId,
    winnerId,
    loserId,
    attackerEndStats,
    attackeeEndStats
  );

  await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    // Clear battle state for both users
    await updateUserBattleState(userContext, battle.attackerId, false, null);
    await updateUserBattleState(userContext, battle.attackeeId, false, null);

    // Get ship IDs for teleportation
    const winnerShipId = await getUserShipId(userContext, winnerId);
    const loserShipId = await getUserShipId(userContext, loserId);

    const winnerPos = await getShipPosition(userContext, winnerShipId);

    if (winnerPos) {
      // Teleport loser to random position (minimum distance = world width / 3)
      const minTeleportDistance = getMinTeleportDistance();
      const teleportPos = generateTeleportPosition(
        winnerPos.x,
        winnerPos.y,
        minTeleportDistance
      );

      await teleportShip(userContext, loserShipId, teleportPos.x, teleportPos.y);

      console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId} teleported to (${teleportPos.x.toFixed(0)}, ${teleportPos.y.toFixed(0)})`);
    }
  });
}
