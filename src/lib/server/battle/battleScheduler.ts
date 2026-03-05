// ---
// BattleScheduler: Automates periodic processing of active battles.
// Responsibilities:
//   - Triggers battle rounds at regular intervals
//   - Processes weapon firing using TechFactory.calculateWeaponDamage for centralized damage calculation
//   - Applies damage directly to user defense values via cache
//   - Sends notifications/messages to users about battle events
//   - Calls BattleService.resolveBattle when battle ends
// Main interaction partners:
//   - BattleCache (via BattleRepo compatibility layer)
//   - BattleService (for battle resolution)
//   - UserCache (for user state access)
//   - MessageCache (for notifications)
//   - TechFactory (for centralized weapon damage calculations)
// ---

import { BattleRepo } from './BattleCache';
import { resolveBattle } from './battleService';
import type { Battle, BattleEvent } from './battleTypes';
import { DAMAGE_CALC_DEFAULTS } from './battleTypes';
import { TechFactory } from '../techs/TechFactory';
import { sendMessageToUser } from '../messages/MessageCache';
import { getBattleCache } from './BattleCache';
import { BATTLE_LOCK, USER_LOCK } from '../typedLocks';
import { createLockContext, LockContext, LocksAtMostAndHas2, LocksAtMost3, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '../user/userCache';
import type { User } from '../user/user';
import { TimeMultiplierService } from '../timeMultiplier';
import { UserBonusCache } from '../bonus/UserBonusCache';

// ========================================
// Constants
// ========================================

/**
 * When a weapon is fired but the current weapon count is 0 (weapon lost or not yet
 * re-acquired mid-battle), back off and recheck after this many seconds rather than
 * spinning immediately.
 */
const WEAPON_UNAVAILABLE_RECHECK_INTERVAL_S = 60;

// ========================================
// Battle Helper Functions
// ========================================

/**
 * Get all weapons that are ready to fire for a user.
 *
 * Iterates the weapon-cooldowns map (not startStats) so that weapons discovered
 * mid-battle via discoverNewWeapons are automatically included.  Count validation
 * (weapon still owned?) is deferred to fireWeapon which already holds USER_LOCK.
 */
function getReadyWeapons(battle: Battle, userId: number, currentTime: number): string[] {
  const isAttacker = battle.attackerId === userId;
  const cooldowns = isAttacker ? battle.attackerWeaponCooldowns : battle.attackeeWeaponCooldowns;
  const readyWeapons: string[] = [];

  for (const [weaponType, nextReadyTime] of Object.entries(cooldowns)) {
    if (currentTime >= nextReadyTime) {
      readyWeapons.push(weaponType);
    }
  }

  return readyWeapons;
}

/**
 * Discover weapon types that were built after battle start for a given user and
 * register them in the battle's cooldown map so they can fire on the next round.
 *
 * This is called whenever a weapon fires and we are already inside USER_LOCK with
 * live user data – effectively piggybacking on an existing lock acquisition.
 * Newly discovered weapons are registered with a cooldown of 0 (ready immediately).
 *
 * Issue addressed: weapon categories that did not exist at battle-start (e.g., a
 * rocket_launcher built mid-battle) will never appear in getReadyWeapons unless
 * we proactively scan the user's current techCounts.
 */
async function discoverNewWeapons(
  context: LockContext<LocksAtMostAndHas2>,
  userId: number,
  user: User,
  battle: Battle
): Promise<void> {
  const isAttacker = userId === battle.attackerId;
  const cooldowns = isAttacker ? battle.attackerWeaponCooldowns : battle.attackeeWeaponCooldowns;

  const allWeaponKeys = TechFactory.getWeaponKeys();
  const techCounts = user.techCounts as Record<string, number>;

  for (const weaponType of allWeaponKeys) {
    const count = techCounts[weaponType] ?? 0;
    if (count > 0 && !(weaponType in cooldowns)) {
      // New weapon not yet registered in this battle – add it with immediate cooldown
      await BattleRepo.setWeaponCooldown(context, battle.id, userId, weaponType, 0);
      console.log(`⚔️ Battle ${battle.id}: User ${userId} built ${weaponType} mid-battle (count: ${count}), registering`);
    }
  }
}

/**
 * Calculate effective weapon cooldown with time multiplier applied
 * @param baseCooldown - Base cooldown in seconds
 * @returns Effective cooldown (minimum 1 second)
 */
function calculateEffectiveWeaponCooldown(baseCooldown: number): number {
  const multiplier = TimeMultiplierService.getInstance().getMultiplier();
  return Math.max(1, Math.ceil(baseCooldown / multiplier));
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
 * Checks actual User defense values from cache
 */
async function isBattleOverWithLock(context: LockContext<LocksAtMostAndHas4>, battle: Battle): Promise<boolean> {
  const userWorldCache = UserCache.getInstance2();
  const attacker = await userWorldCache.getUserByIdWithLock(context, battle.attackerId);
  const attackee = await userWorldCache.getUserByIdWithLock(context, battle.attackeeId);

  if (!attacker || !attackee) {
    throw new Error('Users not found during battle');
  }

  return attacker.hullCurrent <= 0 || attackee.hullCurrent <= 0;
}

/**
 * Check if the battle is over (wrapper that acquires USER_LOCK)
 */
async function isBattleOver(context: LockContext<LocksAtMost3>, battle: Battle): Promise<boolean> {
  return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    return isBattleOverWithLock(userContext, battle);
  });
}

