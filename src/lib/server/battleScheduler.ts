// ---
// Battle Scheduler - Automatic battle round processing
// ---

import { BattleRepo } from './battleRepo';
import { BattleEngine } from './battle';
import { resolveBattle } from './battleService';
import type { Battle, BattleEvent } from '../../shared/battleTypes';
import { TechFactory } from './TechFactory';
import { sendMessageToUser } from './MessageCache';
import { getBattleCache } from './BattleCache';
import { getTypedCacheManager } from './typedCacheManager';
import { createLockContext } from './typedLocks';

/**
 * Helper to update user's battle state via TypedCacheManager
 * Uses proper cache delegation instead of direct DB access
 */
async function updateUserBattleState(userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
  const cacheManager = getTypedCacheManager();
  const ctx = createLockContext();
  const userCtx = await cacheManager.acquireUserLock(ctx);
  try {
    const user = cacheManager.getUserUnsafe(userId, userCtx);
    if (user) {
      user.inBattle = inBattle;
      user.currentBattleId = battleId;
      cacheManager.updateUserUnsafe(user, userCtx);
    }
  } finally {
    userCtx.dispose();
  }
}

/**
 * Helper to create a message for a user via MessageCache
 * Uses the cache system to ensure consistency
 */
async function createMessage(userId: number, message: string): Promise<void> {
  await sendMessageToUser(userId, message);
}

/**
 * Process all active battles automatically  
 * Updated to use BattleCache instead of BattleRepo.getActiveBattles()
 */
export async function processActiveBattles(): Promise<void> {
  try {
    const battleCache = getBattleCache();
    const activeBattles = await battleCache.getActiveBattles();
    
    if (activeBattles.length === 0) {
      return;
    }
    
    console.log(`⚔️ Processing ${activeBattles.length} active battle(s)...`);
    
    for (const battle of activeBattles) {
      try {
        await processBattleRound(battle.id);
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
 */
async function processBattleRound(battleId: number): Promise<void> {
  const battle = await BattleRepo.getBattle(battleId);
  
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
      battle,
      battle.attackeeId,
      battle.attackerId,
      weaponType,
      currentTime,
      'attackee'
    );
  }
  
  // Check if battle is over after this round
  const updatedBattle = await BattleRepo.getBattle(battleId);
  if (updatedBattle) {
    const updatedEngine = new BattleEngine(updatedBattle);
    if (await updatedEngine.isBattleOver()) {
      const outcome = await updatedEngine.getBattleOutcome();
      if (outcome) {
        // Use battleService.resolveBattle instead of local endBattle
        // This ensures proper endStats snapshotting and teleportation
        await resolveBattle(battleId, outcome.winnerId);
        
        // Send victory/defeat messages (battleService doesn't do this)
        const battle = updatedBattle;
        const winnerId = outcome.winnerId;
        const loserId = outcome.loserId;
        await createMessage(winnerId, `🎉 **Victory!** You won the battle!`);
        await createMessage(loserId, `💀 **Defeat!** You lost the battle and have been teleported away.`);
        
        console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId}`);
      }
    }
  }
}

/**
 * Fire a weapon and apply damage
 */
async function fireWeapon(
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
  const defenderStats = isAttacker ? battle.attackeeStartStats : battle.attackerStartStats;
  
  const weaponData = attackerStats.weapons[weaponType];
  if (!weaponData || weaponData.count === 0) {
    return;
  }
  
  // Calculate number of shots that hit
  const shotsPerSalvo = weaponData.count;
  const accuracy = (weaponSpec.baseAccuracy || 80) / 100; // Convert percentage to decimal
  let hits = 0;
  
  for (let i = 0; i < shotsPerSalvo; i++) {
    if (Math.random() < accuracy) {
      hits++;
    }
  }
  
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
    
    await BattleRepo.addBattleEvent(battle.id, missEvent);
    
    // Send message to both players
    await createMessage(attackerId, `Your ${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s) but all missed!`);
    await createMessage(defenderId, `Enemy ${weaponType.replace(/_/g, ' ')} fired ${shotsPerSalvo} shot(s) but all missed!`);
    
    // Update cooldown - set to when weapon will be ready next
    const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
    await BattleRepo.setWeaponCooldown(battle.id, attackerId, weaponType, nextReadyTime);
    
    return;
  }
  
  // Calculate damage
  const damagePerHit = weaponSpec.damage || 10;
  const totalDamage = hits * damagePerHit;
  
  // Apply damage using BattleEngine to ensure User cache is updated
  const battleEngine = new BattleEngine(battle);
  const damageResult = await battleEngine.applyDamage(defenderId, totalDamage);
  
  // Extract damage amounts from result
  const shieldDamage = damageResult.shieldDamage;
  const armorDamage = damageResult.armorDamage;
  const hullDamage = damageResult.hullDamage;
  
  // Track total damage dealt by attacker/attackee
  // Get battle from cache to update damage tracking
  const battleCache = getBattleCache();
  const cachedBattle = battleCache.getBattleUnsafe(battle.id);
  if (cachedBattle) {
    if (isAttacker) {
      cachedBattle.attackerTotalDamage += totalDamage;
    } else {
      cachedBattle.attackeeTotalDamage += totalDamage;
    }
    // Mark battle as dirty for persistence
    battleCache.updateBattleUnsafe(cachedBattle);
  }
  
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
  
  await BattleRepo.addBattleEvent(battle.id, hitEvent);
  
  // Format defense damage for messages
  const defenseChanges = [];
  if (shieldDamage > 0) defenseChanges.push(`Shield: -${shieldDamage}`);
  if (armorDamage > 0) defenseChanges.push(`Armor: -${armorDamage}`);
  if (hullDamage > 0) defenseChanges.push(`Hull: -${hullDamage}`);
  const damageBreakdown = defenseChanges.join(', ');
  
  // Send detailed messages to both players
  const attackerMessage = `⚔️ Your **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${hits} hit** for **${totalDamage} damage**! (${damageBreakdown})`;
  const defenderMessage = `🛡️ Enemy **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${hits} hit** you for **${totalDamage} damage**! (${damageBreakdown})`;
  
  await createMessage(attackerId, attackerMessage);
  await createMessage(defenderId, defenderMessage);
  
  // Update cooldown - set to when weapon will be ready next
  const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
  await BattleRepo.setWeaponCooldown(battle.id, attackerId, weaponType, nextReadyTime);
  
  console.log(`⚔️ Battle ${battle.id}: User ${attackerId} ${weaponType} - ${hits}/${shotsPerSalvo} hits, ${totalDamage} damage`);
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
  
  schedulerInterval = setInterval(() => {
    processActiveBattles().catch(error => {
      console.error('❌ Battle scheduler error:', error);
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
