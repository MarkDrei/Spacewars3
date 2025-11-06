import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getUserWorldCache } from '@/lib/server/world/userWorldCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createLockContext } from '@/lib/server/typedLocks';
import { User } from '@/lib/server/world/user';
import { World } from '@/lib/server/world/world';
import { TechFactory } from '@/lib/server/TechFactory';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get typed cache manager singleton
    const cacheManager = getUserWorldCache();
    
    // Create empty context for lock acquisition
    const emptyCtx = createLockContext();
    
    // Execute with world read and user locks (read both world and user)
    const worldCtx = await cacheManager.acquireWorldRead(emptyCtx);
    try {
      const userCtx = await cacheManager.acquireUserLock(worldCtx);
      try {
        // Get world and user data safely (we have both locks)
        const world = cacheManager.getWorldFromCache(userCtx);
        let user = cacheManager.getUserByIdFromCache(session.userId!, userCtx);
        
        if (!user) {
          // Load user from database if not in cache
          const dbCtx = await cacheManager.acquireDatabaseRead(userCtx);
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
        
        // Continue with ship stats logic
        return await getShipStats(world, user);
      } finally {
        userCtx.dispose();
      }
    } finally {
      worldCtx.dispose();
    }
  } catch (error) {
    return handleApiError(error);
  }
}

async function getShipStats(world: World, user: User): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(currentTime);
  
  // Update defense values based on elapsed time since last regen
  const now = Math.floor(Date.now() / 1000);
  user.updateDefenseValues(now);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }
  
  // Calculate max speed from tech tree
  const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
  const afterburnerBonus = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
  const maxSpeed = baseSpeed * (1 + afterburnerBonus / 100);
  
  // Calculate defense values using actual current values from database
  const currentValues = {
    hull: user.hullCurrent,
    armor: user.armorCurrent,
    shield: user.shieldCurrent
  };
  const defenseValues = TechFactory.calculateDefenseValues(user.techCounts, currentValues);
  
  const responseData = {
    x: playerShip.x,
    y: playerShip.y,
    speed: playerShip.speed,
    angle: playerShip.angle,
    maxSpeed: maxSpeed,
    last_position_update_ms: playerShip.last_position_update_ms,
    defenseValues
  };
  
  return NextResponse.json(responseData);
}
