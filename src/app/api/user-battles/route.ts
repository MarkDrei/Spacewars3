import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { getBattleCacheInitialized } from '@/lib/server/battle/BattleCache';
import { getDatabase } from '@/lib/server/database';
import { Battle } from '@/lib/server/battle/battleTypes';

interface UserBasicInfo {
  id: number;
  username: string;
}

// Helper to get username by user ID
async function getUsernameById(userId: number): Promise<string> {
  const db = await getDatabase();
  
  const result = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) return 'Unknown User';
  return (result.rows[0] as UserBasicInfo).username;
}

// Helper to calculate battle duration in seconds
function calculateDuration(battle: Battle): number {
  if (!battle.battleEndTime) return 0;
  return Math.floor((battle.battleEndTime - battle.battleStartTime * 1000) / 1000);
}

// Transform battle data for client consumption
async function transformBattleData(battle: Battle, currentUserId: number) {
  const isAttacker = battle.attackerId === currentUserId;
  const opponentId = isAttacker ? battle.attackeeId : battle.attackerId;
  const opponentUsername = await getUsernameById(opponentId);
  
  const userDamage = isAttacker ? battle.attackerTotalDamage : battle.attackeeTotalDamage;
  const opponentDamage = isAttacker ? battle.attackeeTotalDamage : battle.attackerTotalDamage;
  
  const didWin = battle.winnerId === currentUserId;
  const duration = calculateDuration(battle);
  
  return {
    id: battle.id,
    opponentUsername,
    isAttacker,
    didWin,
    userDamage,
    opponentDamage,
    duration,
    battleStartTime: battle.battleStartTime,
    battleEndTime: battle.battleEndTime,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Fetch all battles for this user
    const cache = await getBattleCacheInitialized();
    const battles = await cache.getBattlesForUser(session.userId!);
    
    // Filter only completed battles and transform data
    const completedBattles = battles.filter(b => b.battleEndTime !== null);
    
    // Transform battles with opponent usernames
    const transformedBattles = await Promise.all(
      completedBattles.map(battle => transformBattleData(battle, session.userId!))
    );
    
    return NextResponse.json({
      battles: transformedBattles,
      totalBattles: transformedBattles.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
