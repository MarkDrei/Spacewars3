import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
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
    
    // Try to parse JSON body with proper error handling
    let body;
    try {
      const rawBody = await request.text();
      console.log(`📨 Raw request body: "${rawBody}"`);
      
      if (!rawBody || rawBody.trim() === '') {
        throw new ApiError(400, 'Request body is empty');
      }
      
      body = JSON.parse(rawBody);
    } catch (jsonError) {
      console.log(`❌ JSON parsing error:`, jsonError);
      throw new ApiError(400, 'Invalid JSON in request body');
    }
    
    const { objectId } = body;
    
    console.log(`🎯 Collection API called for object ID: ${objectId} by user: ${session.userId}`);
    
    if (!objectId || typeof objectId !== 'number') {
      console.log(`❌ Invalid object ID: ${objectId}`);
      throw new ApiError(400, 'Missing or invalid object ID');
    }
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    console.log(`📋 Typed cache manager obtained`);
    
    await cacheManager.initialize();
    console.log(`✅ Typed cache manager initialized`);
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute collection with compile-time guaranteed deadlock-free lock ordering:
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
            
            // Continue with collection logic
            return await performCollectionLogic(world, user, objectId, cacheManager, userCtx);
          });
        } else {
          // Continue with collection logic directly
          return await performCollectionLogic(world, user, objectId, cacheManager, userCtx);
        }
      });
    });
  } catch (error) {
    console.log(`❌ Collection API error:`, error);
    return handleApiError(error);
  }
}

/**
 * Perform the actual collection logic with proper lock context
 * This function requires world write and user locks to be held
 */
async function performCollectionLogic(
  world: World,
  user: User, 
  objectId: number,
  cacheManager: TypedCacheManager,
  userCtx: UserContext
): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(currentTime);
  
  // Find the object to collect
  const targetObject = world.getSpaceObject(objectId);
  if (!targetObject) {
    throw new ApiError(404, 'Object not found');
  }
  
  // Check if object is collectible
  if (targetObject.type === 'player_ship') {
    throw new ApiError(400, 'Cannot collect player ships');
  }
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }
  
  // Calculate distance between player ship and target object using toroidal distance
  const distance = calculateToroidalDistance(
    playerShip,
    targetObject,
    world.worldSize
  );
  
  // Check if within collection range (125 units)
  if (distance > 125) {
    throw new ApiError(400, 'Object too far away');
  }
  
  // Capture iron before collection
  const ironBefore = user.iron;
  
  // Collect the object
  user.collected(targetObject.type);
  await world.collected(objectId);
  
  // Calculate iron reward
  const ironReward = user.iron - ironBefore;
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateUserUnsafe(user, userCtx);
  cacheManager.updateWorldUnsafe(world, userCtx);
  
  return NextResponse.json({ 
    success: true, 
    distance,
    ironReward,
    totalIron: user.iron,
    objectType: targetObject.type,
    message: 'Collection completed successfully'
  });
}
