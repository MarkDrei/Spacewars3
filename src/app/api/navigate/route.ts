import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getCacheManager } from '@/lib/server/cacheManager';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

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
    
    // Get cache manager and initialize
    const cacheManager = getCacheManager();
    await cacheManager.initialize();
    
    // Use write lock for world to prevent race conditions during navigation
    const worldLock = cacheManager.getWorldLock();
    const userMutex = await cacheManager.getUserMutex(session.userId!);
    
    // Execute navigation with proper locking
    return await worldLock.write(async () => {
      return await userMutex.acquire(async () => {
        // Load user and world data from cache
        const user = await cacheManager.getUser(session.userId!);
        if (!user) {
          throw new ApiError(404, 'User not found');
        }
        
        const world = await cacheManager.getWorld();
        
        // Update physics for all objects first
        const currentTime = Date.now();
        world.updatePhysics(currentTime);
        
        // Find player's ship in the world
        const playerShips = world.getSpaceObjectsByType('player_ship');
        const playerShip = playerShips.find(ship => ship.id === user.ship_id);
        
        if (!playerShip) {
          throw new ApiError(404, 'Player ship not found');
        }
        
        // Calculate max speed from tech tree
        const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
        const afterburnerBonus = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
        const maxSpeed = baseSpeed * (1 + afterburnerBonus / 100);
        
        // Validate and update speed if provided
        let newSpeed = playerShip.speed;
        if (speed !== undefined) {
          if (typeof speed !== 'number' || speed < 0) {
            throw new ApiError(400, 'Speed must be a non-negative number');
          }
          if (speed > maxSpeed) {
            throw new ApiError(400, `Speed cannot exceed ${maxSpeed.toFixed(1)} units`);
          }
          newSpeed = speed;
        }
        
        // Validate and update angle if provided
        let newAngle = playerShip.angle;
        if (angle !== undefined) {
          if (typeof angle !== 'number') {
            throw new ApiError(400, 'Angle must be a number');
          }
          // Normalize angle to 0-360 degrees
          newAngle = ((angle % 360) + 360) % 360;
        }
        
        // Update ship's speed and angle
        await world.updateSpaceObject(playerShip.id, {
          speed: newSpeed,
          angle: newAngle,
          last_position_update_ms: currentTime
        });
        
        // Save changes via cache manager (will persist periodically)
        await cacheManager.updateWorld(world);
        
        return NextResponse.json({ 
          success: true, 
          speed: newSpeed, 
          angle: newAngle,
          maxSpeed: maxSpeed
        });
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
