// ---
// TypeScript Compile-Time Deadlock Prevention System
// Phase 3: Typed Collection API - Demonstrating Safe Lock Ordering
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { getTypedCacheManager, type TypedCacheManager } from '@/lib/server/typedCacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext } from '@/lib/server/ironGuard';
import type { User } from '@/lib/server/user';
import type { World } from '@/lib/server/world';

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
    
    console.log(`🎯 [TYPED] Collection API called for object ID: ${objectId} by user: ${session.userId}`);
    
    if (!objectId || typeof objectId !== 'number') {
      console.log(`❌ Invalid object ID: ${objectId}`);
      throw new ApiError(400, 'Missing or invalid object ID');
    }
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    console.log(`📋 [TYPED] Typed cache manager obtained`);
    
    await cacheManager.initialize();
    console.log(`✅ [TYPED] Typed cache manager initialized`);
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    console.log(`🏁 [TYPED] Starting collection with compile-time safe lock ordering`);
    
    // Execute collection with compile-time guaranteed deadlock-free lock ordering:
    // World Write (1) → User (2) → Database Read (3) if needed
    return await cacheManager.withWorldWrite(emptyCtx, async (worldCtx) => {
      console.log(`🌍 [TYPED] World write lock acquired`);
      
      return await cacheManager.withUserLock(worldCtx, async (userCtx) => {
        console.log(`👤 [TYPED] User lock acquired`);
        
        // Get world data safely (we have world write lock)
        const world = cacheManager.getWorldUnsafe(userCtx);
        console.log(`✅ [TYPED] World loaded with ${world.spaceObjects.length} objects`);
        
        // Get user data safely (we have user lock)  
        let user = cacheManager.getUserUnsafe(session.userId!, userCtx);
        
        if (!user) {
          // Load user from database if not in cache
          console.log(`🔄 [TYPED] User ${session.userId} not in cache, loading from database...`);
          
          return await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
            console.log(`💾 [TYPED] Database read lock acquired`);
            
            user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
            if (!user) {
              console.log(`❌ [TYPED] User ${session.userId} not found in database`);
              throw new ApiError(404, 'User not found');
            }
            
            // Cache the loaded user
            cacheManager.setUserUnsafe(user, userCtx);
            console.log(`✅ [TYPED] User loaded and cached: ${user.username} (ID: ${user.id})`);
            
            // Continue with collection logic
            return await performCollectionLogic(world, user, objectId, cacheManager, userCtx);
          });
        } else {
          console.log(`✅ [TYPED] User found in cache: ${user.username} (ID: ${user.id})`);
          
          // Continue with collection logic directly
          return await performCollectionLogic(world, user, objectId, cacheManager, userCtx);
        }
      });
    });
  } catch (error) {
    console.log(`❌ [TYPED] Collection API error:`, error);
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
  userCtx: Parameters<Parameters<TypedCacheManager['withUserLock']>[1]>[0]
): Promise<NextResponse> {
  console.log(`🎯 [TYPED] Starting collection logic with proper lock context`);
  
  // Update physics for all objects first
  const currentTime = Date.now();
  console.log(`🏃 [TYPED] Updating physics for timestamp: ${currentTime}`);
  world.updatePhysics(currentTime);
  console.log(`✅ [TYPED] Physics updated`);
  
  // Find the object to collect
  const targetObject = world.getSpaceObject(objectId);
  if (!targetObject) {
    console.log(`❌ [TYPED] Object ${objectId} not found in world`);
    throw new ApiError(404, 'Object not found');
  }
  
  console.log(`✅ [TYPED] Found target object: ${targetObject.type} at (${targetObject.x}, ${targetObject.y})`);
  
  // Check if object is collectible
  if (targetObject.type === 'player_ship') {
    throw new ApiError(400, 'Cannot collect player ships');
  }
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    console.log(`❌ [TYPED] Player ship ${user.ship_id} not found in world`);
    throw new ApiError(404, 'Player ship not found');
  }
  
  console.log(`✅ [TYPED] Found player ship at (${playerShip.x}, ${playerShip.y})`);
  
  // Calculate distance between player ship and target object using toroidal distance
  const distance = calculateToroidalDistance(
    playerShip,
    targetObject,
    world.worldSize
  );
  
  console.log(`📏 [TYPED] Distance to target: ${distance.toFixed(2)} units (max: 125)`);
  
  // Check if within collection range (125 units)
  if (distance > 125) {
    console.log(`❌ [TYPED] Object too far away: ${distance.toFixed(2)} > 125`);
    throw new ApiError(400, 'Object too far away');
  }
  
  // Capture iron before collection
  const ironBefore = user.iron;
  
  console.log(`🎯 [TYPED] Starting collection process - iron before: ${ironBefore}`);
  
  // Collect the object
  user.collected(targetObject.type);
  await world.collected(objectId);
  
  // Calculate iron reward
  const ironReward = user.iron - ironBefore;
  
  console.log(`✅ [TYPED] Collection complete! Iron reward: ${ironReward}, Total iron: ${user.iron}`);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateUserUnsafe(user, userCtx);
  cacheManager.updateWorldUnsafe(world, userCtx);
  
  console.log(`💾 [TYPED] Cache updated successfully with compile-time safety`);
  
  return NextResponse.json({ 
    success: true, 
    distance,
    ironReward,
    totalIron: user.iron,
    objectType: targetObject.type,
    message: 'Collection completed with typed lock system'
  });
}
