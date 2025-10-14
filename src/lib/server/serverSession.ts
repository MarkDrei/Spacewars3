import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from './session';
import { getTypedCacheManager } from './typedCacheManager';

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
    const cacheManager = getTypedCacheManager();
    
    // Ensure cache manager is initialized before use
    if (!cacheManager.isReady) {
      await cacheManager.initialize();
    }
    
    // Create empty context at entry point (middleware)
    const { createEmptyContext } = await import('./ironGuardSystem');
    const emptyCtx = createEmptyContext();
    
    const user = await cacheManager.loadUserIfNeeded(session.userId, emptyCtx);

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