import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { InventoryService, InventorySlotEmptyError, InventorySlotInvalidError } from '@/lib/server/inventory/InventoryService';
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

// GET - retrieve the current player's inventory
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const maxSlots = await getMaxSlotsForUser(session.userId!);
    const grid = await inventoryService.getInventory(session.userId!, maxSlots);
    return NextResponse.json({ grid, maxSlots });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - remove an item from a specific slot
export async function DELETE(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { row, col } = body;

    if (typeof row !== 'number' || typeof col !== 'number') {
      return NextResponse.json({ error: 'row and col are required numbers' }, { status: 400 });
    }

    const maxSlots = await getMaxSlotsForUser(session.userId!);
    const removed = await inventoryService.removeItem(session.userId!, { row, col }, maxSlots);
    return NextResponse.json({ removed });
  } catch (error) {
    if (error instanceof InventorySlotEmptyError || error instanceof InventorySlotInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
