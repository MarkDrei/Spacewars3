import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, ApiError } from '@/lib/server/errors';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';

const SUPPORTED_LOCALES = ['en', 'de'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { locale } = body;

    if (!isSupportedLocale(locale)) {
      throw new ApiError(400, `Unsupported locale. Must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
    }

    // Build the response with the NEXT_LOCALE cookie
    const response = NextResponse.json({ ok: true });
    response.cookies.set('NEXT_LOCALE', locale, {
      httpOnly: false, // readable by client-side JS for the language switcher UI
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    // If the user is authenticated, persist their preferred locale in the DB
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    if (session.userId) {
      const userCache = UserCache.getInstance2();
      const context = createLockContext();
      await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const user = await userCache.getUserByIdWithLock(userContext, session.userId!);
        if (user) {
          user.preferredLocale = locale;
          await userCache.updateUserInCache(userContext, user);
        }
      });
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
