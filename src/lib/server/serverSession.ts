import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from './session';
import { getUserWorldCache } from './world/userWorldCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from './typedLocks';

export interface ServerAuthState {
  userId: number;
  username: string;
  shipId?: number;
}

/**
 * Get authentication state from server-side session
 * Returns null if not authenticated
 */
export async function getServerAuth(): Promise<ServerAuthState | null> {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    
    if (!session.userId) {
      return null;
    }

    // Use cache to validate user existence and get current data
    const userWorldCache = getUserWorldCache();
    const emptyCtx = createLockContext();

    
    const user = await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      return await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
    });
  

    if (!user) {
      // User doesn't exist in database (deleted user with valid session)
      return null;
    }

    return {
      userId: session.userId,
      username: user.username,
      shipId: user.ship_id,
    };
  } catch (error) {
    console.error('Server auth check failed:', error);
    return null;
  }
}

/**
 * Require authentication for server components
 * Automatically redirects to login if not authenticated
 * Throws redirect - use only in server components
 */
export async function requireAuth(): Promise<ServerAuthState> {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/login');
  }
  
  return auth;
}

/**
 * Check if user is authenticated (for conditional logic)
 * Does not redirect - returns boolean
 */
export async function isAuthenticated(): Promise<boolean> {
  const auth = await getServerAuth();
  return auth !== null;
}