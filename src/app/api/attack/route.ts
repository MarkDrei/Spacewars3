// ---
// Attack API - Initiate battle with another player
// POST /api/attack
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError, requireAuth } from '@/lib/server/errors';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { createEmptyContext } from '@/lib/server/typedLocks';
import { initiateBattle } from '@/lib/server/battleService';
import { getDatabase } from '@/lib/server/database';
import { getUserById } from '@/lib/server/userRepo';

/**
 * POST /api/attack
 * Initiate a battle with another player
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
    
    console.log(`⚔️ Attack API: User ${session.userId} attacking user ${targetUserId}`);
    
    // Get cache manager and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute with user lock
    const battle = await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      // Get attacker from cache
      let attacker = cacheManager.getUserUnsafe(session.userId!, userCtx);
      
      if (!attacker) {
        // Load attacker from database
        const db = await getDatabase();
        attacker = await getUserById(db, session.userId!);
        if (!attacker) {
          throw new ApiError(404, 'Attacker not found');
        }
        cacheManager.setUserUnsafe(attacker, userCtx);
      }
      
      // Get target from cache
      let target = cacheManager.getUserUnsafe(targetUserId, userCtx);
      
      if (!target) {
        // Load target from database
        const db = await getDatabase();
        target = await getUserById(db, targetUserId);
        if (!target) {
          throw new ApiError(404, 'Target user not found');
        }
        cacheManager.setUserUnsafe(target, userCtx);
      }
      
      // Initiate the battle
      return await initiateBattle(attacker, target);
    });
    
    console.log(`✅ Battle ${battle.id} initiated successfully`);
    
    return NextResponse.json({
      success: true,
      battle
    });
    
  } catch (error) {
    console.error('❌ Attack API error:', error);
    return handleApiError(error);
  }
}

