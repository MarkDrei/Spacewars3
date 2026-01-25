// ---
// BattleScheduler: Automates periodic processing of active battles.
// Responsibilities:
//   - Triggers battle rounds at regular intervals
//   - Processes weapon firing and damage application through TechFactory.calculateWeaponDamage
//   - Sends notifications/messages to users
//   - Calls BattleService.resolveBattle when battle ends
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - TechFactory (for weapon damage calculations)
//   - BattleService (for battle resolution)
//   - UserCache (for user state updates and tech tree access)
//   - MessageCache (for notifications)
// Status: ✅ Uses proper cache delegation, consolidated damage system
// Note: Inlines helper functions from former BattleEngine for direct battle processing
// ---

import { BattleRepo } from './BattleCache';
import { resolveBattle } from './battleService';
import type { Battle, BattleEvent } from './battleTypes';
import { DAMAGE_CALC_DEFAULTS } from './battleTypes';
import { TechFactory } from '../techs/TechFactory';
import { sendMessageToUser } from '../messages/MessageCache';
import { getBattleCache } from './BattleCache';
import { BATTLE_LOCK, USER_LOCK } from '../typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas2, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '../user/userCache';
import { getWeaponDamageModifierFromTree } from '../techs/techtree';

/**
 * Helper to create a message for a user via MessageCache
 * Uses the cache system to ensure consistency
 */
async function createMessage(userId: number, message: string): Promise<void> {
  await sendMessageToUser(userId, message);
}

/**
 * Check if a weapon is ready to fire (cooldown expired)
 */
