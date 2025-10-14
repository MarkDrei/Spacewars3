// ---
// Attack API - Initiate battle with another player
// POST /api/attack
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError, requireAuth } from '@/lib/server/errors';
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
    
    // Load both users directly from database
    // Do NOT hold locks while calling initiateBattle as it needs to access the database
    console.log(`⚔️ Step 1: Getting database...`);
    const db = await getDatabase();
    console.log(`⚔️ Step 2: Database obtained, loading attacker...`);
    
    // Import lock context utilities
    const { createEmptyContext } = await import('@/lib/server/ironGuardSystem');
    const emptyCtx = createEmptyContext();
    
    const attacker = await getUserById(db, session.userId!, emptyCtx);
    if (!attacker) {
      throw new ApiError(404, 'Attacker not found');
    }
    console.log(`⚔️ Step 3: Attacker loaded, loading target...`);
    
    const target = await getUserById(db, targetUserId, emptyCtx);
    if (!target) {
      throw new ApiError(404, 'Target user not found');
    }
    console.log(`⚔️ Step 4: Target loaded, initiating battle...`);
    
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

