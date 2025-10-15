import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager } from '@/lib/server/typedCacheManager';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyLockContext } from '@/lib/server/ironGuard';
import { User } from '@/lib/server/user';
import { World } from '@/lib/server/world';
import { TechFactory } from '@/lib/server/TechFactory';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyLockContext();
    
    // Execute with world read and user locks (read both world and user)
    return await cacheManager.withWorldRead(emptyCtx, async (worldCtx) => {
      return await cacheManager.withUserLock(worldCtx, async (userCtx) => {
        // Get world and user data safely (we have both locks)
        const world = cacheManager.getWorldUnsafe(userCtx);
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
            
            // Continue with ship stats logic
            return await getShipStats(world, user);
          });
        } else {
          // Continue with ship stats logic directly
          return await getShipStats(world, user);
        }
      });
    });
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
