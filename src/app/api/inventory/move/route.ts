import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import {
  InventoryService,
  InventorySlotEmptyError,
  InventorySlotInvalidError,
  InventorySlotOccupiedError,
} from '@/lib/server/inventory/InventoryService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

const inventoryService = new InventoryService();

async function getMaxSlotsForUser(userId: number): Promise<number> {
  const emptyCtx = createLockContext();
  const userCache = UserCache.getInstance2();
  return emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const user = await userCache.getUserByIdWithLock(userContext, userId);
    if (!user) throw new ApiError(404, 'User not found');
    return Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots));
  });
}

// POST - move an item from one slot to another
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { from, to } = body;

    if (
      !from || !to ||
      typeof from.row !== 'number' || typeof from.col !== 'number' ||
      typeof to.row !== 'number' || typeof to.col !== 'number'
    ) {
      return NextResponse.json(
        { error: 'from and to must be objects with numeric row and col' },
        { status: 400 }
      );
    }

    await inventoryService.moveItem(session.userId!, from, to, await getMaxSlotsForUser(session.userId!));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof InventorySlotEmptyError ||
      error instanceof InventorySlotInvalidError ||
      error instanceof InventorySlotOccupiedError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