/**
 * Get the winner and loser IDs
 * Checks actual User defense values from cache
 */
async function getBattleOutcome(context: LockContext<LocksAtMost3>, battle: Battle): Promise<{ winnerId: number; loserId: number } | null> {
  return await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const isOver = await isBattleOverWithLock(userContext, battle);
    if (!isOver) {
      return null;
    }

    const userWorldCache = UserCache.getInstance2();
    const attacker = await userWorldCache.getUserByIdWithLock(userContext, battle.attackerId);
    const attackee = await userWorldCache.getUserByIdWithLock(userContext, battle.attackeeId);

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
  });
}

/**
 * Helper to create a message for a user via MessageCache
 * Uses the cache system to ensure consistency
 */
async function createMessage(userId: number, message: string): Promise<void> {
  const ctx = createLockContext();
  await sendMessageToUser(ctx, userId, message);
}

/**
 * Process all active battles automatically  
 * Acquires BATTLE write lock once for all battle processing
 */
export async function processActiveBattles(context: LockContext<LocksAtMostAndHas2>): Promise<void> {
  try {
      const battleCache = getBattleCache();
      // Pass battleContext so getActiveBattles doesn't try to acquire another lock
      const activeBattles = await battleCache!.getActiveBattles(context);
      
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
      if (await isBattleOver(context, updatedBattle)) {
        const outcome = await getBattleOutcome(context, updatedBattle);
        if (outcome) {
          // Use battleService.resolveBattle instead of local endBattle
          // This ensures proper endStats snapshotting and teleportation
          await resolveBattle(context, battleId, outcome.winnerId, outcome.loserId);
        }
      }
    }
}

/**
 * Fire a weapon and apply damage using TechFactory.calculateWeaponDamage
 * 
 * This function uses the centralized damage calculation from TechFactory
 * which properly handles weapon types, defense penetration, and damage distribution.
 *
 * Issue 1: weapon count is read from live UserCache data (not the stale startStats snapshot)
 *   so changes (e.g. more weapons built) are reflected for every shot.
 * Issue 2: while USER_LOCK is held we also call discoverNewWeapons for both participants
 *   so newly built weapon categories are registered for the next round.
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

    // Issue 1: Query current weapon count from live user data instead of the stale
    // startStats snapshot.  The user may have built more (or lost) weapons since the
    // battle started.
    const currentCount = (attackerUser.techCounts as Record<string, number>)[weaponType] ?? 0;
    if (currentCount === 0) {
      // Weapon no longer available – update cooldown to prevent re-firing until re-acquired
      const nextReadyTime = currentTime + WEAPON_UNAVAILABLE_RECHECK_INTERVAL_S;
      await BattleRepo.setWeaponCooldown(context, battle.id, attackerId, weaponType, nextReadyTime);
      return;
    }

    // Issue 2: While we already hold USER_LOCK and have live user data, scan for weapon
    // types that were built after this battle started and register them immediately.
    await discoverNewWeapons(context, attackerId, attackerUser, battle);
    await discoverNewWeapons(context, defenderId, defenderUser, battle);
    
    // Fetch pre-computed bonus factors for the attacker.
    // These include research × level × commander multipliers for all weapon stats.
    const attackerBonuses = await UserBonusCache.getInstance().getBonuses(userContext, attackerId);
    
    // Determine weapon category to select the right bonus factor.
    const isProjectile = weaponSpec.subtype === 'Projectile';
    const accuracyFactor = isProjectile
      ? attackerBonuses.projectileWeaponAccuracyFactor
      : attackerBonuses.energyWeaponAccuracyFactor;
    const damageFactor = isProjectile
      ? attackerBonuses.projectileWeaponDamageFactor
      : attackerBonuses.energyWeaponDamageFactor;
    const reloadFactor = isProjectile
      ? attackerBonuses.projectileWeaponReloadFactor
      : attackerBonuses.energyWeaponReloadFactor;
    
    // Calculate damage using TechFactory with actual defense values and current weapon count
    const damageCalc = TechFactory.calculateWeaponDamage(
      weaponType,
      currentCount,
      defenderUser.shieldCurrent,
      defenderUser.armorCurrent,
      accuracyFactor,
      DAMAGE_CALC_DEFAULTS.NEGATIVE_ACCURACY_MODIFIER,
      damageFactor,
      DAMAGE_CALC_DEFAULTS.ECM_EFFECTIVENESS,
      DAMAGE_CALC_DEFAULTS.SPREAD_VALUE
    );
    
    const shotsPerSalvo = currentCount;
    
    // Compute bonused reload time: baseCooldown / reloadFactor (includes research + level + commander)
    const baseCooldown = TechFactory.getBaseBattleCooldown(weaponSpec);
    const bonusedCooldown = baseCooldown / reloadFactor;
    const effectiveCooldown = calculateEffectiveWeaponCooldown(bonusedCooldown);
    
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
      
      // Update cooldown using bonused reload time
      const nextReadyTime = currentTime + effectiveCooldown;
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
    
    // Update cooldown using bonused reload time (already computed above)
    const nextReadyTime = currentTime + effectiveCooldown;
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
