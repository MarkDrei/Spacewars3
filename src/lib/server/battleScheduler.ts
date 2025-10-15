// ---
// Battle Scheduler - Automatic battle round processing
// ---

import { BattleRepo } from './battleRepo';
import { BattleEngine } from './battle';
import type { Battle, BattleEvent } from '../../shared/battleTypes';
import { TechFactory } from './TechFactory';
import { MessagesRepo } from './messagesRepo';
import { getDatabase } from './database';

/**
 * Helper to create a message for a user
 */
async function createMessage(userId: number, message: string): Promise<void> {
  const db = await getDatabase();
  const messagesRepo = new MessagesRepo(db);
  await messagesRepo.createMessage(userId, message);
}

/**
 * Helper to update user's battle state
 * 
 * TECHNICAL DEBT: This bypasses TypedCacheManager and writes directly to DB.
 * Should be refactored to use cache-first architecture.
 * See TechnicalDebt.md for details.
 */
async function updateUserBattleState(userId: number, inBattle: boolean, battleId: number | null): Promise<void> {
  const db = await getDatabase();
  
  // TODO: Refactor to use TypedCacheManager instead of direct DB write
  // Update database
  await new Promise<void>((resolve, reject) => {
    db.run(
      'UPDATE users SET in_battle = ?, current_battle_id = ? WHERE id = ?',
      [inBattle ? 1 : 0, battleId, userId],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
  
  // Also update cache if user is cached by directly loading from DB
  try {
    const { getTypedCacheManager } = await import('./typedCacheManager');
    const { createEmptyLockContext } = await import('./ironGuard');
    const cacheManager = await getTypedCacheManager();
    await cacheManager.initialize();
    
    const emptyCtx = createEmptyLockContext();
    
    // Use withUserLock to safely update cached user
    await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      // Force load from database and update cache
      await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
        const freshUser = await cacheManager.loadUserFromDbUnsafe(userId, dbCtx);
        if (freshUser) {
          // Update cache with fresh data
          cacheManager.setUserUnsafe(freshUser, userCtx);
          console.log(`✅ Updated battle state in cache for user ${userId}: inBattle=${freshUser.inBattle}`);
        }
      });
    });
  } catch (error) {
    console.error(`⚠️ Failed to update cache for user ${userId}:`, error);
    // Don't throw - database update succeeded, cache refresh is best-effort
  }
}

/**
 * Process all active battles automatically
 */
export async function processActiveBattles(): Promise<void> {
  try {
    const activeBattles = await BattleRepo.getActiveBattles();
    
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
    if (updatedEngine.isBattleOver()) {
      const outcome = updatedEngine.getBattleOutcome();
      if (outcome) {
        await endBattle(battleId, outcome.winnerId);
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
    
    await BattleRepo.addBattleEvent(battle.id, missEvent, battle);
    
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
  
  // Store defense values BEFORE damage
  const defensesBefore = {
    shield: Math.round(defenderStats.shield.current),
    armor: Math.round(defenderStats.armor.current),
    hull: Math.round(defenderStats.hull.current)
  };
  
  // Apply damage to defender's defenses
  let remainingDamage = totalDamage;
  let shieldDamage = 0;
  let armorDamage = 0;
  let hullDamage = 0;
  
  // Damage shields first
  if (defenderStats.shield.current > 0 && remainingDamage > 0) {
    shieldDamage = Math.min(defenderStats.shield.current, remainingDamage);
    defenderStats.shield.current -= shieldDamage;
    remainingDamage -= shieldDamage;
  }
  
  // Then armor
  if (defenderStats.armor.current > 0 && remainingDamage > 0) {
    armorDamage = Math.min(defenderStats.armor.current, remainingDamage);
    defenderStats.armor.current -= armorDamage;
    remainingDamage -= armorDamage;
  }
  
  // Finally hull
  if (defenderStats.hull.current > 0 && remainingDamage > 0) {
    hullDamage = Math.min(defenderStats.hull.current, remainingDamage);
    defenderStats.hull.current -= hullDamage;
    remainingDamage -= hullDamage;
  }
  
  // Store defense values AFTER damage
  const defensesAfter = {
    shield: Math.round(defenderStats.shield.current),
    armor: Math.round(defenderStats.armor.current),
    hull: Math.round(defenderStats.hull.current)
  };
  
  // Update battle stats in database
  if (isAttacker) {
    await BattleRepo.updateBattleStats(battle.id, attackerStats, defenderStats);
  } else {
    await BattleRepo.updateBattleStats(battle.id, defenderStats, attackerStats);
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
  
  await BattleRepo.addBattleEvent(battle.id, hitEvent, battle);
  
  // Format defense status
  const formatDefense = (name: string, before: number, after: number, damage: number): string => {
    if (damage === 0) return '';
    return `${name}: ${before} → ${after}`;
  };
  
  const defenseChanges = [
    formatDefense('Shield', defensesBefore.shield, defensesAfter.shield, shieldDamage),
    formatDefense('Armor', defensesBefore.armor, defensesAfter.armor, armorDamage),
    formatDefense('Hull', defensesBefore.hull, defensesAfter.hull, hullDamage)
  ].filter(s => s).join(', ');
  
  // Send detailed messages to both players
  const attackerMessage = `⚔️ Your **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${hits} hit** for **${totalDamage} damage**! Enemy: ${defenseChanges}`;
  const defenderMessage = `🛡️ Enemy **${weaponType.replace(/_/g, ' ')}** fired ${shotsPerSalvo} shot(s), **${hits} hit** you for **${totalDamage} damage**! Your defenses: ${defenseChanges}`;
  
  await createMessage(attackerId, attackerMessage);
  await createMessage(defenderId, defenderMessage);
  
  // Update cooldown - set to when weapon will be ready next
  const nextReadyTime = currentTime + (weaponSpec.cooldown || 5);
  await BattleRepo.setWeaponCooldown(battle.id, attackerId, weaponType, nextReadyTime);
  
  console.log(`⚔️ Battle ${battle.id}: User ${attackerId} ${weaponType} - ${hits}/${shotsPerSalvo} hits, ${totalDamage} damage`);
}

/**
 * End a battle and clean up
 */
async function endBattle(battleId: number, winnerId: number): Promise<void> {
  const battle = await BattleRepo.getBattle(battleId);
  
  if (!battle) {
    return;
  }
  
  const loserId = winnerId === battle.attackerId ? battle.attackeeId : battle.attackerId;
  
  // End battle in database
  await BattleRepo.endBattle(
    battleId,
    winnerId,
    loserId,
    battle.attackerStartStats,
    battle.attackeeStartStats
  );
  
  // Clear battle state for both users in database
  await updateUserBattleState(battle.attackerId, false, null);
  await updateUserBattleState(battle.attackeeId, false, null);
  
  console.log(`⚔️ Cleared battle state for users ${battle.attackerId} and ${battle.attackeeId}`);
  
  // Send victory/defeat messages
  await createMessage(winnerId, `🎉 **Victory!** You won the battle!`);
  await createMessage(loserId, `💀 **Defeat!** You lost the battle and have been teleported away.`);
  
  console.log(`⚔️ Battle ${battleId} ended: Winner ${winnerId}, Loser ${loserId}`);
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
