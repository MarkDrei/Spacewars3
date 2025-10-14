import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext, LockContext, Locked, CacheLevel, WorldLevel, UserLevel } from '@/lib/server/ironGuardSystem';
import { User } from '@/lib/server/user';
import { World } from '@/lib/server/world';

// Type aliases for cleaner code
type UserContext = LockContext<Locked<'user'>, CacheLevel | WorldLevel | UserLevel>;

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
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute navigation with compile-time guaranteed deadlock-free lock ordering:
    // World Write (1) → User (2) → Database Read (3) if needed
    return await cacheManager.withWorldWrite(emptyCtx, async (worldCtx) => {
      return await cacheManager.withUserLock(worldCtx, async (userCtx) => {
        // Get world data safely (we have world write lock)
        const world = cacheManager.getWorldUnsafe(userCtx);
        
        // Get user data safely (we have user lock)
        let user = cacheManager.getUserUnsafe(session.userId!, userCtx);
        
        if (!user) {
          // Load user from database if not in cache
          return await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
            user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
            if (!user) {
              throw new ApiError(404, 'User not found');
            }
            
            // Cache the loaded user
            cacheManager.setUserUnsafe(user, userCtx);
            
            // Continue with navigation logic
            return await performNavigationLogic(world, user, speed, angle, cacheManager, userCtx);
          });
        } else {
          // Continue with navigation logic directly
          return await performNavigationLogic(world, user, speed, angle, cacheManager, userCtx);
        }
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
  world: World,
  user: User,
  speed: number | undefined,
  angle: number | undefined,
  cacheManager: TypedCacheManager,
  userCtx: UserContext
): Promise<NextResponse> {
  // Check if user is in battle - cannot navigate while in battle
  if (user.inBattle) {
    throw new ApiError(400, 'Cannot navigate while in battle');
  }
  
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(currentTime);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
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
  cacheManager.updateWorldUnsafe(world, userCtx);
  
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
