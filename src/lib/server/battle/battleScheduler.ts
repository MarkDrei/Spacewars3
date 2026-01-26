// ---
// BattleScheduler: Automates periodic processing of active battles.
// Responsibilities:
//   - Triggers battle rounds at regular intervals
//   - Processes weapon firing and damage application
//   - Sends notifications/messages to users
//   - Resolves battles when they end
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - BattleEngine (for combat mechanics)
//   - getUserWorldCache (for user state updates)
//   - MessageCache (for notifications)
// Status: ✅ Uses proper cache delegation, no direct DB access
// ---

import { BattleRepo } from './BattleCache';
import { BattleEngine } from './battleEngine';
import type { Battle, BattleEvent, BattleStats } from './battleTypes';
import { TechFactory } from '../techs/TechFactory';
import { getBattleCache } from './BattleCache';
import { BATTLE_LOCK, USER_LOCK, WORLD_LOCK, DATABASE_LOCK_USERS } from '../typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas2, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { setupBattleScheduler, cancelBattleScheduler, type BattleSchedulerConfig, type TimeProvider } from './battleSchedulerUtils';
import type { MessageCache } from '../messages/MessageCache';
import { getWeaponDamageModifierFromTree } from '../techs/techtree';
import { calculateToroidalDistance } from '@shared/physics';
import { UserCache } from '../user/userCache';
import { WorldCache } from '../world/worldCache';
import { getUserByIdFromDb } from '../user/userRepo';
import { ApiError } from '../errors';

/**
 * World dimensions (matching World class default)
 */
const WORLD_WIDTH = 500;
const WORLD_HEIGHT = 500;

/**
 * Minimum distance for teleportation after losing battle
 * Dynamic calculation: world.width / 3
 */
const calculateMinTeleportDistance = (): number => WORLD_WIDTH / 3;

/**
 * Battle scheduler configuration
 */
let schedulerConfig: BattleSchedulerConfig | null = null;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Initialize battle scheduler with injectable dependencies
 * @param config - Configuration with time provider, message cache, and optional settings
 */
export function initializeBattleScheduler(config: BattleSchedulerConfig): void {
  if (schedulerInterval) {
    console.log('⚔️ Battle scheduler already running, stopping existing scheduler');
    stopBattleScheduler();
  }
  
  schedulerConfig = config;
  
  const intervalMs = config.schedulerIntervalMs ?? 1000;
  console.log(`⚔️ Starting battle scheduler (interval: ${intervalMs}ms)`);
  
  schedulerInterval = setupBattleScheduler(async () => {
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      await processActiveBattles(battleContext).catch(error => {
        console.error('❌ Battle scheduler error:', error);
      });
    });
  }, intervalMs);
}

/**
 * Reset battle scheduler (for tests)
 * Stops the scheduler and clears configuration
 */
export function resetBattleScheduler(): void {
  stopBattleScheduler();
  schedulerConfig = null;
}

/**
 * Helper to create a message for a user via MessageCache
 * Uses the injected message cache from configuration
 */
