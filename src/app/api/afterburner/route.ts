import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, TypedCacheManager } from '@/lib/server/typedCacheManager';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techtree';
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
    
    // Get typed cache manager singleton and initialize
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    // Create empty context for lock acquisition
    const emptyCtx = createEmptyContext();
    
    // Execute afterburner trigger with compile-time guaranteed deadlock-free lock ordering:
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
            
            // Continue with afterburner logic
            return await performAfterburnerLogic(world, user, cacheManager, userCtx);
          });
        } else {
          // Continue with afterburner logic directly
          return await performAfterburnerLogic(world, user, cacheManager, userCtx);
        }
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Perform the actual afterburner activation logic with proper lock context
 * This function requires world write and user locks to be held
 */
async function performAfterburnerLogic(
  world: World,
  user: User,
  cacheManager: TypedCacheManager,
  userCtx: UserContext
): Promise<NextResponse> {
  // Update physics for all objects first
  const currentTime = Date.now();
  world.updatePhysics(currentTime);
  
  // Find player's ship in the world
  const playerShips = world.getSpaceObjectsByType('player_ship');
  const playerShip = playerShips.find((ship) => ship.id === user.ship_id);
  
  if (!playerShip) {
    throw new ApiError(404, 'Player ship not found');
  }
  
  // Check if afterburner research is available (level > 0)
  const afterburnerLevel = user.techTree.afterburner;
  if (afterburnerLevel === 0) {
    throw new ApiError(400, 'Afterburner not researched. Research Afterburner first.');
  }
  
  // Check if afterburner is already active
  if (playerShip.afterburner_cooldown_end_ms !== null && 
      playerShip.afterburner_cooldown_end_ms !== undefined) {
    // Check if still on cooldown
    if (playerShip.afterburner_cooldown_end_ms > currentTime) {
      const remainingMs = playerShip.afterburner_cooldown_end_ms - currentTime;
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new ApiError(400, `Afterburner on cooldown. ${remainingSec}s remaining.`);
    }
    // Cooldown expired but not yet processed by world update - allow activation
  }
  
  // Calculate base speed and boosted speed
  const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
  const afterburnerSpeedIncrease = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerSpeedIncrease);
  const boostedSpeed = baseSpeed * (1 + afterburnerSpeedIncrease / 100);
  
  // Get afterburner duration
  const afterburnerDuration = getResearchEffectFromTree(user.techTree, ResearchType.AfterburnerDuration);
  const cooldownEndMs = currentTime + (afterburnerDuration * 1000);
  
  // Store old max speed (the base speed without afterburner)
  playerShip.afterburner_old_max_speed = baseSpeed;
  
  // Set boosted speed as the new effective max speed
  playerShip.afterburner_boosted_speed = boostedSpeed;
  
  // Set cooldown end timestamp
  playerShip.afterburner_cooldown_end_ms = cooldownEndMs;
  
  // Set ship to boosted speed (keep current angle)
  playerShip.speed = boostedSpeed;
  playerShip.last_position_update_ms = currentTime;
  
  // Update cache with new data (using unsafe methods because we have proper locks)
  cacheManager.updateWorldUnsafe(world, userCtx);
  
  console.log(`🚀 Afterburner activated for user ${user.id}: ${baseSpeed} → ${boostedSpeed} for ${afterburnerDuration}s`);
  
  return NextResponse.json({ 
    success: true,
    afterburner: {
      baseSpeed,
      boostedSpeed,
      speedIncrease: afterburnerSpeedIncrease,
      duration: afterburnerDuration,
      cooldownEndMs,
      currentSpeed: playerShip.speed
    },
    ship: {
      id: playerShip.id,
      x: playerShip.x,
      y: playerShip.y,
      speed: playerShip.speed,
      angle: playerShip.angle,
      lastUpdate: playerShip.last_position_update_ms
    },
    message: `Afterburner activated! Speed boosted to ${boostedSpeed.toFixed(1)} for ${afterburnerDuration} seconds.`
  });
}
