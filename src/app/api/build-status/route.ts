import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { TechService } from '@/lib/server/techs/TechService';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

/**
 * GET /api/build-status
 * Get current tech counts, build queue, and effects for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    console.log(`🔧 Build status requested for user: ${session.userId}`);

    const context = createLockContext();
    const techService = TechService.getInstance();

    const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Process any completed builds first
      const { completed } = await techService.processCompletedBuilds(session.userId!, userContext);

      if (completed.length > 0) {
        console.log(`✅ Processed ${completed.length} completed build(s) for user ${session.userId}`);
      }

      // Get current status
      const techCounts = await techService.getTechCounts(session.userId!, userContext);
      const buildQueue = await techService.getBuildQueue(session.userId!, userContext);
      const queueEstimatedCompletion = await techService.getEstimatedCompletionTime(session.userId!, userContext);

      const analysis = await techService.getTechLoadoutAnalysis(session.userId!, userContext);

      return {
        completed,
        techCounts,
        buildQueue,
        queueEstimatedCompletion,
        analysis
      };
    });

    return NextResponse.json({
      success: true,
      techCounts: result.techCounts,
      buildQueue: result.buildQueue,
      totalDPS: result.analysis.weapons.totalDPS,
      totalAccuracy: result.analysis.weapons.totalAccuracy,
      totalKineticArmor: result.analysis.defense.totalKineticArmor,
      totalEnergyShield: result.analysis.defense.totalEnergyShield,
      totalMissileJammers: result.analysis.defense.totalMissileJammers,
      queueEstimatedCompletion: result.queueEstimatedCompletion,
      completedBuilds: result.completed
    });

  } catch (error) {
    console.error('Build status API error:', error);
    return handleApiError(error);
  }
}
