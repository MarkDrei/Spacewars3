import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getTypedCacheManager, sendMessageToUserCached } from '@/lib/server/typedCacheManager';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { createEmptyContext } from '@/lib/server/typedLocks';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    const emptyCtx = createEmptyContext();
    
    return await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      let user = cacheManager.getUserUnsafe(session.userId!, userCtx);
      
      if (!user) {
        return await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
          user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
          if (!user) {
            throw new ApiError(404, 'User not found');
          }
          
          cacheManager.setUserUnsafe(user, userCtx);
          
          return NextResponse.json({
            username: user.username,
            shipImageIndex: user.shipImageIndex
          });
        });
      }
      
      return NextResponse.json({
        username: user.username,
        shipImageIndex: user.shipImageIndex
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { shipImageIndex } = body;
    
    // Validate shipImageIndex
    if (typeof shipImageIndex !== 'number' || shipImageIndex < 1 || shipImageIndex > 5) {
      throw new ApiError(400, 'Invalid ship image index. Must be between 1 and 5.');
    }
    
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    const emptyCtx = createEmptyContext();
    
    return await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
      let user = cacheManager.getUserUnsafe(session.userId!, userCtx);
      
      if (!user) {
        return await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
          user = await cacheManager.loadUserFromDbUnsafe(session.userId!, dbCtx);
          if (!user) {
            throw new ApiError(404, 'User not found');
          }
          
          cacheManager.setUserUnsafe(user, userCtx);
          
          // Update ship image index
          const oldShipImageIndex = user.shipImageIndex;
          user.shipImageIndex = shipImageIndex;
          await cacheManager.updateUserUnsafe(user, userCtx);
          
          // Send notification message if ship changed
          if (oldShipImageIndex !== shipImageIndex) {
            sendMessageToUserCached(user.id, `Your ship appearance has been updated to Ship ${shipImageIndex}.`).catch((error: Error) => {
              console.error('Failed to send ship change notification:', error);
            });
          }
          
          return NextResponse.json({
            username: user.username,
            shipImageIndex: user.shipImageIndex
          });
        });
      }
      
      // Update ship image index
      const oldShipImageIndex = user.shipImageIndex;
      user.shipImageIndex = shipImageIndex;
      await cacheManager.updateUserUnsafe(user, userCtx);
      
      // Send notification message if ship changed
      if (oldShipImageIndex !== shipImageIndex) {
        sendMessageToUserCached(user.id, `Your ship appearance has been updated to Ship ${shipImageIndex}.`).catch((error: Error) => {
          console.error('Failed to send ship change notification:', error);
        });
      }
      
      return NextResponse.json({
        username: user.username,
        shipImageIndex: user.shipImageIndex
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