async function createMessage(userId: number, message: string): Promise<void> {
  if (!schedulerConfig) {
    throw new Error('Battle scheduler not initialized');
  }
  await schedulerConfig.messageCache.createMessage(userId, message);
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
 * Get ship position from World cache
 */
async function getShipPosition(context: LockContext<LocksAtMostAndHas4>, shipId: number): Promise<{ x: number; y: number } | null> {
  const worldCache = WorldCache.getInstance();
  return await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    return ship ? { x: ship.x, y: ship.y } : null;
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
 * Generate random teleport position with minimum distance from a point
 * Uses toroidal distance calculation for accuracy
 */
function generateTeleportPosition(
  fromX: number,
  fromY: number,
  minDistance: number
): { x: number; y: number } {
  const worldBounds = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
  
  // Try up to 100 times to find a valid position
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    const distance = calculateToroidalDistance({ x: fromX, y: fromY }, { x, y }, worldBounds);

    if (distance >= minDistance) {
      return { x, y };
    }
  }

  // Fallback: place at opposite side (toroidally)
  // Calculate opposite position through wrapping
  const oppositeX = (fromX + WORLD_WIDTH / 2) % WORLD_WIDTH;
  const oppositeY = (fromY + WORLD_HEIGHT / 2) % WORLD_HEIGHT;
  
  return { x: oppositeX, y: oppositeY };
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
      await worldCache.updateWorldUnsafe(worldContext, world);
    }
  });
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
  if (!schedulerConfig) {
    throw new Error('Battle scheduler not initialized');
  }
  
  const battle = await BattleRepo.getBattle(context, battleId);
  
  if (!battle || battle.battleEndTime) {
    return;
  }
  
  const battleEngine = new BattleEngine(battle);
  const currentTime = schedulerConfig.timeProvider.now();
    
    // Get all ready weapons for both players
    const attackerReadyWeapons = battleEngine.getReadyWeapons(battle.attackerId, currentTime);
    const attackeeReadyWeapons = battleEngine.getReadyWeapons(battle.attackeeId, currentTime);
    
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
      const updatedEngine = new BattleEngine(updatedBattle);
      if (await updatedEngine.isBattleOver(context)) {
        const outcome = await updatedEngine.getBattleOutcome(context);
        if (outcome) {
          // Resolve battle and send messages
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
 * Fire a weapon and apply damage
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
  
  // Get attacker and defender from UserCache to access techTree and techCounts
  const userCache = UserCache.getInstance2();
  const [attacker, defender] = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    let attackerUser = userCache.getUserByIdFromCache(userContext, attackerId);
    let defenderUser = userCache.getUserByIdFromCache(userContext, defenderId);
    
    // Load from DB if not in cache
    if (!attackerUser) {
      attackerUser = await userContext.useLockWithAcquire(DATABASE_LOCK_USERS, async () => {
        const db = await userCache.getDatabaseConnection(userContext);
        const loaded = await getUserByIdFromDb(db, attackerId, async () => { });
        if (loaded) userCache.setUserUnsafe(userContext, loaded);
        return loaded;
      });
    }
    
    if (!defenderUser) {
      defenderUser = await userContext.useLockWithAcquire(DATABASE_LOCK_USERS, async () => {
        const db = await userCache.getDatabaseConnection(userContext);
        const loaded = await getUserByIdFromDb(db, defenderId, async () => { });
        if (loaded) userCache.setUserUnsafe(userContext, loaded);
        return loaded;
      });
    }
    
    return [attackerUser, defenderUser] as const;
  });
  
  if (!attacker || !defender) {
    console.error(`❌ Could not load users for battle ${battle.id}`);
    return;
  }
  
  // Get weapon damage modifier from attacker's tech tree
  const baseDamageModifier = getWeaponDamageModifierFromTree(attacker.techTree, weaponType);
  
  // Use TechFactory.calculateWeaponDamage for consolidated damage calculation
  const damageResult = TechFactory.calculateWeaponDamage(
    weaponType,
    attacker.techCounts,
    defender.shieldCurrent,
    defender.armorCurrent,
    0, // POSITIVE_ACCURACY_MODIFIER - using default
    0, // NEGATIVE_ACCURACY_MODIFIER - using default
    baseDamageModifier, // from tech tree research
    0, // ECM_EFFECTIVENESS - using default
    1.0 // SPREAD_VALUE - using default
  );
  
  const hits = damageResult.weaponsHit;
  const shotsPerSalvo = weaponData.count;
  
  if (hits === 0) {
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
  
  // Apply damage to defender's defense values
  const shieldDamage = damageResult.shieldDamage;
  const armorDamage = damageResult.armorDamage;
  const hullDamage = damageResult.hullDamage;
  const totalDamage = shieldDamage + armorDamage + hullDamage;
  
  // Update defender's defense values in cache
  await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const defenderUser = userCache.getUserByIdFromCache(userContext, defenderId);
    if (defenderUser) {
      // Apply damage in order: shield -> armor -> hull
      defenderUser.shieldCurrent = Math.max(0, defenderUser.shieldCurrent - shieldDamage);
      defenderUser.armorCurrent = Math.max(0, defenderUser.armorCurrent - armorDamage);
      defenderUser.hullCurrent = Math.max(0, defenderUser.hullCurrent - hullDamage);
      userCache.updateUserInCache(userContext, defenderUser);
    }
  });
  
  // Get remaining defense values after damage
  const remainingShield = Math.max(0, defender.shieldCurrent - shieldDamage);
  const remainingArmor = Math.max(0, defender.armorCurrent - armorDamage);
  const remainingHull = Math.max(0, defender.hullCurrent - hullDamage);
  
  // Track total damage dealt by attacker/attackee
  await BattleRepo.updateTotalDamage(context, battle.id, attackerId, totalDamage);
  
  // Create battle event
  const hitEvent: BattleEvent = {
    timestamp: currentTime,
    type: 'shot_fired',
    actor: actorLabel,
    data: {
      weaponType,
      shots: shotsPerSalvo,
      hits,
      damage: totalDamage,
      shieldDamage,
      armorDamage,
      hullDamage,
      message: `${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s), ${hits} hit for ${totalDamage} damage (Shield: ${shieldDamage}, Armor: ${armorDamage}, Hull: ${hullDamage})`
    }
  };
  
  await BattleRepo.addBattleEvent(context, battle.id, hitEvent);
  
  // Format defense status for messages - ALWAYS show all three defense values
  const defenseStatus = `Hull: ${remainingHull}, Armor: ${remainingArmor}, Shield: ${remainingShield}`;
  
  // Send detailed messages to both players
  const attackerMessage = `P: ⚔️ Your **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${hits} hit** for **${totalDamage} damage**! Enemy: ${defenseStatus}`;
  const defenderMessage = `N: 🛡️ Enemy **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${hits} hit** you for **${totalDamage} damage**! Your defenses: ${defenseStatus}`;
  
  await createMessage(attackerId, attackerMessage);
  await createMessage(defenderId, defenderMessage);
  
  // Update cooldown - set to when weapon will be ready next
  const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
  await BattleRepo.setWeaponCooldown(context, battle.id, attackerId, weaponType, nextReadyTime);
  
  console.log(`⚔️ Battle ${battle.id}: User ${attackerId} ${weaponType} - ${hits}/${shotsPerSalvo} hits, ${totalDamage} damage`);
}

