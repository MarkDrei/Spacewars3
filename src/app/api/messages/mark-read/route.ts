import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { markUserMessagesAsRead } from '@/lib/server/messages/MessageCache';

/**
 * POST /api/messages/mark-read
 * Mark all unread messages as read for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📬 Mark Messages as Read API: Starting request...');
    
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    
    requireAuth(session.userId);

    
    // Mark all unread messages as read
    const markedCount = await markUserMessagesAsRead(session.userId!);
    
    console.log(`✅ Marked ${markedCount} message(s) as read for user ${session.userId}`);
    
    const response = {
      success: true,
      markedCount
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Mark Messages as Read API error:', error);
    return handleApiError(error);
  }
}
