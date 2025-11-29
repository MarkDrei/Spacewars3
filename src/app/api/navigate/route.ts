import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World } from '@/lib/server/world/world';
import { createLockContext, LockContext, LocksAtMostAndHas4, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';
import { WorldCache } from '@/lib/server/world/worldCache';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { speed, angle } = body;
    
    // Must provide at least one parameter
    if (speed === undefined && angle === undefined) {
      throw new ApiError(400, 'Must provide speed and/or angle');
    }
    
    const emptyCtx = createLockContext();
    // Get typed cache manager singleton
    const userWorldCache = UserCache.getInstance2();
    
    const worldCache = WorldCache.getInstance();
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
        // Get world data safely (we have world write lock)
        const world = worldCache.getWorldFromCache(worldContext);
        
        // Get user data safely (we have user lock)  
        const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);

        if (!user) {
          console.log(`❌ User not found: ${session.userId}`);
          throw new ApiError(404, 'User not found');
        }
        
        // Continue with navigation logic
        return await performNavigationLogic(worldContext, userContext, world, user, speed, angle);

      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the actual navigation logic with proper lock context
 * This function requires world write and user locks to be held
 */
async function performNavigationLogic(
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User,
  speed: number | undefined,
  angle: number | undefined
): Promise<NextResponse> {
  const worldCache = WorldCache.getInstance();
  // Check if user is in battle - cannot navigate while in battle
  if (user.inBattle) {
    throw new ApiError(400, 'Cannot navigate while in battle');
  }
  
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }
  
  // Store initial values for response
  const initialSpeed = playerShip.speed;
  const initialAngle = playerShip.angle;
  
  // Update ship properties
  if (speed !== undefined) {
    // Apply research speed bonuses
    const speedMultiplier = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    const maxSpeed = 5 * speedMultiplier;
    
    // Validate speed
    if (speed < 0 || speed > maxSpeed) {
      throw new ApiError(400, `Speed must be between 0 and ${maxSpeed}`);
    }
    
    playerShip.speed = speed;
  }
  
  if (angle !== undefined) {
    // Normalize angle to 0-360 range
    let normalizedAngle = angle % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;
    
    playerShip.angle = normalizedAngle;
  }
  
  // Update last position update timestamp
  playerShip.last_position_update_ms = currentTime;
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  worldCache.updateWorldUnsafe(worldContext, world);
  
  return NextResponse.json({ 
    success: true,
    ship: {
      id: playerShip.id,
      x: playerShip.x,
      y: playerShip.y,
      speed: playerShip.speed,
      angle: playerShip.angle,
      lastUpdate: playerShip.last_position_update_ms
    },
    changes: {
      speed: speed !== undefined ? { from: initialSpeed, to: playerShip.speed } : null,
      angle: angle !== undefined ? { from: initialAngle, to: playerShip.angle } : null
    },
    message: 'Navigation completed successfully'
  });
}
