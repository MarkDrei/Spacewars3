import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { getUserWorldCache, UserWorldCache } from '@/lib/server/world/userWorldCache';
import { sendMessageToUser } from '@/lib/server/messages/MessageCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { DATABASE_LOCK,  createLockContext, type LockContext as IronGuardLockContext, USER_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/world/user';
import { World } from '@/lib/server/world/world';

// Type alias for user context
type UserContext = IronGuardLockContext<readonly [typeof USER_LOCK]>;

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
    
    // Get typed cache manager singleton
    const cacheManager = getUserWorldCache();
    console.log(`📋 Typed cache manager obtained`);
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    // Execute collection with compile-time guaranteed deadlock-free lock ordering:
    // World Write (1) → User (2) → Database Read (3) if needed
    const worldCtx = await cacheManager.acquireWorldWrite(emptyCtx);
    try {
      const userCtx = await cacheManager.acquireUserLock(worldCtx);
      try {
        // Get world data safely (we have world write lock)
        const world = cacheManager.getWorldFromCache(userCtx);
        
        // Get user data safely (we have user lock)  
        let user = cacheManager.getUserByIdFromCache(session.userId!, userCtx);
        
        if (!user) {
          // Load user from database if not in cache
          const dbCtx = await userCtx.acquireRead(DATABASE_LOCK);
          try {
            user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
            if (!user) {
              throw new ApiError(404, 'User not found');
            }
            
            // Cache the loaded user
            cacheManager.setUserUnsafe(user, userCtx);
          } finally {
            dbCtx.dispose();
          }
        }
        
        // Continue with collection logic
        return await performCollectionLogic(world, user, objectId, cacheManager, userCtx);
      } finally {
        userCtx.dispose();
      }
    } finally {
      worldCtx.dispose();
    }
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
  cacheManager: UserWorldCache,
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
  cacheManager.updateUserInCache(user, userCtx);
  cacheManager.updateWorldUnsafe(world, userCtx);
  
  // Create notification message for the collection
  let notificationMessage = '';
  if (ironReward > 0) {
    notificationMessage = `P: Successfully collected ${targetObject.type.replace('_', ' ')} and received **${ironReward}** iron.`;
  } else {
    notificationMessage = `P: Successfully collected ${targetObject.type.replace('_', ' ')}.`;
  }
  
  console.log(`📝 Creating notification for user ${user.id}: "${notificationMessage}"`);
  
  // Send notification to user (async, doesn't block response)
  sendMessageToUser(user.id, notificationMessage).catch((error: Error) => {
    console.error('❌ Failed to send collection notification:', error);
  });
  
  return NextResponse.json({ 
    success: true, 
    distance,
    ironReward,
    totalIron: user.iron,
    objectType: targetObject.type,
    message: 'Collection completed successfully'
  });
}
