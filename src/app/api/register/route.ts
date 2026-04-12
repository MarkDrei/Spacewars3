import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { createUser, saveUserToDb, getUserByEmail, setEmailVerificationToken } from '@/lib/server/user/userRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, validateRequired, ApiError } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { DEFAULT_SHIP_START_X, DEFAULT_SHIP_START_Y, DEFAULT_SHIP_START_SPEED, DEFAULT_SHIP_START_ANGLE } from '@/lib/server/constants';
import { isEmailEnabled } from '@/lib/server/email/emailConfig';
import { sendEmail } from '@/lib/server/email/emailService';
import { buildVerificationEmail } from '@/lib/server/email/emailTemplates';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, email } = body;
    
    validateRequired(username, 'username');
    validateRequired(password, 'password');

    // Validate optional email
    const normalizedEmail: string | null = email && typeof email === 'string' ? email.trim().toLowerCase() : null;
    if (normalizedEmail !== null) {
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ApiError(400, 'Invalid email address format');
      }
    }
    
    const db = await getDatabase();

    // Check email uniqueness before creating user
    if (normalizedEmail !== null) {
      const existing = await getUserByEmail(db, normalizedEmail);
      if (existing) {
        throw new ApiError(400, 'Email already in use');
      }
    }
    
    // Hash password with automatic salt generation
    const hash = await bcrypt.hash(password, 10);
    
    const user = await createUser(db, username, hash, saveUserToDb(db), normalizedEmail);
    
    // Add user and ship to cache immediately after creation
    const ctx = createLockContext();
    await ctx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      // Add user to cache
      const userCache = UserCache.getInstance2();
      userCache.setUserUnsafe(userContext, user);
      
      // Add ship to world cache if user has a ship
      if (user.ship_id) {
        await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
          const worldCache = WorldCache.getInstance();
          const world = worldCache.getWorldFromCache(worldContext);
          
          // Check if ship already exists in world
          const existingShip = world.getSpaceObject(worldContext, user.ship_id!);
          if (!existingShip) {
            // Add the new ship to the world's space objects
            const newShip = {
              id: user.ship_id!,
              type: 'player_ship' as const,
              x: DEFAULT_SHIP_START_X,
              y: DEFAULT_SHIP_START_Y,
              speed: DEFAULT_SHIP_START_SPEED,
              angle: DEFAULT_SHIP_START_ANGLE,
              last_position_update_ms: Date.now(),
              picture_id: 1, // Default ship picture
              username: user.username
            };
            world.spaceObjects.push(newShip);
            console.log(`🚀 Added ship ${user.ship_id} for user ${user.username} to world cache`);
          }
        });
      }
    });

    // Send verification email if email was provided and email is enabled
    let emailSent = false;
    if (normalizedEmail !== null && isEmailEnabled()) {
      try {
        const token = randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await setEmailVerificationToken(db, user.id, token, expiresAt);

        // Build verification URL
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL ??
          `${request.headers.get('x-forwarded-proto') ?? 'http'}://${request.headers.get('host') ?? 'localhost:3000'}`;
        const verificationUrl = `${baseUrl}/api/verify-email?token=${token}`;

        const { subject, html } = buildVerificationEmail(username, verificationUrl);
        // Fire-and-forget — do not await, do not fail registration on error
        void sendEmail(normalizedEmail, subject, html);
        emailSent = true;
      } catch (emailErr) {
        console.error('❌ Error preparing verification email:', emailErr);
        // Registration still succeeds
      }
    }
    
    // Create response
    const response = NextResponse.json({ success: true, emailSent });
    
    // Set session with the response object
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    await session.save();
    
    console.log(`🔐 Register - Setting session userId: ${user.id} for user: ${username}`);
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
