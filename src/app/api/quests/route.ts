// ---
// Missions API
// GET  /api/quests → mission state of the player (QuestOverview)
// POST /api/quests → accept, report or abandon a mission
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { ApiError, handleApiError, requireAuth } from '@/lib/server/errors';
import { getServerT } from '@/lib/server/i18n/serverTranslations';
import { QuestService } from '@/lib/server/quests/QuestService';
import { isContactId } from '@/shared/quests/npcArchetypes';
import { QuestRuleError } from '@/shared/quests/questTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const overview = await QuestService.getInstance().getOverview(createLockContext(), session.userId);
    if (!overview) {
      throw new ApiError(404, 'User not found');
    }
    return NextResponse.json(overview);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Body: { action: 'accept' | 'report' | 'abandon', questId: string, contactId?: ContactId }
 * `contactId` is the contact the player reports to (action 'report').
 * A rule violation (QuestRuleError) is answered with 400 and the rule's code.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const { action, questId, contactId } = body ?? {};
    if (typeof questId !== 'string' || questId === '') {
      throw new ApiError(400, 'Missing or invalid quest ID');
    }

    const quests = QuestService.getInstance();
    try {
      switch (action) {
        case 'accept':
          return NextResponse.json(await quests.accept(createLockContext(), userId, questId));
        case 'report':
          if (!isContactId(contactId)) {
            throw new ApiError(400, 'Missing or invalid contact ID');
          }
          return NextResponse.json(await quests.report(createLockContext(), userId, questId, contactId));
        case 'abandon':
          return NextResponse.json(await quests.abandon(createLockContext(), userId, questId));
        default:
          throw new ApiError(400, 'Invalid action');
      }
    } catch (error) {
      if (error instanceof QuestRuleError) {
        const locale = request.cookies.get('NEXT_LOCALE')?.value ?? 'en';
        const t = await getServerT(locale, 'quests');
        throw new ApiError(400, t(`errors.${error.code}`), error.code);
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
