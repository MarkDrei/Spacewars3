import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { InventoryService } from '@/lib/server/inventory/InventoryService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { BridgeGrid } from '@/lib/server/inventory/inventoryTypes';

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

// POST - persist a reordered bridge grid
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { grid } = body as { grid: BridgeGrid };

    if (!Array.isArray(grid)) {
      return NextResponse.json({ error: 'grid must be an array' }, { status: 400 });
    }

    const maxBridgeSlots = await getMaxBridgeSlotsForUser(session.userId!);
    await inventoryService.reorderBridge(session.userId!, grid, maxBridgeSlots);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
