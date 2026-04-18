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
import { isNpcUserId } from '@/shared/npcConstants';
import { ensureNpcUserExists } from '@/lib/server/npc/npcUserManager';

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
    
    // Validate target user ID (allow negative IDs for NPCs)
    if (targetUserId === undefined || targetUserId === null || typeof targetUserId !== 'number') {
      throw new ApiError(400, 'Missing or invalid target user ID');
    }
    
    // Cannot attack yourself
    if (targetUserId === session.userId) {
      throw new ApiError(400, 'You cannot attack yourself');
    }
    
    const isNpcTarget = isNpcUserId(targetUserId);
    console.log(`⚔️ Attack API: User ${session.userId} attacking ${isNpcTarget ? 'NPC' : 'user'} ${targetUserId}`);
    
    const context = createLockContext();
    const userWorldCache = UserCache.getInstance2();

    return await context.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      return await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const attacker = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        if (!attacker) {
          throw new ApiError(404, 'Attacker not found');
        }
    
        // For NPC targets, create the NPC user/ship if needed
        let target;
        if (isNpcTarget) {
          target = await ensureNpcUserExists(userContext, targetUserId);
        } else {
          target = await userWorldCache.getUserByIdWithLock(userContext, targetUserId);
        }
        
        if (!target) {
          throw new ApiError(404, 'Target user not found');
        }
    
        console.log(`⚔️ Attack API: Both users loaded, initiating battle...`);
        
        // Level range check: only allow attacks within ±3 levels
        // NPCs are always within range since they're generated at player level ± 3
        const attackerLevel = attacker.getLevel();
        const targetLevel = target.getLevel();
        if (!isAttackAllowed(attackerLevel, targetLevel)) {
          throw new ApiError(400, `Level difference too large: attacker level ${attackerLevel}, target level ${targetLevel}. Only ±3 levels allowed.`);
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

