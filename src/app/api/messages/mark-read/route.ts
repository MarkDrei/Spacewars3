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
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const markedCount = await markUserMessagesAsRead(createLockContext(), session.userId);

    return NextResponse.json({ success: true, markedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
