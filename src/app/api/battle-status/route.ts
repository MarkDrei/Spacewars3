// ---
// Battle Status API - Get current battle state
// GET /api/battle-status
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { getOngoingBattleForUser } from '@/lib/server/battle/BattleCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK } from '@/lib/server/typedLocks';

/**
 * GET /api/battle-status
 * Get current battle state for the authenticated user
 * 
 * Returns ONLY battle state (not user stats - use /api/user-stats for that)
 * - If in battle: { inBattle: true, battle: { id, isAttacker, opponentId, cooldowns, log, damage, timestamps } }
 * - If not in battle: { inBattle: false }
 * 
 * Note: BattleCache handles locking internally with READ lock
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    console.log(`🔍 Battle Status API: Checking battle for user ${session.userId}`);
    
    // Get battle from cache
    const emptyCtx = createLockContext();
    return await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (context) => {
      const battle = await getOngoingBattleForUser(context, session.userId!);
      
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
          weaponCooldowns,
          battleLog: battle.battleLog,
          myTotalDamage: isAttacker ? battle.attackerTotalDamage : battle.attackeeTotalDamage,
          opponentTotalDamage: isAttacker ? battle.attackeeTotalDamage : battle.attackerTotalDamage
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Battle Status API error:', error);
    return handleApiError(error);
  }
}
