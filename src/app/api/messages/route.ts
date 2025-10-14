import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { getUserMessagesCached } from '@/lib/server/typedCacheManager';

/**
 * GET /api/messages
 * Get all unread messages for the authenticated user and mark them as read
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
    
    console.log('📬 Messages API: Using FIXED cached operations...');
    // Get and mark unread messages as read (using FIXED cached operations)
    // Import and create empty context at entry point
    const { createEmptyContext } = await import('@/lib/server/ironGuardSystem');
    const emptyCtx = createEmptyContext();
    const unreadMessages = await getUserMessagesCached(session.userId!, emptyCtx);
    
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
