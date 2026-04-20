// ---
// BattleService: High-level orchestration of battle lifecycle.
// Responsibilities:
//   - Initiate battles (initiateBattle)
//   - Update battles (updateBattle - process combat rounds)
//   - Resolve battles (resolveBattle - determine winner, apply consequences)
//   - Coordinate between BattleCache, BattleScheduler, and User/World caches
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - BattleScheduler (for automated battle processing)
//   - getUserWorldCache (for user state updates)
//   - World cache (for ship positioning and teleportation)
// Status: ✅ Proper orchestration layer, uses cache delegation
// Note: Has helper functions (updateUserBattleState, getShipPosition, etc.)
//       These are used in battle initiation and resolution contexts.
// ---

import { BattleRepo } from './BattleCache';
import type { Battle, BattleStats, BattleEvent, WeaponCooldowns } from './battleTypes';
import type { User } from '../user/user';
import { TechFactory } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { ApiError } from '../errors';
import { UserCache } from '../user/userCache';
import { getBattleCache } from './BattleCache';
import { HasLock2Context, IronLocks, LockContext, LocksAtMost4, LocksAtMostAndHas2, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { WORLD_LOCK, USER_LOCK } from '../typedLocks';
import { WorldCache } from '../world/worldCache';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';
import { sendMessageToUser } from '../messages/MessageCache';
import { StatisticsCache } from '../statistics/StatisticsCache';
import { isNpcId } from '../npc/npcConstants';
import { NPCManager } from '../npc/NPCManager';
import { calculateNpcIronReward, removeNpcSpaceObject } from '../npc/npcCombat';

/**
 * Calculate XP awarded to the winner of a battle based on level difference.
 * Formula:
 * - baseXp = winnerLevel * 200
 * - If loserLevel > winnerLevel: xp = baseXp * (1.3 ^ levelDiff)
 * - If loserLevel < winnerLevel: xp = baseXp * (0.7 ^ abs(levelDiff))
 * - If same level: xp = baseXp
 *
 * @param winnerLevel The level of the battle winner
 * @param loserLevel The level of the battle loser
 * @returns XP to award (floored to integer)
 */
export function calculateBattleXp(winnerLevel: number, loserLevel: number): number {
  const baseXp = winnerLevel * 200;
  const levelDiff = loserLevel - winnerLevel;

  let xp: number;
  if (levelDiff > 0) {
    xp = baseXp * Math.pow(1.3, levelDiff);
  } else if (levelDiff < 0) {
    xp = baseXp * Math.pow(0.7, Math.abs(levelDiff));
  } else {
    xp = baseXp;
  }

  return Math.floor(xp);
}

/**
 * Maximum distance to initiate battle (same as collection distance)
 */
const BATTLE_RANGE = 100;

/**
 * Minimum distance for teleportation after losing battle
 */
const MIN_TELEPORT_DISTANCE = 1000;

/**
 * Get current defense values for a user
 */
function getUserDefenseStats(user: User): { hull: number; armor: number; shield: number } {
  return {
    hull: user.hullCurrent,
    armor: user.armorCurrent,
    shield: user.shieldCurrent
  };
}

/**
 * Get max defense values for a user based on tech counts
 * Uses TechService to calculate values including research factors
 */
function getUserMaxDefenseStats(user: User): { hull: number; armor: number; shield: number } {
  return TechService.calculateMaxDefense(user.techCounts, user.techTree);
}

/**
 * Create battle stats snapshot for a user (defense values only)
 */
function createBattleStats(user: User): BattleStats {
  const current = getUserDefenseStats(user);
  const max = getUserMaxDefenseStats(user);

  return {
    hull: { current: current.hull, max: max.hull },
    armor: { current: current.armor, max: max.armor },
    shield: { current: current.shield, max: max.shield },
  };
}

/**
 * Calculate distance between two positions
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get ship position from World cache
 * Helper function that delegates to TypeduserWorldCache
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
 * Set ship speed via World cache
 * Delegates to TypeduserWorldCache instead of bypassing cache
 */
async function setShipSpeed(context: LockContext<LocksAtMostAndHas4>, shipId: number, speed: number): Promise<void> {
  const worldCache = WorldCache.getInstance();
  return await context.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
    const world = worldCache.getWorldFromCache(worldContext);
    const ship = world.spaceObjects.find(obj => obj.id === shipId);
    if (ship) {
      ship.speed = speed;
      await worldCache.updateWorldUnsafe(worldContext, world);
    }
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
 */
function generateTeleportPosition(
  fromX: number,
  fromY: number,
  minDistance: number
): { x: number; y: number } {
  let x: number, y: number, distance: number;

  // Try up to 100 times to find a valid position
  for (let i = 0; i < 100; i++) {
    x = Math.random() * DEFAULT_WORLD_WIDTH;
    y = Math.random() * DEFAULT_WORLD_HEIGHT;
    distance = calculateDistance(fromX, fromY, x, y);

    if (distance >= minDistance) {
      return { x, y };
    }
  }

  // Fallback: place at opposite corner
  return {
    x: fromX > DEFAULT_WORLD_WIDTH / 2 ? 0 : DEFAULT_WORLD_WIDTH,
    y: fromY > DEFAULT_WORLD_HEIGHT / 2 ? 0 : DEFAULT_WORLD_HEIGHT
  };
}

/**
 * Teleport ship to new position via World cache
 * Delegates to TypeduserWorldCache instead of bypassing cache
 * 
 * TODO: Move this to userWorldCache.ts as a method
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
 * Initiate a battle between two users
 * NOTE: Caller should check battle state via user.inBattle before calling this
 * 
 * TECHNICAL DEBT: This function performs multiple direct DB writes
 * bypassing TypeduserWorldCache (setShipSpeed, updateUserBattleState).
 * Should be refactored to use cache-first architecture.
 * See TechnicalDebt.md for details.
 */
export async function initiateBattle<THeld extends IronLocks>(
  contextBattle: HasLock2Context<THeld>,
  contextUser: LockContext<LocksAtMostAndHas4>,
  attacker: User,
  attackee: User
): Promise<Battle> {
  console.log(`⚔️ BattleService.initiateBattle(): Starting battle between ${attacker.username} and ${attackee.username}`);

  // Validation: Check battle state from user objects (no DB access needed)
  if (attacker.inBattle) {
    throw new ApiError(400, 'You are already in a battle');
  }

  if (attackee.inBattle) {
    throw new ApiError(400, 'Target is already in a battle');
  }

  // Validation: Check if both users have ships
  if (!attacker.ship_id || !attackee.ship_id) {
    throw new ApiError(400, 'Both users must have ships to battle');
  }

  // Validation: Check if target is one of the attacker's last 3 victims
  const battleCache = getBattleCache();
  if (battleCache) {
    const recentVictims = await battleCache.getRecentAttackees(attacker.id, 3);
    if (recentVictims.includes(attackee.id)) {
      throw new ApiError(400, 'You have attacked this player recently. Choose a different target.');
    }
  }

  console.log(`⚔️ initiateBattle: Getting ship positions...`);
  // Validation: Check distance
  const attackerPos = await getShipPosition(contextUser, attacker.ship_id);
  const attackeePos = await getShipPosition(contextUser, attackee.ship_id);

  if (!attackerPos || !attackeePos) {
    throw new ApiError(500, 'Could not determine ship positions');
  }

  const distance = calculateDistance(
    attackerPos.x,
    attackerPos.y,
    attackeePos.x,
    attackeePos.y
  );

  if (distance > BATTLE_RANGE) {
    throw new ApiError(400, `Target is too far away (${distance.toFixed(1)} units, max ${BATTLE_RANGE})`);
  }

  console.log(`⚔️ initiateBattle: Creating battle stats...`);
  // Create defense value snapshots (hull/armor/shield only)
  const attackerStats = createBattleStats(attacker);
  const attackeeStats = createBattleStats(attackee);

  console.log(`⚔️ initiateBattle: Initializing weapon cooldowns...`);
  // Initialize weapon cooldowns — iterate live techCounts so that every weapon
  // the user currently owns starts ready to fire (cooldown = 0).
  const attackerCooldowns: WeaponCooldowns = {};
  const attackeeCooldowns: WeaponCooldowns = {};

  for (const weaponType of TechFactory.getWeaponKeys()) {
    if (attacker.techCounts[weaponType as keyof typeof attacker.techCounts] > 0) {
      attackerCooldowns[weaponType] = 0;
    }
    if (attackee.techCounts[weaponType as keyof typeof attackee.techCounts] > 0) {
      attackeeCooldowns[weaponType] = 0;
    }
  }

  // Validation: Check if attacker has weapons
  if (Object.keys(attackerCooldowns).length === 0) {
    throw new ApiError(400, 'You need at least one weapon to attack');
  }

  console.log(`⚔️ initiateBattle: Setting ship speeds to 0...`);
  // Set both ships' speeds to 0
  await setShipSpeed(contextUser, attacker.ship_id, 0);
  await setShipSpeed(contextUser, attackee.ship_id, 0);

  console.log(`⚔️ initiateBattle: Creating battle in database...`);
  // Create battle in database with initial cooldowns
  const battle = await battleCache!.createBattle(
    contextBattle,
    contextUser,
    attacker.id,
    attackee.id,
    attackerStats,
    attackeeStats,
    attackerCooldowns,
    attackeeCooldowns
  );

  console.log(`⚔️ initiateBattle: Updating user battle states...`);
  // Update users' battle state
  await updateUserBattleState(contextUser, attacker.id, true, battle.id);
  await updateUserBattleState(contextUser, attackee.id, true, battle.id);

  // Log battle start event
  const startEvent: BattleEvent = {
    timestamp: Math.floor(Date.now() / 1000),
    type: 'battle_started',
    actor: 'attacker',
    data: {
      message: `Battle initiated at distance ${distance.toFixed(1)} units`
    }
  };

  await BattleRepo.addBattleEvent(contextUser, battle.id, startEvent);

  console.log(`⚔️ Battle ${battle.id} started: User ${attacker.id} vs User ${attackee.id}`);

  return battle;
}

/**
 * Update an ongoing battle (process one combat round)
 * Note: In production, battles are processed automatically by battleScheduler.
 * This method is primarily for testing and manual battle progression.
 */
export async function updateBattle(context: LockContext<LocksAtMostAndHas2>, battleId: number): Promise<Battle> {
  const battle = await BattleRepo.getBattle(context, battleId);

  console.log(`⚔️ BattleService.updateBattle(): 1: Processing battle ${battleId}`); // TODO: Remove debug
  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }

  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }

  // Import processActiveBattles to avoid circular dependency
  const { processActiveBattles } = await import('./battleScheduler');
  
  // Process all active battles using the production code path
  await processActiveBattles(context);

  // Return updated battle state
  const updatedBattle = await BattleRepo.getBattle(context, battleId);
  if (!updatedBattle) {
    throw new ApiError(404, 'Battle not found after processing');
  }

  return updatedBattle;
}