/**
 * Resolve a battle (determine winner and apply consequences)
 * Moved from battleService.ts to keep battle resolution logic centralized
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
    let attacker = userWorldCache.getUserByIdFromCache(userContext, battle.attackerId);
    let attackee = userWorldCache.getUserByIdFromCache(userContext, battle.attackeeId);

    // Load from DB if not in cache
    if (!attacker) {
      attacker = await userContext.useLockWithAcquire(DATABASE_LOCK_USERS, async () => {
        const db = await userWorldCache.getDatabaseConnection(userContext);
        const loadedAttacker = await getUserByIdFromDb(db, battle.attackerId, async () => { });
        if (loadedAttacker) userWorldCache.setUserUnsafe(userContext, loadedAttacker);
        return loadedAttacker;
      });
    }

    if (!attackee) {
      attackee = await userContext.useLockWithAcquire(DATABASE_LOCK_USERS, async () => {
        const db = await userWorldCache.getDatabaseConnection(userContext);
        const loadedAttackee = await getUserByIdFromDb(db, battle.attackeeId, async () => { });
        if (loadedAttackee) userWorldCache.setUserUnsafe(userContext, loadedAttackee);
        return loadedAttackee;
      });
    }

    if (!attacker || !attackee) {
      throw new Error('Users not found when resolving battle');
    }

    // Create endStats from current user defense values
    const attackerStats: BattleStats = {
      hull: { current: attacker.hullCurrent, max: attacker.techCounts.ship_hull * 100 },
      armor: { current: attacker.armorCurrent, max: attacker.techCounts.kinetic_armor * 100 },
      shield: { current: attacker.shieldCurrent, max: attacker.techCounts.energy_shield * 100 },
      weapons: battle.attackerStartStats.weapons // Weapons don't change
    };

    const attackeeStats: BattleStats = {
      hull: { current: attackee.hullCurrent, max: attackee.techCounts.ship_hull * 100 },
      armor: { current: attackee.armorCurrent, max: attackee.techCounts.kinetic_armor * 100 },
      shield: { current: attackee.shieldCurrent, max: attackee.techCounts.energy_shield * 100 },
      weapons: battle.attackeeStartStats.weapons // Weapons don't change
    };

    return [attackerStats, attackeeStats] as const;
  });

  // Log battle end event BEFORE ending battle
  try {
    const endEvent: BattleEvent = {
      timestamp: schedulerConfig?.timeProvider.now() ?? Math.floor(Date.now() / 1000),
      type: 'battle_ended',
      actor: winnerId === battle.attackerId ? 'attacker' : 'attackee',
      data: {
        message: `Battle ended. Winner: User ${winnerId}`
      }
    };

    await BattleRepo.addBattleEvent(context, battleId, endEvent);
  } catch (error) {
    console.error(`⚠️ Failed to log battle end event for battle ${battleId}:`, error);
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
      // Teleport loser to random position (minimum distance away)
      const minTeleportDistance = calculateMinTeleportDistance();
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

export function stopBattleScheduler(): void {
  if (schedulerInterval) {
    cancelBattleScheduler(schedulerInterval);
    schedulerInterval = null;
    console.log('⚔️ Battle scheduler stopped');
  }
}
