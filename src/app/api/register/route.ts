import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { createUser, saveUserToDb, getUserByEmail, setEmailVerificationToken, getUserByUsername } from '@/lib/server/user/userRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, validateRequired, ApiError } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { DEFAULT_SHIP_START_X, DEFAULT_SHIP_START_Y, DEFAULT_SHIP_START_SPEED, DEFAULT_SHIP_START_ANGLE } from '@/lib/server/constants';
import { isEmailEnabled, getEmailLinkBaseUrl } from '@/lib/server/email/emailConfig';
import { sendEmail } from '@/lib/server/email/emailService';
import { buildVerificationEmail } from '@/lib/server/email/emailTemplates';
import { calculateLevelFromXp } from '@shared/utils/levelUtils';
import { validateUsername } from '@/lib/server/user/usernameValidation';
import { getAuthRateLimits, getClientIp, consumeRateLimit } from '@/lib/server/rateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { username, password, email } = (body ?? {}) as Record<string, unknown>;
    
    validateRequired(username, 'username');
    validateRequired(password, 'password');

    // Validate username format and reserved patterns
    validateUsername(username);

    // Validate optional email
    const normalizedEmail: string | null = email && typeof email === 'string' ? email.trim().toLowerCase() : null;
    if (normalizedEmail !== null) {
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ApiError(400, 'Invalid email address format');
      }
    }
    
    // Counted after validation: every request from here on costs a bcrypt hash and may create an account
    consumeRateLimit(getAuthRateLimits().registerByIp, getClientIp(request.headers));

    const db = await getDatabase();

    // Hash password with automatic salt generation (slow by design, so before taking any lock)
    const hash = await bcrypt.hash(password, 10);

    // Determine preferred locale from Accept-Language header
    const acceptLanguage = request.headers.get('accept-language') ?? '';
    const preferredLocale = acceptLanguage.toLowerCase().includes('de') ? 'de' : 'en';

    // Uniqueness check and creation run under USER_LOCK so concurrent registrations of the same
    // username are serialized. The database has no UNIQUE constraint on username (NPC users share
    // display names), so this check is the only guard.
    const user = await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      if (await getUserByUsername(db, username)) {
        throw new ApiError(400, 'Username already taken');
      }
      if (normalizedEmail !== null && await getUserByEmail(db, normalizedEmail)) {
        throw new ApiError(400, 'Email already in use');
      }

      const newUser = await createUser(db, username, hash, saveUserToDb(db), normalizedEmail);
      newUser.preferredLocale = preferredLocale;
      await newUser.save();

      UserCache.getInstance2().setUserUnsafe(userContext, newUser);

      // Add the new ship to the world cache
      if (newUser.ship_id) {
        const shipId = newUser.ship_id;
        await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
          const world = WorldCache.getInstance().getWorldFromCache(worldContext);
          if (!world.getSpaceObject(worldContext, shipId)) {
            // username/userId/level are render metadata, as attached by loadWorldFromDb
            const newShip = {
              id: shipId,
              type: 'player_ship' as const,
              x: DEFAULT_SHIP_START_X,
              y: DEFAULT_SHIP_START_Y,
              speed: DEFAULT_SHIP_START_SPEED,
              angle: DEFAULT_SHIP_START_ANGLE,
              last_position_update_ms: Date.now(),
              picture_id: 1, // Default ship picture
              username: newUser.username,
              userId: newUser.id,
              level: calculateLevelFromXp(newUser.xp),
            };
            world.spaceObjects.push(newShip);
          }
        });
      }

      return newUser;
    });

    // Send verification email if email was provided and email is enabled
    let emailSent = false;
    if (normalizedEmail !== null && isEmailEnabled()) {
      try {
        const token = randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await setEmailVerificationToken(db, user.id, token, expiresAt);

        const baseUrl = getEmailLinkBaseUrl(request.headers);
        if (baseUrl === null) {
          throw new Error('Email link base URL not configured');
        }
        const verificationUrl = `${baseUrl}/api/verify-email?token=${token}`;

        const { subject, html, text } = await buildVerificationEmail(username, verificationUrl, preferredLocale);
        // Fire-and-forget — do not await, do not fail registration on error
        void sendEmail(normalizedEmail, subject, html, text);
        emailSent = true;
      } catch (emailErr) {
        console.error('❌ Error preparing verification email:', emailErr);
        // Registration still succeeds
      }
    }
    
    // Create response
    const response = NextResponse.json({ success: true, emailSent });

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
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
