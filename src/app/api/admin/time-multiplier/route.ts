// ---
// Route to get and set the time multiplier for admin users
// Used by admin dashboard to control game speed for testing
//
// Access restricted to developer users only ('a' and 'q')
//
// GET: Returns current multiplier status (value, expiration, remaining time)
// POST: Sets a new multiplier with duration
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext, LOCK_4 } from '@markdrei/ironguard-typescript-locks';

/**
 * GET /api/admin/time-multiplier
 * 
 * Returns the current time multiplier status including:
 * - multiplier: Current multiplier value (1 if expired)
 * - expiresAt: Expiration timestamp in ms (null if not set)
 * - activatedAt: Activation timestamp in ms (null if not set)
 * - remainingSeconds: Calculated remaining time
 * 
 * @requires Authentication (session with userId)
 * @requires Admin privileges (username 'a' or 'q')
 * 
 * @returns 200 - TimeMultiplierStatus
 * @returns 401 - Not authenticated
 * @returns 403 - Not authorized (non-admin user)
 */
export async function GET(request: NextRequest) {
  try {
    // Get session and validate authentication
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // Get user data to check admin privileges
    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    return await emptyCtx.useLockWithAcquire(LOCK_4, async (userContext) => {
      const userData = await userCache.getUserByIdWithLock(userContext, session.userId!);
      if (!userData) {
        throw new ApiError(404, 'User not found');
      }

      // Check admin privileges (developer-only access)
      if (userData.username !== 'a' && userData.username !== 'q') {
        throw new ApiError(403, 'Admin access restricted to developers');
      }

      // Get current time multiplier status
      const status = TimeMultiplierService.getInstance().getStatus();

      return NextResponse.json(status);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/time-multiplier
 * 
 * Sets a new time multiplier with a specified duration.
 * 
 * Request body:
 * - multiplier: number (must be >= 1)
 * - durationMinutes: number (must be > 0)
 * 
 * Response:
 * - success: true
 * - multiplier: number (confirmed value)
 * - expiresAt: number (expiration timestamp in ms)
 * - durationMinutes: number (confirmed duration)
 * 
 * @requires Authentication (session with userId)
 * @requires Admin privileges (username 'a' or 'q')
 * 
 * @returns 200 - Success response with multiplier details
 * @returns 400 - Invalid request body
 * @returns 401 - Not authenticated
 * @returns 403 - Not authorized (non-admin user)
 */
export async function POST(request: NextRequest) {
  try {
    // Get session and validate authentication
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // Get user data to check admin privileges
    const emptyCtx = createLockContext();
    const userCache = UserCache.getInstance2();
    return await emptyCtx.useLockWithAcquire(LOCK_4, async (userContext) => {
      const userData = await userCache.getUserByIdWithLock(userContext, session.userId!);
      if (!userData) {
        throw new ApiError(404, 'User not found');
      }

      // Check admin privileges (developer-only access)
      if (userData.username !== 'a' && userData.username !== 'q') {
        throw new ApiError(403, 'Admin access restricted to developers');
      }

      // Parse and validate request body
      const body = await request.json();
      const { multiplier, durationMinutes } = body;

      // Validate multiplier
      if (typeof multiplier !== 'number' || multiplier < 1) {
        throw new ApiError(400, 'Multiplier must be a number >= 1');
      }

      // Validate duration
      if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
        throw new ApiError(400, 'Duration must be a positive number');
      }

      // Set the time multiplier
      TimeMultiplierService.getInstance().setMultiplier(multiplier, durationMinutes);

      // Get the updated status to return expiration time
      const status = TimeMultiplierService.getInstance().getStatus();

      return NextResponse.json({
        success: true,
        multiplier: status.multiplier,
        expiresAt: status.expiresAt,
        durationMinutes,
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
