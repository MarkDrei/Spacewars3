import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError, ApiError } from '@/lib/server/errors';
import { TechService } from '@/lib/server/techs/TechService';
import { getUserWorldCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

/**
 * POST /api/complete-build
 * Instantly complete the first item in build queue by fast-forwarding its completion time
 * Uses the established processCompletedBuilds() algorithm for consistency
 * Only works for usernames "a" or "q"
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    console.log(`🎮 Cheat: Complete build requested by user: ${session.userId}`);

    const context = createLockContext();
    const techService = TechService.getInstance();
    const userWorldCache = await getUserWorldCache(context);

    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Get user data to check username
      const userData = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);

      if (!userData) {
        throw new ApiError(404, 'User not found');
      }

      // Check if user is authorized for cheat mode
      if (userData.username !== 'a' && userData.username !== 'q') {
        console.log(`❌ Cheat mode denied for user: ${userData.username}`);
        throw new ApiError(403, 'Cheat mode only available for developers');
      }

      console.log(`🔓 Cheat mode authorized for developer: ${userData.username}`);

      // Get current build queue
      const buildQueue = userData.buildQueue;

      if (buildQueue.length === 0) {
        console.log(`📭 No builds in queue for user: ${session.userId}`);
        return { success: false, message: 'No builds in queue to complete' };
      }

      // Get the first item in queue
      const firstBuild = buildQueue[0];
      const now = Math.floor(Date.now() / 1000);

      console.log(`⚡ Fast-forwarding time to complete build: ${firstBuild.itemType}/${firstBuild.itemKey} for user: ${session.userId}`);

      // Advanced time simulation: Set start time back so it completes NOW
      // We need to find how long it takes, and set buildStartSec to now - duration
      // Or simpler: just set buildStartSec to a time in the past

      // Actually, processCompletedBuilds checks: now >= user.buildStartSec + buildTime
      // So if we set user.buildStartSec = now - buildTime - 1, it will be complete.
      // But we don't have buildTime easily here without looking up spec.
      // A safer way is to set buildStartSec to 0 (epoch), which is definitely in the past.

      userData.buildStartSec = 0;

      // Now use the established algorithm to process completed builds
      const processResult = await techService.processCompletedBuilds(session.userId!, userContext);

      if (processResult.completed.length > 0) {
        const completedItem = processResult.completed[0];
        console.log(`✅ Cheat completed build: ${completedItem.itemType}/${completedItem.itemKey} for user: ${userData.username}`);

        return {
          success: true,
          message: `Completed ${completedItem.itemType}: ${completedItem.itemKey}`,
          completedItem: {
            itemKey: completedItem.itemKey,
            itemType: completedItem.itemType
          }
        };
      } else {
        return {
          success: false,
          message: 'Failed to complete build item'
        };
      }
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Complete build API error:', error);
    return handleApiError(error);
  }
}