/**
 * Helper for resolveBattle: load both users (from cache or DB) and assemble
 * the final `BattleStats` snapshot based on their current defense values.
 *
 * This encapsulates the repeated locking and cache logic used by battle
 * resolution and keeps `resolveBattle` cleaner.
 */
async function logBattleEndEvent(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  battle: Battle,
  winnerId: number
): Promise<void> {
  // Log battle end event BEFORE ending battle (battle must still be in cache)
  // If event logging fails, we still proceed with ending the battle to avoid inconsistent state
  try {
    const endEvent: BattleEvent = {
      timestamp: Math.floor(Date.now() / 1000),
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
}

interface IronTransferResult {
  amount: number;
  winnerName: string;
  loserName: string;
}

async function destroyLoserIronOnNpcVictory(
  context: LockContext<LocksAtMostAndHas4>,
  winnerId: number,
  loserId: number
): Promise<IronTransferResult> {
  const userWorldCache = UserCache.getInstance2();

  const winner = userWorldCache.getUserByIdFromCache(context, winnerId);
  const loser = await userWorldCache.getUserByIdWithLock(context, loserId);
  if (!loser) {
    throw new Error('Loser not found during NPC iron destruction');
  }

  const lostAmount = loser.iron;
  if (lostAmount > 0) {
    loser.subtractIron(lostAmount);
    await userWorldCache.updateUserInCache(context, loser);
  }

  return {
    amount: lostAmount,
    winnerName: winner?.username ?? 'NPC',
    loserName: loser.username,
  };
}

async function transferIronOnBattle(
  context: LockContext<LocksAtMostAndHas4>,
  winnerId: number,
  loserId: number
): Promise<IronTransferResult> {
  // Transfers up to winner's remaining iron capacity from loser.
  // Returns the actual amount moved along with both usernames.
  const userWorldCache = UserCache.getInstance2();

  const winner = await userWorldCache.getUserByIdWithLock(context, winnerId);
  const loser = await userWorldCache.getUserByIdWithLock(context, loserId);
  if (!winner || !loser) {
    throw new Error('Users not found during iron transfer');
  }

  const amountAvailable = loser.iron;
  const winnerBonuses = await userWorldCache.getBonusesByUserIdWithLock(context, winnerId);
  const maxCapacity = winnerBonuses.ironStorageCapacity;
  const capacityLeft = Math.max(0, maxCapacity - winner.iron);
  const requestedTransfer = Math.min(amountAvailable, capacityLeft);
  if (requestedTransfer > 0) {
    // update users
    const actualTransferred = winner.addIron(requestedTransfer, maxCapacity);
    loser.subtractIron(actualTransferred);
    await userWorldCache.updateUserInCache(context, winner);
    await userWorldCache.updateUserInCache(context, loser);
    return { amount: actualTransferred, winnerName: winner.username, loserName: loser.username };
  }

  return { amount: 0, winnerName: winner.username, loserName: loser.username };
}

async function computeEndStats(
  context: LockContext<LocksAtMostAndHas2>,
  battle: Battle
): Promise<[BattleStats, BattleStats]> {
  const userWorldCache = UserCache.getInstance2();
  return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const attacker = await userWorldCache.getUserByIdWithLock(userContext, battle.attackerId);
    const attackee = await userWorldCache.getUserByIdWithLock(userContext, battle.attackeeId);

    if (!attacker || !attackee) {
      throw new Error('Users not found when resolving battle');
    }

    const attackerStats: BattleStats = {
      hull: { current: attacker.hullCurrent, max: attacker.techCounts.ship_hull * 100 },
      armor: { current: attacker.armorCurrent, max: attacker.techCounts.kinetic_armor * 100 },
      shield: { current: attacker.shieldCurrent, max: attacker.techCounts.energy_shield * 100 },
    };

    const attackeeStats: BattleStats = {
      hull: { current: attackee.hullCurrent, max: attackee.techCounts.ship_hull * 100 },
      armor: { current: attackee.armorCurrent, max: attackee.techCounts.kinetic_armor * 100 },
      shield: { current: attackee.shieldCurrent, max: attackee.techCounts.energy_shield * 100 },
    };

    return [attackerStats, attackeeStats] as const;
  });
}

