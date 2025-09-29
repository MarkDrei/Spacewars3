import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from './session';
import { getDatabase } from './database';

export interface ServerAuthState {
  userId: number;
  username: string;
  shipId: number;
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

    // Fetch user data from database to ensure session is still valid
    const db = getDatabase();
    const userRow = await new Promise<{ username: string; ship_id: number } | undefined>((resolve, reject) => {
      db.get(
        'SELECT username, ship_id FROM users WHERE id = ?',
        [session.userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row as { username: string; ship_id: number } | undefined);
          }
        }
      );
    });

    if (!userRow) {
      return null;
    }

    return {
      userId: session.userId,
      username: userRow.username,
      shipId: userRow.ship_id,
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