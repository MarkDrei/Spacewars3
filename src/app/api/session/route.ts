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
    
    console.log(`🔍 Session check - userId in session: ${session.userId}`);
    
    if (!session.userId) {
      console.log(`❌ Session invalid - no userId in session`);
      return NextResponse.json({ loggedIn: false });
    }
    
    const db = await getDatabase();
    
    const result = await db.query(
      'SELECT username, ship_id FROM users WHERE id = $1',
      [session.userId]
    );
    
    const userRow = result.rows[0] as { username: string; ship_id: number } | undefined;
    
    if (userRow) {
      console.log(`✅ Session valid - user: ${userRow.username}, shipId: ${userRow.ship_id}`);
      return NextResponse.json({ 
        loggedIn: true, 
        username: userRow.username, 
        shipId: userRow.ship_id 
      });
    } else {
      console.log(`❌ Session invalid - user not found for userId: ${session.userId}`);
      return NextResponse.json({ loggedIn: false });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