/**
 * Resolve a battle (determine winner and apply consequences)
 *
 * This function is typically invoked by the scheduler when it detects that a
 * battle has finished during a processing round.  The scheduler calculates the
 * winner/loser, then passes the winner ID to this service method which
 * finalizes the outcome:
 *   - snapshots end-of-battle defense values
 *   - logs a battle_ended event
 *   - persists the result and removes the battle from the cache
 *   - clears the `inBattle` flags on both users and teleports the loser.
 *
 * After the battle state is finalized this method also sends the classic
 * victory/defeat notifications to the two participants via `MessageCache`.
 * This consolidates all end‑of‑battle logic in one place.  Callers (e.g. the
 * scheduler) should **not** send their own messages after invoking this
 * function, otherwise players would receive duplicates.
 */
export async function resolveBattle(
  context: LockContext<LocksAtMostAndHas2>,
  battleId: number,
  winnerId: number,
  loserId: number
): Promise<void> {
  const battle = await BattleRepo.getBattle(context, battleId);

  if (!battle) {
    throw new ApiError(404, 'Battle not found');
  }

  if (battle.battleEndTime) {
    throw new ApiError(400, 'Battle has already ended');
  }

  // Snapshot final defense values from User objects to create endStats
  // This is the "write once at end of battle" for endStats.
  const [attackerEndStats, attackeeEndStats] = await computeEndStats(context, battle);

  await logBattleEndEvent(context, battleId, battle, winnerId);

  // End the battle in database (this removes it from cache)
  await BattleRepo.endBattle(
    context,
    battleId,
    winnerId,
    loserId,
    attackerEndStats,
    attackeeEndStats
  );

  let ironResult: IronTransferResult = { amount: 0, winnerName: '', loserName: '' };
  let xpAwarded = 0;
  let levelUpResult: { leveledUp: boolean; oldLevel: number; newLevel: number } | undefined;

  const winnerIsNpc = isNpcId(winnerId);
  const loserIsNpc = isNpcId(loserId);
  const npcInvolved = winnerIsNpc || loserIsNpc;

  await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    // --- Iron transfer ---
    if (loserIsNpc) {
      // Player wins vs NPC: award fixed iron reward to player (not loser-to-winner transfer)
      const npc = NPCManager.getInstance().getNpcById(loserId);
      const npcLevel = npc?.level ?? 1;
      const reward = calculateNpcIronReward(npcLevel);
      const userWorldCache = UserCache.getInstance2();
      const winner = await userWorldCache.getUserByIdWithLock(userContext, winnerId);
      const loser = userWorldCache.getUserByIdFromCache(userContext, loserId);
      if (winner) {
        const winnerBonuses = await userWorldCache.getBonusesByUserIdWithLock(userContext, winnerId);
        const added = winner.addIron(reward, winnerBonuses.ironStorageCapacity);
        await userWorldCache.updateUserInCache(userContext, winner);
        ironResult = { amount: added, winnerName: winner.username, loserName: loser?.username ?? 'NPC' };
      }
    } else if (winnerIsNpc) {
      // NPC wins vs Player: the player loses all iron and it is destroyed.
      ironResult = await destroyLoserIronOnNpcVictory(userContext, winnerId, loserId);
    } else {
      // Normal PvP iron transfer
      ironResult = await transferIronOnBattle(userContext, winnerId, loserId);
    }

    // --- XP award (skip if winner is NPC) ---
    if (!winnerIsNpc) {
      const userWorldCache = UserCache.getInstance2();
      const winner = userWorldCache.getUserByIdFromCache(userContext, winnerId);
      const loser = userWorldCache.getUserByIdFromCache(userContext, loserId);
      if (winner && loser) {
        const winnerLevel = winner.getLevel();
        const loserLevel = loser.getLevel();
        xpAwarded = calculateBattleXp(winnerLevel, loserLevel);
        levelUpResult = winner.addXp(xpAwarded);
        await userWorldCache.updateUserInCache(userContext, winner);
      }
    }

    // Clear battle state for both users
    await updateUserBattleState(userContext, battle.attackerId, false, null);
    await updateUserBattleState(userContext, battle.attackeeId, false, null);

    // Note: Defense values are already updated in User objects during battle
    // No need to call updateUserDefense here

    // --- Teleportation: skip if loser is NPC ---
    if (!loserIsNpc) {
      const winnerShipId = await getUserShipId(userContext, winnerId);
      const loserShipId = await getUserShipId(userContext, loserId);

      const winnerPos = await getShipPosition(userContext, winnerShipId);

      if (winnerPos) {
        // Teleport loser to random position (minimum distance away)
        const teleportPos = generateTeleportPosition(
          winnerPos.x,
          winnerPos.y,
          MIN_TELEPORT_DISTANCE
        );

        await teleportShip(userContext, loserShipId, teleportPos.x, teleportPos.y);

        console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId} teleported to (${teleportPos.x.toFixed(0)}, ${teleportPos.y.toFixed(0)})`);
      } else {
        console.error(`⚠️ Could not get winner's ship position for battle ${battleId} resolution`);
      }
    } else {
      console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, NPC Loser ${loserId} (no teleport)`);
    }

    // --- NPC cleanup: mark defeated, clear inBattle, remove space object ---
    if (npcInvolved) {
      const npcManager = NPCManager.getInstance();
      const npcId = loserIsNpc ? loserId : winnerId;
      npcManager.setInBattle(npcId, false);
      npcManager.markDefeated(npcId);
      await removeNpcSpaceObject(npcId, userContext);
      console.log(`🏴‍☠️ NPC ${npcId} marked as defeated and removed from world`);
    }
  });

  // send victory/defeat messages to users (skip NPCs — they don't receive messages)
  try {
    if (!winnerIsNpc) {
      const npcLabel = loserIsNpc ? 'an Iron Horde Pirate' : ironResult.loserName;
      await sendMessageToUser(
        context,
        winnerId,
        `P: 🎉 **Victory!** You won the battle! You gained ${ironResult.amount} iron and ${xpAwarded} XP from ${npcLabel}.`
      );

      // Send level-up notification if winner leveled up
      if (levelUpResult?.leveledUp) {
        await sendMessageToUser(
          context,
          winnerId,
          `P: 🎉 Level Up! You reached level ${levelUpResult.newLevel}!`
        );
      }
    }

    if (!loserIsNpc) {
      const npcLabel = winnerIsNpc ? 'an Iron Horde Pirate' : ironResult.winnerName;
      await sendMessageToUser(
        context,
        loserId,
        `A: 💀 **Defeat!** You lost the battle against ${npcLabel}. You lost ${ironResult.amount} iron.`
      );
    }
  } catch (msgErr) {
    // logging only; don't abort resolution if message sending fails
    console.error('⚠️ Failed to send battle outcome messages:', msgErr);
  }

  // Emit statistics events (fire-and-forget, skip for NPC participants)
  try {
    const statisticsCache = StatisticsCache.getInstance();
    const durationSec = battle.battleEndTime
      ? Math.round((battle.battleEndTime - battle.battleStartTime) / 1000)
      : 0;
    // Winner event (skip if winner is NPC)
    if (!winnerIsNpc) {
      statisticsCache.recordEvent(winnerId, 'battle_completed', {
        battleId: battle.id,
        opponentId: loserId,
        won: true,
        damageDealt: battle.attackerId === winnerId ? (battle.attackerTotalDamage ?? 0) : (battle.attackeeTotalDamage ?? 0),
        damageReceived: battle.attackerId === winnerId ? (battle.attackeeTotalDamage ?? 0) : (battle.attackerTotalDamage ?? 0),
        ironTransferred: ironResult.amount,
        xpAwarded,
        durationSec,
      });
    }
    // Loser event (skip if loser is NPC)
    if (!loserIsNpc) {
      statisticsCache.recordEvent(loserId, 'battle_completed', {
        battleId: battle.id,
        opponentId: winnerId,
        won: false,
        damageDealt: battle.attackerId === loserId ? (battle.attackerTotalDamage ?? 0) : (battle.attackeeTotalDamage ?? 0),
        damageReceived: battle.attackerId === loserId ? (battle.attackeeTotalDamage ?? 0) : (battle.attackerTotalDamage ?? 0),
        ironTransferred: 0,
        xpAwarded: 0,
        durationSec,
      });
    }
  } catch (statsErr) {
    console.error('⚠️ Failed to emit battle statistics events:', statsErr);
  }
}
