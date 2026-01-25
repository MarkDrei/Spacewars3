import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { getUserMessages } from '@/lib/server/messages/MessageCache';

/**
 * GET /api/messages
 * Get all unread messages for the authenticated user
 * Using FIXED cached operations (deadlock resolved)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📬 Messages API: Starting request...');
    
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    console.log('📬 Messages API: Session obtained, userId:', session.userId);
    
    requireAuth(session.userId);
    console.log('📬 Messages API: Authentication passed');
    
    console.log(`📬 Messages requested by user: ${session.userId}`);
    
    // Get unread messages
    const unreadMessages = await getUserMessages(session.userId!);
    
    console.log(`📨 Retrieved ${unreadMessages.length} unread message(s) for user ${session.userId}`);
    console.log('📨 Messages data:', unreadMessages);
    
    const response = {
      success: true,
      messages: unreadMessages,
      count: unreadMessages.length
    };
    
    console.log('📬 Messages API: Sending response:', response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Messages API error:', error);
    return handleApiError(error);
  }
}
