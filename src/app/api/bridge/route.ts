import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import {
  InventoryService,
  BridgeSlotEmptyError,
  BridgeSlotInvalidError,
} from '@/lib/server/inventory/InventoryService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

const inventoryService = new InventoryService();

async function getMaxBridgeSlotsForUser(userId: number): Promise<number> {
  const emptyCtx = createLockContext();
  const userCache = UserCache.getInstance2();
  return emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const user = await userCache.getUserByIdWithLock(userContext, userId);
    if (!user) throw new ApiError(404, 'User not found');
    return Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.BridgeSlots));
  });
}

// GET - retrieve the current player's bridge
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const maxBridgeSlots = await getMaxBridgeSlotsForUser(session.userId!);
    const grid = await inventoryService.getBridge(session.userId!, maxBridgeSlots);
    return NextResponse.json({ grid, maxBridgeSlots });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - remove an item from a specific bridge slot
export async function DELETE(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { row, col } = body;

    if (typeof row !== 'number' || typeof col !== 'number') {
      return NextResponse.json({ error: 'row and col are required numbers' }, { status: 400 });
    }

    const maxBridgeSlots = await getMaxBridgeSlotsForUser(session.userId!);
    const removed = await inventoryService.removeFromBridge(session.userId!, { row, col }, maxBridgeSlots);
    return NextResponse.json({ removed });
  } catch (error) {
    if (error instanceof BridgeSlotEmptyError || error instanceof BridgeSlotInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
