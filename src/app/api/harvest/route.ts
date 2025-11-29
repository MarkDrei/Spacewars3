import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { UserCache } from '@/lib/server/user/userCache';
import { getMessageCache } from '@/lib/server/messages/MessageCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/user/user';
import { World } from '@/lib/server/world/world';
import { WorldCache } from '@/lib/server/world/worldCache';
import { createLockContext, LockContext, LocksAtMostAndHas4, LocksAtMostAndHas6 } from '@markdrei/ironguard-typescript-locks';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Try to parse JSON body with proper error handling
    let body;
    try {
      const rawBody = await request.text();
      
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
        
        // Continue with collection logic
        return await performCollectionLogic(worldContext, userContext, world, user, objectId, userWorldCache);

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
  worldContext: LockContext<LocksAtMostAndHas6>,
  userCtx: LockContext<LocksAtMostAndHas4>,
  world: World,
  user: User, 
  objectId: number,
  userWorldCache: UserCache,
): Promise<NextResponse> {
  const worldCache = WorldCache.getInstance();
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(worldContext, currentTime);
  
  // Find the object to collect
  const targetObject = world.getSpaceObject(worldContext, objectId);
  if (!targetObject) {
    throw new ApiError(404, 'Object not found');
  }
  
  // Check if object is collectible
  if (targetObject.type === 'player_ship') {
    throw new ApiError(400, 'Cannot collect player ships');
  }
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType(worldContext, 'player_ship');
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
  await world.collected(worldContext, objectId);
  
  // Calculate iron reward
  const ironReward = user.iron - ironBefore;
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  userWorldCache.updateUserInCache(userCtx, user);
  worldCache.updateWorldUnsafe(worldContext, world);
  
  // Create notification message for the collection
  let notificationMessage = '';
  if (ironReward > 0) {
    notificationMessage = `P: Successfully collected ${targetObject.type.replace('_', ' ')} and received **${ironReward}** iron.`;
  } else {
    notificationMessage = `P: Successfully collected ${targetObject.type.replace('_', ' ')}.`;
  }
  
  console.log(`📝 Creating notification for user ${user.id}: "${notificationMessage}"`);
  
  // Send notification to user (async, doesn't block response)
  getMessageCache().createMessage(user.id, notificationMessage).catch((error: Error) => {
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
