import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { createUser, saveUserToDb } from '@/lib/server/user/userRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, validateRequired } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { DEFAULT_SHIP_START_X, DEFAULT_SHIP_START_Y, DEFAULT_SHIP_START_SPEED, DEFAULT_SHIP_START_ANGLE } from '@/lib/server/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    validateRequired(username, 'username');
    validateRequired(password, 'password');
    
    const db = await getDatabase();
    
    // Hash password with automatic salt generation
    const hash = await bcrypt.hash(password, 10);
    
    const user = await createUser(db, username, hash, saveUserToDb(db));
    
    // Add user and ship to cache immediately after creation
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Add user to cache
      const userCache = UserCache.getInstance2();
      userCache.setUserUnsafe(userContext, user);
      
      // Add ship to world cache if user has a ship
      if (user.ship_id) {
        await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
          const worldCache = WorldCache.getInstance();
          const world = worldCache.getWorldFromCache(worldContext);
          
          // Check if ship already exists in world
          const existingShip = world.getSpaceObject(worldContext, user.ship_id!);
          if (!existingShip) {
            // Add the new ship to the world's space objects
            const newShip = {
              id: user.ship_id!,
              type: 'player_ship' as const,
              x: DEFAULT_SHIP_START_X,
              y: DEFAULT_SHIP_START_Y,
              speed: DEFAULT_SHIP_START_SPEED,
              angle: DEFAULT_SHIP_START_ANGLE,
              last_position_update_ms: Date.now(),
              username: user.username
            };
            world.spaceObjects.push(newShip);
            console.log(`🚀 Added ship ${user.ship_id} for user ${user.username} to world cache`);
          }
        });
      }
    });
    
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Set session with the response object
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    await session.save();
    
    console.log(`🔐 Register - Setting session userId: ${user.id} for user: ${username}`);
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
