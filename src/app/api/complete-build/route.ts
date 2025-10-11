import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError, ApiError } from '@/lib/server/errors';
import { TechRepo } from '@/lib/server/techRepo';
import { getUserById } from '@/lib/server/userRepo';
import { getDatabase } from '@/lib/server/database';

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
    
    // Get user data to check username
    const db = await getDatabase();
    const userData = await getUserById(db, session.userId!);
    if (!userData) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check if user is authorized for cheat mode
    if (userData.username !== 'a' && userData.username !== 'q') {
      console.log(`❌ Cheat mode denied for user: ${userData.username}`);
      throw new ApiError(403, 'Cheat mode only available for developers');
    }
    
    console.log(`🔓 Cheat mode authorized for developer: ${userData.username}`);
    
    const techRepo = new TechRepo(db);
    
    // Get current build queue
    const buildQueue = await techRepo.getBuildQueue(session.userId!);
    
    if (buildQueue.length === 0) {
      console.log(`📭 No builds in queue for user: ${session.userId}`);
      return NextResponse.json({
        success: false,
        message: 'No builds in queue to complete'
      });
    }
    
    // Get the first item in queue
    const firstBuild = buildQueue[0];
    const now = Math.floor(Date.now() / 1000);
    
    console.log(`⚡ Fast-forwarding time to complete build: ${firstBuild.itemType}/${firstBuild.itemKey} for user: ${session.userId}`);
    
    // Advanced time simulation: Set completion time to NOW for the first item
    // This lets processCompletedBuilds() handle everything naturally
    const updatedQueue = buildQueue.map((item, index) => {
      if (index === 0) {
        // Make the first item completed by setting its time to now
        return { ...item, completionTime: now };
      }
      return item;
    });
    
    // Update the queue with the advanced time
    await techRepo.updateBuildQueue(session.userId!, updatedQueue);
    
    // Now use the established algorithm to process completed builds
    // This handles tech count updates, notifications, and queue management
    const result = await techRepo.processCompletedBuilds(session.userId!);
    
    if (result.completed.length > 0) {
      const completedItem = result.completed[0];
      console.log(`✅ Cheat completed build: ${completedItem.itemType}/${completedItem.itemKey} for user: ${userData.username}`);
      
      return NextResponse.json({
        success: true,
        message: `Completed ${completedItem.itemType}: ${completedItem.itemKey}`,
        completedItem: {
          itemKey: completedItem.itemKey,
          itemType: completedItem.itemType
        }
      });
    } else {
      // This shouldn't happen, but handle gracefully
      return NextResponse.json({
        success: false,
        message: 'Failed to complete build item'
      });
    }
    
  } catch (error) {
    console.error('Complete build API error:', error);
    return handleApiError(error);
  }
}