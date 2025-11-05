// ---
// TypeScript Compile-Time Deadlock Prevention System
// Phase 3: Typed Navigation API - Demonstrating Safe Lock Ordering
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache, type UserWorldCache, type UserContext } from '@/lib/server/world/userWorldCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createLockContext } from '@/lib/server/typedLocks';
import type { User } from '@/lib/server/world/user';
import type { World } from '@/lib/server/world/world';

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
    
    console.log(`🧭 [TYPED] Navigation API called - speed: ${speed}, angle: ${angle} by user: ${session.userId}`);
    
    // Get typed cache manager singleton
    const cacheManager = getUserWorldCache();
    console.log(`✅ [TYPED] Typed cache manager ready for navigation`);
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    console.log(`🏁 [TYPED] Starting navigation with compile-time safe lock ordering`);
    
    // Execute navigation with compile-time guaranteed deadlock-free lock ordering:
    // World Write (1) → User (2) → Database Read (3) if needed
    const worldCtx = await cacheManager.acquireWorldWrite(emptyCtx);
    try {
      console.log(`🌍 [TYPED] World write lock acquired for navigation`);
      
      const userCtx = await cacheManager.acquireUserLock(worldCtx);
      try {
        console.log(`👤 [TYPED] User lock acquired for navigation`);
        
        // Get world data safely (we have world write lock)
        const world = cacheManager.getWorldFromCache(userCtx);
        console.log(`✅ [TYPED] World loaded with ${world.spaceObjects.length} objects`);
        // Get user data safely (we have user lock)
        let user = cacheManager.getUserByIdFromCache(session.userId!, userCtx);
        
        if (!user) {
          // Load user from database if not in cache
          console.log(`🔄 [TYPED] User ${session.userId} not in cache, loading from database...`);
          
          const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
          try {
            console.log(`💾 [TYPED] Database read lock acquired for user loading`);
            
            user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
            if (!user) {
              console.log(`❌ [TYPED] User ${session.userId} not found in database`);
              throw new ApiError(404, 'User not found');
            }
            
            // Cache the loaded user
            cacheManager.setUserUnsafe(user, userCtx);
            console.log(`✅ [TYPED] User loaded and cached: ${user.username} (ID: ${user.id})`);
          } finally {
            dbCtx.dispose();
          }
        } else {
          console.log(`✅ [TYPED] User found in cache: ${user.username} (ID: ${user.id})`);
        }
        
        // Continue with navigation logic
        return await performNavigationLogic(world, user, speed, angle, cacheManager, userCtx);
      } finally {
        userCtx.dispose();
      }
    } finally {
      worldCtx.dispose();
    }
  } catch (error) {
    console.log(`❌ [TYPED] Navigation API error:`, error);
    return handleApiError(error);
  }
}

/**
 * Perform the navigation logic on the cached user and world
 * This function requires world write and user locks to be held
 */
async function performNavigationLogic(
  world: World,
  user: User,
  speed: number | undefined,
  angle: number | undefined,
  cacheManager: UserWorldCache,
  userCtx: UserContext
): Promise<NextResponse> {
  console.log(`🧭 [TYPED] Starting navigation logic with proper lock context`);
  
  // Update physics for all objects first
  const currentTime = Date.now();
  console.log(`🏃 [TYPED] Updating physics for timestamp: ${currentTime}`);
  world.updatePhysics(currentTime);
  console.log(`✅ [TYPED] Physics updated`);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    console.log(`❌ [TYPED] Player ship ${user.ship_id} not found in world`);
    throw new ApiError(404, 'Player ship not found');
  }
  
  console.log(`✅ [TYPED] Found player ship at (${playerShip.x}, ${playerShip.y})`);
  
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
      console.log(`❌ [TYPED] Invalid speed: ${speed} (max: ${maxSpeed})`);
      throw new ApiError(400, `Speed must be between 0 and ${maxSpeed}`);
    }
    
    playerShip.speed = speed;
    console.log(`🚀 [TYPED] Ship speed updated: ${initialSpeed} → ${speed} (max: ${maxSpeed})`);
  }
  
  if (angle !== undefined) {
    // Normalize angle to 0-360 range
    let normalizedAngle = angle % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;
    
    playerShip.angle = normalizedAngle;
    console.log(`🧭 [TYPED] Ship angle updated: ${initialAngle} → ${normalizedAngle}`);
  }
  
  // Update last position update timestamp
  playerShip.last_position_update_ms = currentTime;
  
  console.log(`✅ [TYPED] Navigation complete - ship at (${playerShip.x}, ${playerShip.y}), speed: ${playerShip.speed}, angle: ${playerShip.angle}`);
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateWorldUnsafe(world, userCtx);
  
  console.log(`💾 [TYPED] World cache updated successfully with compile-time safety`);
  
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
    message: 'Navigation completed with typed lock system'
  });
}
