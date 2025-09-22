import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError, ApiError } from '@/lib/server/errors';
import { TechRepo } from '@/lib/server/techRepo';
import { getUserById } from '@/lib/server/userRepo';
import { getDatabase } from '@/lib/server/database';

/**
 * POST /api/complete-build
 * Instantly complete the first item in build queue (cheat mode for developers)
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
    
    const techRepo = new TechRepo();
    
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
    const remainingQueue = buildQueue.slice(1); // Remove first item
    
    console.log(`⚡ Completing build: ${firstBuild.itemType}/${firstBuild.itemKey} for user: ${session.userId}`);
    
    // Get current tech counts
    const techCounts = await techRepo.getTechCounts(session.userId!) || {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0
    };
    
    // Increment the tech count for the completed item
    if (firstBuild.itemKey in techCounts) {
      techCounts[firstBuild.itemKey as keyof typeof techCounts] += 1;
    }
    
    // Update database with new counts and queue
    await techRepo.updateTechCounts(session.userId!, techCounts);
    await techRepo.updateBuildQueue(session.userId!, remainingQueue);
    
    console.log(`✅ Cheat completed build: ${firstBuild.itemType}/${firstBuild.itemKey} for user: ${userData.username}`);
    
    return NextResponse.json({
      success: true,
      message: `Completed ${firstBuild.itemType}: ${firstBuild.itemKey}`,
      completedItem: {
        itemKey: firstBuild.itemKey,
        itemType: firstBuild.itemType
      }
    });
    
  } catch (error) {
    console.error('Complete build API error:', error);
    return handleApiError(error);
  }
}