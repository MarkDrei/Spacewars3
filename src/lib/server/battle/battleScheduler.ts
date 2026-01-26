// ---
// BattleScheduler: Automates periodic processing of active battles.
// Responsibilities:
//   - Triggers battle rounds at regular intervals
//   - Processes weapon firing using TechFactory.calculateWeaponDamage for centralized damage calculation
//   - Applies damage via BattleEngine.applyDamageWithLock for proper cache delegation
//   - Sends notifications/messages to users about battle events
//   - Calls BattleService.resolveBattle when battle ends
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - BattleEngine (for damage application)
//   - BattleService (for battle resolution)
//   - UserCache (for user state access)
//   - MessageCache (for notifications)
//   - TechFactory (for centralized weapon damage calculations)
// Status: ✅ Uses TechFactory.calculateWeaponDamage + applyDamageWithLock for consistent damage calculation
// ---

import { BattleRepo } from './BattleCache';
import { BattleEngine } from './battleEngine';
import { resolveBattle } from './battleService';
import type { Battle, BattleEvent } from './battleTypes';
import { DAMAGE_CALC_DEFAULTS } from './battleTypes';
import { TechFactory, TechCounts } from '../techs/TechFactory';
import { sendMessageToUser } from '../messages/MessageCache';
import { getBattleCache } from './BattleCache';
import { BATTLE_LOCK, USER_LOCK } from '../typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas2 } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '../user/userCache';

// /**
//  * Helper to update user's battle state via TypedCacheManager
//  * Uses proper cache delegation instead of direct DB access
//  */
// async function updateUserBattleState(userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
//   const userWorldCache = getUserWorldCache();
//   const ctx = createLockContext();
//   await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
//     const user = userWorldCache.getUserByIdFromCache(userContext, userId);
//     if (user) {
//       user.inBattle = inBattle;
//       user.currentBattleId = battleId;
//       userWorldCache.updateUserInCache(userContext, user);
//     }
//   });
// }

/**
 * Helper to create a message for a user via MessageCache
 * Uses the cache system to ensure consistency
 */
async function createMessage(userId: number, message: string): Promise<void> {
  await sendMessageToUser(userId, message);
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
  
  const battleEngine = new BattleEngine(battle);
  const currentTime = Math.floor(Date.now() / 1000);
    
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
    
    const shotsPerSalvo = weaponData.count;
    
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
    
    // Apply the pre-calculated damage values to each defense layer using BattleEngine
    const battleEngine = new BattleEngine(battle);
    const damageResult = await battleEngine.applyDamageWithLock(
      userContext,
      defenderId,
      damageCalc.shieldDamage,
      damageCalc.armorDamage,
      damageCalc.hullDamage
    );
    
    // Calculate total damage dealt
    const totalDamage = damageCalc.shieldDamage + damageCalc.armorDamage + damageCalc.hullDamage;
    
    // Extract remaining defense values
    const remainingShield = damageResult.remainingShield;
    const remainingArmor = damageResult.remainingArmor;
    const remainingHull = damageResult.remainingHull;
    
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
        hits: damageCalc.weaponsHit,
        damage: totalDamage,
        shieldDamage: damageCalc.shieldDamage,
        armorDamage: damageCalc.armorDamage,
        hullDamage: damageCalc.hullDamage,
        message: `${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s), ${damageCalc.weaponsHit} hit for ${totalDamage} damage (Shield: ${damageCalc.shieldDamage}, Armor: ${damageCalc.armorDamage}, Hull: ${damageCalc.hullDamage})`
      }
    };
    
    await BattleRepo.addBattleEvent(context, battle.id, hitEvent);
    
    // Format defense status for messages - ALWAYS show all three defense values
    const defenseStatus = `Hull: ${remainingHull}, Armor: ${remainingArmor}, Shield: ${remainingShield}`;
    
    // Send detailed messages to both players
    const attackerMessage = `P: ⚔️ Your **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${damageCalc.weaponsHit} hit** for **${totalDamage} damage**! Enemy: ${defenseStatus}`;
    const defenderMessage = `N: 🛡️ Enemy **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${damageCalc.weaponsHit} hit** you for **${totalDamage} damage**! Your defenses: ${defenseStatus}`;
    
    await createMessage(attackerId, attackerMessage);
    await createMessage(defenderId, defenderMessage);
    
    // Update cooldown - set to when weapon will be ready next
    const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
    await BattleRepo.setWeaponCooldown(context, battle.id, attackerId, weaponType, nextReadyTime);
    
    console.log(`⚔️ Battle ${battle.id}: User ${attackerId} ${weaponType} - ${damageCalc.weaponsHit}/${shotsPerSalvo} hits, ${totalDamage} damage`);
  });
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
