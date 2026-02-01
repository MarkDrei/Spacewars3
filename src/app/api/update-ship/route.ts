import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { shipPictureId } = body;
    
    // Validate shipPictureId
    if (typeof shipPictureId !== 'number' || shipPictureId < 1 || shipPictureId > 5) {
      throw new ApiError(400, 'Invalid ship picture ID. Must be between 1 and 5.');
    }
    
    const emptyCtx = createLockContext();
    const userWorldCache = UserCache.getInstance2();
    
    return await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
      
      if (!user) {
        console.log(`❌ User not found: ${session.userId}`);
        throw new ApiError(404, 'User not found');
      }
      
      // Update ship picture ID
      user.shipPictureId = shipPictureId;
      
      // Update cache (this will persist to DB via background persistence)
      userWorldCache.updateUserInCache(userContext, user);
      
      console.log(`✅ Updated ship picture for user ${user.username} to ${shipPictureId}`);
      
      return NextResponse.json({ 
        success: true,
        shipPictureId: user.shipPictureId,
        message: `Ship picture updated to ${shipPictureId}`
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
