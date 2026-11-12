import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { getUserMessages } from '@/lib/server/messages/MessageCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

/**
 * GET /api/messages
 * Get all unread messages for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const unreadMessages = await getUserMessages(createLockContext(), session.userId!);

    return NextResponse.json({
      success: true,
      messages: unreadMessages,
      count: unreadMessages.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
