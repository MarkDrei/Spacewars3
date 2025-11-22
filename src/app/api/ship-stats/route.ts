import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache } from '@/lib/server/user/userCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World } from '@/lib/server/world/world';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import { createLockContext, LockContext, LocksAtMostAndHas4, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const emptyCtx = createLockContext();
    
    // Get typed cache manager singleton
    const userWorldCache = await getUserWorldCache(emptyCtx);
    
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get world and user data safely (we have both locks)
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
        const world = userWorldCache.getWorldFromCache(worldContext);
        
        if (!user) {
          console.log(`❌ User not found: ${session.userId}`);
          throw new ApiError(404, 'User not found');
        }
        
        // Continue with ship stats logic
        return await getShipStats(worldContext, world, user);
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getShipStats(
  worldContext: LockContext<LocksAtMostAndHas6>,
  world: World, 
  user: User
): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);
  
  // Update defense values based on elapsed time since last regen
  const now = Math.floor(Date.now() / 1000);
  user.updateDefenseValues(now);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }
  
  // Calculate max speed from tech tree
  const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
  const afterburnerBonus = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
  const maxSpeed = baseSpeed * (1 + afterburnerBonus / 100);
  
  // Calculate defense values using actual current values from database
  const currentValues = {
    hull: user.hullCurrent,
    armor: user.armorCurrent,
    shield: user.shieldCurrent
  };
  const defenseValues = TechFactory.calculateDefenseValues(user.techCounts, currentValues);
  
  const responseData = {
    x: playerShip.x,
    y: playerShip.y,
    speed: playerShip.speed,
    angle: playerShip.angle,
    maxSpeed: maxSpeed,
    last_position_update_ms: playerShip.last_position_update_ms,
    defenseValues
  };
  
  return NextResponse.json(responseData);
}
