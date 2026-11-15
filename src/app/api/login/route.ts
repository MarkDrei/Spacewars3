import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, validateRequired, ApiError } from '@/lib/server/errors';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { getAuthRateLimits, getClientIp, consumeRateLimit, assertNotRateLimited } from '@/lib/server/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const rateLimits = getAuthRateLimits();
    consumeRateLimit(rateLimits.loginByIp, getClientIp(request.headers));

    const body = await request.json();
    const { username, password } = body;
    
    validateRequired(username, 'username');
    validateRequired(password, 'password');
    assertNotRateLimited(rateLimits.loginFailuresByUsername, username);
    
    const emptyCtx = createLockContext();
    const cache = UserCache.getInstance2();
    const user = await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      return await cache.getUserByUsername(userCtx, username);
    });
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      rateLimits.loginFailuresByUsername.hit(username);
      throw new ApiError(400, 'Invalid credentials');
    }
    rateLimits.loginFailuresByUsername.reset(username);
    
    // No explicit save: getUserByUsername already ran updateStats() and marked the user dirty,
    // the cache persists it.

    // Create response
    const response = NextResponse.json({ success: true });
    
    // Set NEXT_LOCALE cookie to user's preferred locale
    response.cookies.set('NEXT_LOCALE', user.preferredLocale, {
      httpOnly: false, // httpOnly: false — must be readable by client-side JS (language switcher UI reads current locale)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    // Set session with the response object
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    await session.save();
    
    console.log(`🔐 Login - Setting session userId: ${user.id} for user: ${username}`);
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
