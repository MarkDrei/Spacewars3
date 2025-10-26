// ---
// Attack API - Initiate battle with another player
// POST /api/attack
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError, requireAuth } from '@/lib/server/errors';
import { initiateBattle } from '@/lib/server/battleService';

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
    
    // Load both users from cache (which ensures proper state management)
    console.log(`⚔️ Step 1: Loading users from cache...`);
    const { getTypedCacheManager } = await import('@/lib/server/typedCacheManager');
    const cacheManager = getTypedCacheManager();
    
    // Load attacker from cache
    const attacker = await cacheManager.loadUserIfNeeded(session.userId!);
    if (!attacker) {
      throw new ApiError(404, 'Attacker not found');
    }
    console.log(`⚔️ Step 2: Attacker loaded, loading target...`);
    
    // Load target from cache
    const target = await cacheManager.loadUserIfNeeded(targetUserId);
    if (!target) {
      throw new ApiError(404, 'Target user not found');
    }
    console.log(`⚔️ Step 3: Both users loaded, updating defense values...`);
    
    // Update defense values with regeneration before battle starts
    const now = Math.floor(Date.now() / 1000);
    attacker.updateDefenseValues(now);
    target.updateDefenseValues(now);
    console.log(`⚔️ Step 4: Defense values updated, initiating battle...`);
    
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

