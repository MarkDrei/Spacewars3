import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * GET /api/ship-picture - Get the user's selected ship picture
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, session.userId!);
      
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      
      return NextResponse.json({ 
        shipPicture: user.ship_picture || 1 
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/ship-picture - Set the user's selected ship picture
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { shipPicture } = body;
    
    // Validate ship picture number
    if (!shipPicture || typeof shipPicture !== 'number' || shipPicture < 1 || shipPicture > 10) {
      throw new ApiError(400, 'Invalid ship picture number. Must be between 1 and 10.');
    }
    
    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, session.userId!);
      
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
      
      // Update ship picture
      user.ship_picture = shipPicture;
      
      // Update cache
      userCache.updateUserInCache(userContext, user);
      
      return NextResponse.json({ 
        success: true,
        shipPicture: user.ship_picture
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
