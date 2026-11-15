import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/errors';

export async function GET(request: NextRequest) {
  try {
    // Create response first
    const response = NextResponse.json({ loggedIn: false });
    
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    
    if (!session.userId) {
      return NextResponse.json({ loggedIn: false });
    }
    
    const db = await getDatabase();
    
    const result = await db.query(
      'SELECT username, ship_id FROM users WHERE id = $1',
      [session.userId]
    );
    
    const userRow = result.rows[0] as { username: string; ship_id: number } | undefined;
    
    if (userRow) {
      return NextResponse.json({ 
        loggedIn: true, 
        username: userRow.username, 
        shipId: userRow.ship_id 
      });
    } else {
      return NextResponse.json({ loggedIn: false });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
