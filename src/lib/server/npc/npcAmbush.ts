// ---
// Ambush: an aggressive NPC ship starts a battle with a player who came too close.
// Called from the world poll (GET /api/world) after NPCManager.findAmbusher found a ship.
// ---

import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '../typedLocks';
import { UserCache } from '../user/userCache';
import { initiateBattle } from '../battle/battleService';
import { sendMessageToUser } from '../messages/MessageCache';
import { getServerT } from '../i18n/serverTranslations';
import { NPCManager } from './NPCManager';
import { removeNpcSpaceObject, rollbackNpcBattlePreparation, upsertNpcUser } from './npcCombat';
import type { NpcShip } from './npcTypes';
import { hostileDisplayName } from '@/shared/quests/npcArchetypes';

export interface AmbushResult {
  /** Display name of the attacking ship. */
  enemyName: string;
}

/**
 * Starts a battle with the NPC as attacker, at the player's position.
 * Returns null when no battle was started (player already in battle, NPC gone in the meantime).
 * Locks: BATTLE_LOCK (2) → USER_LOCK (4) → WORLD_LOCK (6), as for a player's attack.
 */
export async function ambushPlayer(
  userId: number,
  npc: NpcShip,
  playerPosition: { x: number; y: number }
): Promise<AmbushResult | null> {
  const userCache = UserCache.getInstance2();
  const npcManager = NPCManager.getInstance();

  const locale = await createLockContext().useLockWithAcquire(BATTLE_LOCK, async (battleContext) =>
    battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const player = await userCache.getUserByIdWithLock(userContext, userId);
      if (!player || player.inBattle || npc.defeated || npc.inBattle) return null;

      let upsertResult: Awaited<ReturnType<typeof upsertNpcUser>> | null = null;
      try {
        upsertResult = await upsertNpcUser(npc, userContext, playerPosition);
        npcManager.setInBattle(npc.id, true);
        const attacker = await userCache.getUserByIdWithLock(userContext, npc.id);
        if (!attacker) throw new Error(`NPC user ${npc.id} not found after upsert`);
        await initiateBattle(battleContext, userContext, attacker, player);
        await removeNpcSpaceObject(npc.id, userContext);
      } catch (error) {
        await rollbackNpcBattlePreparation(npc, userContext, {
          deleteUserIfUnreferenced: upsertResult?.createdNow ?? false,
        });
        throw error;
      }
      return player.preferredLocale ?? 'en';
    })
  );
  if (locale === null) return null;

  const enemyName = hostileDisplayName(npc.archetype, npc.level);
  const t = await getServerT(locale, 'quests');
  await sendMessageToUser(createLockContext(), userId, t('notifications.ambushed', { enemy: enemyName }));
  return { enemyName };
}
