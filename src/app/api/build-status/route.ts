import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { TechRepo } from '@/lib/server/techRepo';

/**
 * GET /api/build-status
 * Get current tech counts, build queue, and effects for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const techRepo = new TechRepo();
    
    console.log(`🔧 Build status requested for user: ${session.userId}`);
    
    // Process any completed builds first
    const { completed } = await techRepo.processCompletedBuilds(session.userId!);
    if (completed.length > 0) {
      console.log(`✅ Processed ${completed.length} completed build(s) for user ${session.userId}`);
    }
    
    // Get current status
    const analysis = await techRepo.getTechLoadoutAnalysis(session.userId!);
    
    return NextResponse.json({
      success: true,
      techCounts: analysis.techCounts,
      buildQueue: analysis.buildQueue,
      totalDPS: analysis.effects?.weapons.totalDPS || 0,
      totalAccuracy: analysis.effects?.weapons.totalAccuracy || 0,
      totalKineticArmor: analysis.effects?.defense.totalKineticArmor || 0,
      totalEnergyShield: analysis.effects?.defense.totalEnergyShield || 0,
      totalMissileJammers: analysis.effects?.defense.totalMissileJammers || 0,
      queueEstimatedCompletion: analysis.queueEstimatedCompletion,
      completedBuilds: completed
    });
    
  } catch (error) {
    console.error('Build status API error:', error);
    return handleApiError(error);
  }
}