function isWeaponReady(battle: Battle, userId: number, weaponType: string, currentTime: number): boolean {
  const isAttacker = battle.attackerId === userId;
  const cooldowns = isAttacker ? battle.attackerWeaponCooldowns : battle.attackeeWeaponCooldowns;
  const nextReadyTime = cooldowns[weaponType] || 0;
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
 * Apply damage to a target's defenses (shield → armor → hull)
 * Updates User defense values through cache
 */
async function applyDamage(
  context: LockContext<LocksAtMostAndHas4>,
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
  const userWorldCache = UserCache.getInstance2();
  const user = await userWorldCache.getUserByIdWithLock(context, targetUserId);

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
  userWorldCache.updateUserInCache(context, user);

  return {
    shieldDamage,
    armorDamage,
    hullDamage,
    remainingShield: user.shieldCurrent,
    remainingArmor: user.armorCurrent,
    remainingHull: user.hullCurrent
  };
}

/**
 * Check if the battle is over (someone's hull reached 0)
 */
async function isBattleOver(context: LockContext<LocksAtMostAndHas4>, battle: Battle): Promise<boolean> {
  const userWorldCache = UserCache.getInstance2();
  const attacker = await userWorldCache.getUserByIdWithLock(context, battle.attackerId);
  const attackee = await userWorldCache.getUserByIdWithLock(context, battle.attackeeId);

  if (!attacker || !attackee) {
    throw new Error('Users not found during battle');
  }

  return attacker.hullCurrent <= 0 || attackee.hullCurrent <= 0;
}

/**
 * Get the battle outcome (winner and loser)
 */
async function getBattleOutcome(context: LockContext<LocksAtMostAndHas4>, battle: Battle): Promise<{ winnerId: number; loserId: number } | null> {
  const isOver = await isBattleOver(context, battle);
  if (!isOver) {
    return null;
  }

  const userWorldCache = UserCache.getInstance2();
  const attacker = await userWorldCache.getUserByIdWithLock(context, battle.attackerId);
  const attackee = await userWorldCache.getUserByIdWithLock(context, battle.attackeeId);

  if (!attacker || !attackee) {
    throw new Error('Users not found during battle');
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
  
  const currentTime = Math.floor(Date.now() / 1000);
    
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
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        if (await isBattleOver(userContext, updatedBattle)) {
          const outcome = await getBattleOutcome(userContext, updatedBattle);
          if (outcome) {
            // Use battleService.resolveBattle instead of local endBattle
            // This ensures proper endStats snapshotting and teleportation
            await resolveBattle(context, battleId, outcome.winnerId);
            
            // Send victory/defeat messages (battleService doesn't do this)
            const winnerId = outcome.winnerId;
            const loserId = outcome.loserId;
            await createMessage(winnerId, `P: 🎉 **Victory!** You won the battle!`);
            await createMessage(loserId, `A: 💀 **Defeat!** You lost the battle and have been teleported away.`);
            
            console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId}`);
          }
        }
      });
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

  // Get attacker's user for tech tree access
  const userCache = UserCache.getInstance2();
  const attackerUser = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    return await userCache.getUserByIdWithLock(userContext, attackerId);
  });

  if (!attackerUser) {
    console.error(`❌ Attacker user ${attackerId} not found`);
    return;
  }

  // Get defender for current defense values
  const defenderUser = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    return await userCache.getUserByIdWithLock(userContext, defenderId);
  });

  if (!defenderUser) {
    console.error(`❌ Defender user ${defenderId} not found`);
    return;
  }

  // Calculate dynamic damage modifier from tech tree
  const damageModifier = getWeaponDamageModifierFromTree(attackerUser.techTree, weaponType);

  // Use TechFactory.calculateWeaponDamage for consolidated damage calculation
  const damageResult = TechFactory.calculateWeaponDamage(
    weaponType,
    attackerUser.techCounts,
    defenderUser.shieldCurrent,
    defenderUser.armorCurrent,
    DAMAGE_CALC_DEFAULTS.POSITIVE_ACCURACY_MODIFIER,
    DAMAGE_CALC_DEFAULTS.NEGATIVE_ACCURACY_MODIFIER,
    damageModifier,
    DAMAGE_CALC_DEFAULTS.ECM_EFFECTIVENESS,
    DAMAGE_CALC_DEFAULTS.SPREAD_VALUE
  );

  const { weaponsHit, shieldDamage, armorDamage, hullDamage } = damageResult;
  const totalDamage = shieldDamage + armorDamage + hullDamage;
  const shotsPerSalvo = weaponData.count;

  if (weaponsHit === 0) {
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
  
  // Apply damage through cache system
  await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    await applyDamage(userContext, defenderId, totalDamage);
  });
  
  // Get updated defense values after damage
  const updatedDefender = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    return await userCache.getUserByIdWithLock(userContext, defenderId);
  });

  if (!updatedDefender) {
    console.error(`❌ Could not get updated defender state`);
    return;
  }

  const remainingShield = updatedDefender.shieldCurrent;
  const remainingArmor = updatedDefender.armorCurrent;
  const remainingHull = updatedDefender.hullCurrent;
  
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
      hits: weaponsHit,
      damage: totalDamage,
      shieldDamage,
      armorDamage,
      hullDamage,
      message: `${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s), ${weaponsHit} hit for ${totalDamage} damage (Shield: ${shieldDamage}, Armor: ${armorDamage}, Hull: ${hullDamage})`
    }
  };
  
  await BattleRepo.addBattleEvent(context, battle.id, hitEvent);
  
  // Format defense status for messages - ALWAYS show all three defense values
  const defenseStatus = `Hull: ${remainingHull}, Armor: ${remainingArmor}, Shield: ${remainingShield}`;
  
  // Send detailed messages to both players
  const attackerMessage = `P: ⚔️ Your **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${weaponsHit} hit** for **${totalDamage} damage**! Enemy: ${defenseStatus}`;
  const defenderMessage = `N: 🛡️ Enemy **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${weaponsHit} hit** you for **${totalDamage} damage**! Your defenses: ${defenseStatus}`;
  
  await createMessage(attackerId, attackerMessage);
  await createMessage(defenderId, defenderMessage);
  
  // Update cooldown - set to when weapon will be ready next
  const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
  await BattleRepo.setWeaponCooldown(context, battle.id, attackerId, weaponType, nextReadyTime);
  
  console.log(`⚔️ Battle ${battle.id}: User ${attackerId} ${weaponType} - ${weaponsHit}/${shotsPerSalvo} hits, ${totalDamage} damage`);
}

/**
 * Start the battle scheduler (call from server startup)
 */
let schedulerInterval: NodeJS.Timeout | null = null;

export function startBattleScheduler(intervalMs: number = 1000): void {
  if (schedulerInterval) {
    console.log('⚔️ Battle scheduler already running');
    return;
  }
  
  console.log(`⚔️ Starting battle scheduler (interval: ${intervalMs}ms)`);
  
  schedulerInterval = setInterval(async () => {
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      await processActiveBattles(battleContext).catch(error => {
        console.error('❌ Battle scheduler error:', error);
      });
    });
  }, intervalMs);
}

export function stopBattleScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⚔️ Battle scheduler stopped');
  }
}
