// ---
// Attack API - Initiate battle with another player or NPC
// POST /api/attack
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError, requireAuth } from '@/lib/server/errors';
import { initiateBattle } from '@/lib/server/battle/battleService';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { isAttackAllowed } from '@shared/utils/levelUtils';
import { isNpcId } from '@/lib/server/npc/npcConstants';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { upsertNpcUser } from '@/lib/server/npc/npcCombat';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * POST /api/attack
 * Initiate a battle with another player or NPC
 * 
 * Body: { targetUserId: number }
 * 
 * Returns: Battle object with initial state
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { targetUserId } = body;
    
    // Validate target user ID
    if (!targetUserId || typeof targetUserId !== 'number') {
      throw new ApiError(400, 'Missing or invalid target user ID');
    }
    
    // Cannot attack yourself
    if (targetUserId === session.userId) {
      throw new ApiError(400, 'You cannot attack yourself');
    }

    const targetIsNpc = isNpcId(targetUserId);
    
    console.log(`⚔️ Attack API: User ${session.userId} attacking ${targetIsNpc ? 'NPC' : 'user'} ${targetUserId}`);
    
    const context = createLockContext();
    const userWorldCache = UserCache.getInstance2();

    return await context.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      return await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
        // --- NPC pre-flight checks & upsert ---
        if (targetIsNpc) {
          const npcManager = NPCManager.getInstance();
          const npc = npcManager.getNpcById(targetUserId);

          if (!npc) {
            throw new ApiError(404, 'NPC not found');
          }
          if (npc.defeated) {
            throw new ApiError(400, 'This NPC has been defeated');
          }
          if (npc.inBattle) {
            throw new ApiError(400, 'This NPC is already in battle');
          }

          // Upsert NPC user (idempotent — creates DB row & cache entry with randomised stats)
          await upsertNpcUser(npc, userContext);

          // Mark NPC as in battle so it stops orbiting
          npcManager.setInBattle(targetUserId, true);
        }

        const attacker = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        if (!attacker) {
          throw new ApiError(404, 'Attacker not found');
        }
    
        // Load target from cache (NPC was just loaded by upsertNpcUser)
        const target = await userWorldCache.getUserByIdWithLock(userContext, targetUserId);
        if (!target) {
          throw new ApiError(404, 'Target user not found');
        }
    
        console.log(`⚔️ Attack API: Both users loaded, initiating battle...`);
        
        // Level range check: skip for NPCs (they are designed at various levels)
        if (!targetIsNpc) {
          const attackerLevel = attacker.getLevel();
          const targetLevel = target.getLevel();
          if (!isAttackAllowed(attackerLevel, targetLevel)) {
            throw new ApiError(400, `Level difference too large: attacker level ${attackerLevel}, target level ${targetLevel}. Only ±3 levels allowed.`);
          }
        }
        
        // Initiate the battle - this will handle its own locking internally
        const battle = await initiateBattle(battleContext, userContext, attacker, target);
        
        console.log(`✅ Battle ${battle.id} initiated successfully`);
        
        return NextResponse.json({
          success: true,
          battle
        });
      });
    });
    
    
  } catch (error) {
    console.error('❌ Attack API error:', error);
    return handleApiError(error);
  }
}

