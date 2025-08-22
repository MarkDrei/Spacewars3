import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getCacheManager } from '@/lib/server/cacheManager';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get cache manager and load data from cache
    const cacheManager = getCacheManager();
    await cacheManager.initialize();
    
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
    
    const responseData = {
      x: playerShip.x,
      y: playerShip.y,
      speed: playerShip.speed,
      angle: playerShip.angle,
      maxSpeed: maxSpeed,
      last_position_update_ms: playerShip.last_position_update_ms
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    return handleApiError(error);
  }
}
