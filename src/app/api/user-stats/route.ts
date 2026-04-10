import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { createLockContext, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const emptyCtx = createLockContext();
    // Get typed cache manager singleton
    const userWorldCache = UserCache.getInstance2();
    
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Get user data safely (we have user lock)
      const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
      
      if (!user) {
        console.log(`❌ User not found: ${session.userId}`);
        throw new ApiError(404, 'User not found');
      }
      
      // Continue with user stats logic
      return await processUserStats(user, userWorldCache, userContext);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function processUserStats(user: User, userWorldCache: UserCache, userCtx: LockContext<LocksAtMostAndHas4>): Promise<NextResponse> {
  const now = Math.floor(Date.now() / 1000);
  // Fetch bonuses (cache hit — already computed by getUserByIdWithLock)
  const bonuses = await UserBonusCache.getInstance().getBonuses(userCtx, user.id);
  user.updateStats(now, bonuses);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  userWorldCache.updateUserInCache(userCtx, user);
  
  const responseData = { 
    iron: user.iron, 
    ironPerSecond: bonuses.ironRechargeRate,
    last_updated: user.last_updated,
    maxIronCapacity: bonuses.ironStorageCapacity,
    xp: user.xp,
    level: user.getLevel(),
    xpForNextLevel: user.getXpForNextLevel(),
    score: user.score,
    timeMultiplier: TimeMultiplierService.getInstance().getMultiplier(),
    teleportCharges: user.teleportCharges,
    teleportMaxCharges: getResearchEffectFromTree(user.techTree, ResearchType.Teleport),
    teleportRechargeTimeSec: getResearchEffectFromTree(user.techTree, ResearchType.TeleportRechargeSpeed),
    teleportRechargeSpeed: user.techTree.teleportRechargeSpeed,
    // Bonus system fields
    levelMultiplier: bonuses.levelMultiplier,
    maxShipSpeed: bonuses.maxShipSpeed,  // theoretical max from research + bonuses
    currentMaxShipSpeed: user.getCurrentMaxShipSpeed(bonuses),  // current actual max (affected by damage, etc.)
    hullRepairSpeed: bonuses.hullRepairSpeed,
    armorRepairSpeed: bonuses.armorRepairSpeed,
    shieldRechargeRate: bonuses.shieldRechargeRate,
    projectileWeaponDamageFactor: bonuses.projectileWeaponDamageFactor,
    projectileWeaponReloadFactor: bonuses.projectileWeaponReloadFactor,
    projectileWeaponAccuracyFactor: bonuses.projectileWeaponAccuracyFactor,
    energyWeaponDamageFactor: bonuses.energyWeaponDamageFactor,
    energyWeaponReloadFactor: bonuses.energyWeaponReloadFactor,
    energyWeaponAccuracyFactor: bonuses.energyWeaponAccuracyFactor,
  };
  
  return NextResponse.json(responseData);
}
