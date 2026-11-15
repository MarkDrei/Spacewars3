import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError, ApiError } from '@/lib/server/errors';
import { TechService } from '@/lib/server/techs/TechService';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

/**
 * GET /api/build-status
 * Get current tech counts, build queue, and effects for authenticated user.
 * Finished builds are applied by the user refresh inside TechService.getBuildStatus.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const status = await createLockContext().useLockWithAcquire(USER_LOCK, (userContext) =>
      TechService.getInstance().getBuildStatus(session.userId!, userContext)
    );
    if (!status) {
      throw new ApiError(404, 'User not found');
    }

    return NextResponse.json({
      success: true,
      techCounts: status.techCounts,
      buildQueue: status.buildQueue,
      totalDPS: status.analysis.weapons.totalDPS,
      totalAccuracy: status.analysis.weapons.totalAccuracy,
      totalKineticArmor: status.analysis.defense.totalKineticArmor,
      totalEnergyShield: status.analysis.defense.totalEnergyShield,
      totalMissileJammers: status.analysis.defense.totalMissileJammers,
      queueEstimatedCompletion: status.queueEstimatedCompletion,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
