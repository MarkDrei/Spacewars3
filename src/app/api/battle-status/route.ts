// ---
// Battle Status API - Get current battle state
// GET /api/battle-status
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError, requireAuth } from '@/lib/server/errors';
import { BattleRepo } from '@/lib/server/battleRepo';

/**
 * GET /api/battle-status
 * Get current battle state for the authenticated user
 * 
 * Returns: 
 * - If in battle: { inBattle: true, battle: Battle }
 * - If not in battle: { inBattle: false }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    console.log(`🔍 Battle Status API: Checking battle for user ${session.userId}`);
    
    // Check if user has an ongoing battle
    // Handle case where battles table might not exist yet (graceful degradation)
    let battle;
    try {
      battle = await BattleRepo.getOngoingBattleForUser(session.userId!);
    } catch (dbError) {
      // If table doesn't exist, just return not in battle
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      if (errorMessage.includes('no such table: battles')) {
        console.log(`⚠️ Battles table doesn't exist yet, returning not in battle`);
        return NextResponse.json({
          inBattle: false
        });
      }
      throw dbError; // Re-throw if it's a different error
    }
    
    if (!battle) {
      return NextResponse.json({
        inBattle: false
      });
    }
    
    console.log(`⚔️ User ${session.userId} is in battle ${battle.id}`);
    
    // Determine if user is attacker or attackee
    const isAttacker = battle.attackerId === session.userId;
    
    // Get weapon cooldowns for the user
    const weaponCooldowns = isAttacker 
      ? battle.attackerWeaponCooldowns 
      : battle.attackeeWeaponCooldowns;
    
    // Get current stats for the user
    const myStats = isAttacker 
      ? battle.attackerStartStats 
      : battle.attackeeStartStats;
    
    const opponentStats = isAttacker 
      ? battle.attackeeStartStats 
      : battle.attackerStartStats;
    
    return NextResponse.json({
      inBattle: true,
      battle: {
        id: battle.id,
        isAttacker,
        opponentId: isAttacker ? battle.attackeeId : battle.attackerId,
        battleStartTime: battle.battleStartTime,
        battleEndTime: battle.battleEndTime,
        winnerId: battle.winnerId,
        loserId: battle.loserId,
        myStats,
        opponentStats,
        weaponCooldowns,
        battleLog: battle.battleLog,
        myTotalDamage: isAttacker ? battle.attackerTotalDamage : battle.attackeeTotalDamage,
        opponentTotalDamage: isAttacker ? battle.attackeeTotalDamage : battle.attackerTotalDamage
      }
    });
    
  } catch (error) {
    console.error('❌ Battle Status API error:', error);
    return handleApiError(error);
  }
}
