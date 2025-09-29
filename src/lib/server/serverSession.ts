import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from './session';

export interface ServerAuthResult {
  isAuthenticated: boolean;
  userId?: number;
  username?: string;
  shipId?: number;
}

/**
 * Server-side authentication utility for App Router components
 * Reads and validates session cookies server-side
 */
export async function getServerAuth(): Promise<ServerAuthResult> {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    
    if (!session.userId) {
      return { isAuthenticated: false };
    }

    // Import user utilities here to avoid circular dependencies
    const { getUserById } = await import('./userRepo');
    const { getDatabase } = await import('./database');
    const db = getDatabase();
    const user = await getUserById(db, session.userId);
    
    if (!user) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      username: user.username,
      shipId: user.ship_id,
    };
  } catch (error) {
    console.error('Server auth check failed:', error);
    return { isAuthenticated: false };
  }
}

/**
 * Validates if user is authenticated, throws redirect error if not
 * Use this in server components that require authentication
 */
export async function requireAuth(): Promise<ServerAuthResult> {
  const auth = await getServerAuth();
  
  if (!auth.isAuthenticated) {
    // This will be caught by Next.js and trigger a redirect
    throw new Error('Authentication required - redirect to /login');
  }
  
  return auth;
}