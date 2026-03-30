import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { InventoryService } from '@/lib/server/inventory/InventoryService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { InventoryGrid } from '@/lib/server/inventory/inventoryTypes';

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

// POST - persist a reordered inventory grid
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { grid } = body as { grid: InventoryGrid };

    if (!Array.isArray(grid)) {
      return NextResponse.json({ error: 'grid must be an array' }, { status: 400 });
    }

    const maxSlots = await getMaxSlotsForUser(session.userId!);
    await inventoryService.reorderInventory(session.userId!, grid, maxSlots);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
