// ---
// Admin test tools for missions: test a quest without playing everything before it.
// Access restricted to developer users (see isAdminUsername).
//
// POST /api/admin/quests
// Body: { action, questId?, contactId?, locationId? }
//   reset        delete all mission progress, achievements and mission cargo of the caller
//   accept       accept `questId`, completing its prerequisites without rewards
//   fulfil       fulfil the objectives of the current stage of `questId`
//   report       fulfil and report the current stage of `questId` (from any distance)
//   respawnNpcs  bring back all hostile NPC ships of the caller
//   jump         move the caller's ship to the contact `contactId` or the location `locationId`
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { ApiError, handleApiError, requireAuth } from '@/lib/server/errors';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';
import { UserCache } from '@/lib/server/user/userCache';
import { WorldCache } from '@/lib/server/world/worldCache';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { NPCManager } from '@/lib/server/npc/NPCManager';
import { QuestService } from '@/lib/server/quests/QuestService';
import { isAdminUsername } from '@/shared/adminAccess';
import { LOCATIONS } from '@/shared/quests/locations';
import { contactPosition, getContact, isContactId } from '@/shared/quests/npcArchetypes';
import { QuestRuleError } from '@/shared/quests/questTypes';

export const dynamic = 'force-dynamic';

/** Where a jump ends: at the contact's ship or in the centre of the location. */
function jumpTarget(contactId: unknown, locationId: unknown): { x: number; y: number } {
  if (isContactId(contactId)) {
    return contactPosition(getContact(contactId), Date.now(), TimeMultiplierService.getInstance().getMultiplier());
  }
  const location = LOCATIONS.find((candidate) => candidate.id === locationId);
  if (!location) {
    throw new ApiError(400, 'Missing or invalid contactId / locationId');
  }
  return { x: location.x, y: location.y };
}

/** Puts the ship at the position and stops it. Locks: USER_LOCK (4) → WORLD_LOCK (6). */
async function moveShip(userId: number, position: { x: number; y: number }): Promise<void> {
  const worldCache = WorldCache.getInstance();
  await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
    const user = await UserCache.getInstance2().getUserByIdWithLock(userContext, userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (user.inBattle) {
      throw new ApiError(400, 'Cannot jump while in battle');
    }
    await userContext.useLockWithAcquire(WORLD_LOCK, async (worldContext) => {
      const world = worldCache.getWorldFromCache(worldContext);
      const ship = world.getSpaceObject(worldContext, user.ship_id ?? -1);
      if (!ship || ship.type !== 'player_ship') {
        throw new ApiError(404, 'Player ship not found');
      }
      ship.x = position.x;
      ship.y = position.y;
      ship.speed = 0;
      ship.last_position_update_ms = Date.now();
      await worldCache.updateWorldUnsafe(worldContext, world);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId;

    const user = await UserCache.getInstance2().getUserById(createLockContext(), userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (!isAdminUsername(user.username)) {
      throw new ApiError(403, 'Admin access restricted to developers');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const { action, questId, contactId, locationId } = body ?? {};
    const quests = QuestService.getInstance();
    const requireQuestId = (): string => {
      if (typeof questId !== 'string' || questId === '') {
        throw new ApiError(400, 'Missing or invalid quest ID');
      }
      return questId;
    };

    try {
      switch (action) {
        case 'reset':
          await quests.resetProgress(createLockContext(), userId);
          return NextResponse.json({ success: true });
        case 'accept':
          return NextResponse.json(await quests.forceAccept(createLockContext(), userId, requireQuestId()));
        case 'fulfil':
          return NextResponse.json(await quests.fulfilStage(createLockContext(), userId, requireQuestId()));
        case 'report':
          return NextResponse.json(await quests.forceReport(createLockContext(), userId, requireQuestId()));
        case 'respawnNpcs':
          if (!NPCManager.getInstance().resetPlayer(userId)) {
            throw new ApiError(400, 'An NPC ship is in battle');
          }
          return NextResponse.json({ success: true });
        case 'jump':
          await moveShip(userId, jumpTarget(contactId, locationId));
          return NextResponse.json({ success: true });
        default:
          throw new ApiError(400, 'Invalid action');
      }
    } catch (error) {
      if (error instanceof QuestRuleError) {
        throw new ApiError(400, error.message, error.code);
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
