import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { markUserMessagesAsRead } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * POST /api/messages/mark-read
 * Mark all unread messages as read for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📬 Mark Messages as Read API: Starting request...');
    
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    console.log('📬 Mark Messages as Read API: Session obtained, userId:', session.userId);
    
    requireAuth(session.userId);
    console.log('📬 Mark Messages as Read API: Authentication passed');
    
    console.log(`📬 Marking messages as read for user: ${session.userId}`);
    
    // Mark all unread messages as read
    const ctx = createLockContext();
    const markedCount = await markUserMessagesAsRead(ctx, session.userId!);
    
    console.log(`✅ Marked ${markedCount} message(s) as read for user ${session.userId}`);
    
    const response = {
      success: true,
      markedCount
    };
    
    console.log('📬 Mark Messages as Read API: Sending response:', response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Mark Messages as Read API error:', error);
    return handleApiError(error);
  }
}
