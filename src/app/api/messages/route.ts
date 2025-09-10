import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { MessagesRepo } from '@/lib/server/messagesRepo';

/**
 * GET /api/messages
 * Get all unread messages for the authenticated user and mark them as read
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    console.log(`📬 Messages requested by user: ${session.userId}`);
    
    const messagesRepo = new MessagesRepo();
    
    // Get and mark unread messages as read
    const unreadMessages = await messagesRepo.getAndMarkUnreadMessages(session.userId!);
    
    console.log(`📨 Retrieved ${unreadMessages.length} unread message(s) for user ${session.userId}`);
    
    return NextResponse.json({
      success: true,
      messages: unreadMessages,
      count: unreadMessages.length
    });
    
  } catch (error) {
    console.error('Messages API error:', error);
    return handleApiError(error);
  }
}
