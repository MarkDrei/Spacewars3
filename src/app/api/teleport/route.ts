import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext, LockContext, Locked, CacheLevel, WorldLevel, UserLevel } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user';
import { World } from '@/lib/server/world';

// Type aliases for cleaner code
type UserContext = LockContext<Locked<'user'>, CacheLevel | WorldLevel | UserLevel>;

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { targetX, targetY } = body;
    
    // Validate input parameters
    if (targetX === undefined || targetY === undefined) {
      throw new ApiError(400, 'Must provide targetX and targetY coordinates');
    }
    
    if (typeof targetX !== 'number' || typeof targetY !== 'number') {
      throw new ApiError(400, 'Coordinates must be numbers');
    }
    
    if (isNaN(targetX) || isNaN(targetY)) {
      throw new ApiError(400, 'Coordinates must be valid numbers');
    }
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute teleportation with compile-time guaranteed deadlock-free lock ordering:
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
            
            // Continue with teleportation logic
            return await performTeleportLogic(world, user, targetX, targetY, cacheManager, userCtx);
          });
        } else {
          // Continue with teleportation logic directly
          return await performTeleportLogic(world, user, targetX, targetY, cacheManager, userCtx);
        }
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the actual teleportation logic with proper lock context
 * This function requires world write and user locks to be held
 */
async function performTeleportLogic(
  world: World,
  user: User,
  targetX: number,
  targetY: number,
  cacheManager: TypedCacheManager,
  userCtx: UserContext
): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(currentTime);
  
  // Check teleport research level
  const teleportLevel = user.techTree.teleport;
  if (teleportLevel === 0) {
    throw new ApiError(400, 'Teleportation not researched');
  }
  
  // Calculate teleport range based on research level
  const teleportRange = getResearchEffectFromTree(user.techTree, ResearchType.Teleport);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }
  
  // Store initial position for response
  const initialX = playerShip.x;
  const initialY = playerShip.y;
  
  // Validate target coordinates are within world bounds
  const worldWidth = world.worldSize.width;
  const worldHeight = world.worldSize.height;
  
  if (targetX < 0 || targetX >= worldWidth || targetY < 0 || targetY >= worldHeight) {
    throw new ApiError(400, `Target coordinates out of world bounds (0-${worldWidth}, 0-${worldHeight})`);
  }
  
  // Calculate distance using toroidal distance
  const distance = calculateToroidalDistance(
    { x: playerShip.x, y: playerShip.y },
    { x: targetX, y: targetY },
    world.worldSize
  );
  
  // Check if within teleport range
  if (distance > teleportRange) {
    throw new ApiError(400, `Target out of range (${distance.toFixed(1)} > ${teleportRange.toFixed(1)})`);
  }
  
  // Perform teleportation - update ship position
  playerShip.x = targetX;
  playerShip.y = targetY;
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
    teleportation: {
      from: { x: initialX, y: initialY },
      to: { x: targetX, y: targetY },
      distance: distance,
      maxRange: teleportRange
    },
    message: 'Teleportation completed successfully'
  });
}
