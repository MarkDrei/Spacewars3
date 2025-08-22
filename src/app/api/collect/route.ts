import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { getCacheManager } from '@/lib/server/cacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

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
    
    // Get cache manager and initialize
    const cacheManager = getCacheManager();
    console.log(`📋 Cache manager obtained`);
    
    await cacheManager.initialize();
    console.log(`✅ Cache manager initialized`);
    
    console.log(`📚 Loading user and world data before locking...`);
    
    // Load user and world data from cache BEFORE acquiring locks
    const user = await cacheManager.getUser(session.userId!);
    if (!user) {
      console.log(`❌ User ${session.userId} not found in cache`);
      throw new ApiError(404, 'User not found');
    }
    console.log(`✅ User loaded: ${user.username} (ID: ${user.id})`);
    
    const world = await cacheManager.getWorld();
    console.log(`✅ World loaded with ${world.spaceObjects.length} objects`);
    
    // Use write lock for world to prevent race conditions during collection
    const worldLock = cacheManager.getWorldLock();
    const userMutex = await cacheManager.getUserMutex(session.userId!);
    
    console.log(`🔒 Locks obtained, starting collection process`);
    
    // Execute collection with proper locking to prevent race conditions
    return await worldLock.write(async () => {
      console.log(`🌍 World lock acquired`);
      return await userMutex.acquire(async () => {
        console.log(`👤 User mutex acquired`);
        
        // Update physics for all objects first
        const currentTime = Date.now();
        console.log(`🏃 Updating physics for timestamp: ${currentTime}`);
        world.updatePhysics(currentTime);
        console.log(`✅ Physics updated`);
        
        // Find the object to collect
        const targetObject = world.getSpaceObject(objectId);
        if (!targetObject) {
          console.log(`❌ Object ${objectId} not found in world`);
          throw new ApiError(404, 'Object not found');
        }
        
        console.log(`✅ Found target object: ${targetObject.type} at (${targetObject.x}, ${targetObject.y})`);
        
        // Check if object is collectible
        if (targetObject.type === 'player_ship') {
          throw new ApiError(400, 'Cannot collect player ships');
        }
        
        // Find player's ship in the world
        const playerShips = world.getSpaceObjectsByType('player_ship');
        const playerShip = playerShips.find(ship => ship.id === user.ship_id);
        
        if (!playerShip) {
          console.log(`❌ Player ship ${user.ship_id} not found in world`);
          throw new ApiError(404, 'Player ship not found');
        }
        
        console.log(`✅ Found player ship at (${playerShip.x}, ${playerShip.y})`);
        
        // Calculate distance between player ship and target object using toroidal distance
        const distance = calculateToroidalDistance(
          playerShip,
          targetObject,
          world.worldSize
        );
        
        console.log(`📏 Distance to target: ${distance.toFixed(2)} units (max: 125)`);
        
        // Check if within collection range (125 units)
        if (distance > 125) {
          console.log(`❌ Object too far away: ${distance.toFixed(2)} > 125`);
          throw new ApiError(400, 'Object too far away');
        }
        
        // Capture iron before collection
        const ironBefore = user.iron;
        
        console.log(`🎯 Starting collection process - iron before: ${ironBefore}`);
        
        // Collect the object
        user.collected(targetObject.type);
        await world.collected(objectId);
        
        // Calculate iron reward
        const ironReward = user.iron - ironBefore;
        
        console.log(`✅ Collection complete! Iron reward: ${ironReward}, Total iron: ${user.iron}`);
        
        // Save changes via cache manager (will persist periodically)
        await cacheManager.updateUser(user);
        await cacheManager.updateWorld(world);
        
        console.log(`💾 Cache updated successfully`);
        
        return NextResponse.json({ 
          success: true, 
          distance,
          ironReward,
          totalIron: user.iron,
          objectType: targetObject.type
        });
      });
    });
  } catch (error) {
    console.log(`❌ Collection API error:`, error);
    return handleApiError(error);
  }
}
