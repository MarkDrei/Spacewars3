// ---
// Attack API - Initiate battle with another player
// POST /api/attack
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError, requireAuth } from '@/lib/server/errors';
import { initiateBattle } from '@/lib/server/battle/battleService';
import { getUserWorldCache } from '@/lib/server/world/userWorldCache';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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
    
    const cacheManager = getUserWorldCache();
    
    const attacker = await cacheManager.getUserById(session.userId!);
    if (!attacker) {
      throw new ApiError(404, 'Attacker not found');
    }

    // Load target from cache
    const target = await cacheManager.getUserById(targetUserId);
    if (!target) {
      throw new ApiError(404, 'Target user not found');
    }

    console.log(`⚔️ Attack API: Both users loaded, initiating battle...`);
    
    // Initiate the battle - this will handle its own locking internally
    const battle = await initiateBattle(attacker, target);
    
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

