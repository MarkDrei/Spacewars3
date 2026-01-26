import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { cookies } from 'next/headers';
import { MessageCache } from '@/lib/server/messages/MessageCache';

/**
 * POST /api/messages/summarize
 * Summarize all messages for the authenticated user
 */
export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const messageCache = MessageCache.getInstance();
    const summary = await messageCache.summarizeMessages(session.userId);

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error summarizing messages:', error);
    return NextResponse.json(
      { error: 'Failed to summarize messages' },
      { status: 500 }
    );
  }
}
