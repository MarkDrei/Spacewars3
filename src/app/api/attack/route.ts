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
import { isNpcId } from '@/lib/server/npc/npcTypes';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { getOrCreateNpcUser } from '@/lib/server/npc/npcCombat';
import { getDatabase } from '@/lib/server/database';
import { saveUserToDb } from '@/lib/server/user/userRepo';

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
    
    console.log(`⚔️ Attack API: User ${session.userId} attacking target ${targetUserId}`);
    
    const context = createLockContext();
    const userWorldCache = UserCache.getInstance2();

    // Check if target is an NPC
    if (isNpcId(targetUserId)) {
      return await handleNpcAttack(context, userWorldCache, session.userId!, targetUserId);
    }

    return await context.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      return await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const attacker = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        if (!attacker) {
          throw new ApiError(404, 'Attacker not found');
        }
    
        // Load target from cache
        const target = await userWorldCache.getUserByIdWithLock(userContext, targetUserId);
        if (!target) {
          throw new ApiError(404, 'Target user not found');
        }
    
        console.log(`⚔️ Attack API: Both users loaded, initiating battle...`);
        
        // Level range check: only allow attacks within ±3 levels
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

/**
 * Handle attacking an NPC target.
 * Creates an NPC user if needed, then initiates battle.
 */
async function handleNpcAttack(
  context: ReturnType<typeof createLockContext>,
  userWorldCache: UserCache,
  attackerId: number,
  npcId: number
) {
  const npcManager = NPCManager.getInstance();
  const npc = npcManager.getNpcById(npcId);

  if (!npc) {
    throw new ApiError(404, 'NPC not found');
  }

  if (npc.defeated) {
    throw new ApiError(400, 'This NPC has already been defeated');
  }

  if (npc.inBattle) {
    throw new ApiError(400, 'This NPC is already in battle');
  }

  // Verify the NPC belongs to the attacker
  if (npc.ownerId !== attackerId) {
    throw new ApiError(404, 'NPC not found');
  }

  return await context.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
    return await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const attacker = await userWorldCache.getUserByIdWithLock(userContext, attackerId);
      if (!attacker) {
        throw new ApiError(404, 'Attacker not found');
      }

      if (attacker.inBattle) {
        throw new ApiError(400, 'You are already in a battle');
      }

      // Create or get the NPC user for battle
      const db = await getDatabase();
      const saveCallback = saveUserToDb(db);
      const npcUser = await getOrCreateNpcUser(db, npc, saveCallback);

      // Load NPC user into cache so battle system can find it
      userWorldCache.setUserUnsafe(userContext, npcUser);

      // Mark NPC as in battle
      npcManager.setNpcInBattle(npcId, true);

      console.log(`⚔️ Attack API: NPC battle - ${attacker.username} vs NPC L${npc.level}`);

      // Initiate the battle
      const battle = await initiateBattle(battleContext, userContext, attacker, npcUser);

      console.log(`✅ NPC Battle ${battle.id} initiated successfully`);

      return NextResponse.json({
        success: true,
        battle
      });
    });
  });
}

