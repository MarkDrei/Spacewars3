// POST /api/starbase/sell - Sell a commander from the player's inventory
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { InventoryService, InventorySlotEmptyError, InventorySlotInvalidError } from '@/lib/server/inventory/InventoryService';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { commanderSellPrice } from '@/lib/server/starbase/commanderPrice';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

export const dynamic = 'force-dynamic';

const inventoryService = new InventoryService();

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { row, col } = body;

    if (typeof row !== 'number' || typeof col !== 'number' || row < 0 || col < 0) {
      throw new ApiError(400, 'row and col must be non-negative numbers');
    }

    const userId = session.userId!;
    const userCache = UserCache.getInstance2();

    // Acquire USER_LOCK for the entire operation to avoid double acquisition
    const context = createLockContext();
    const { newIron, ironEarned } = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, userId);
      if (!user) throw new ApiError(404, 'User not found');

      const maxSlots = Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots));

      // Remove item from inventory (acquires USER_INVENTORY_LOCK internally — safe to nest under USER_LOCK)
      const item = await inventoryService.removeItem(userId, { row, col }, maxSlots);

      if (item.itemType !== 'commander') {
        // Re-add the item since we removed the wrong type
        await inventoryService.addItemToFirstFreeSlotWithoutLock(userId, item, maxSlots);
        throw new ApiError(400, 'Item is not a commander');
      }

      const price = commanderSellPrice(item);

      const bonuses = await UserBonusCache.getInstance().getBonuses(userContext, userId);
      user.updateStats(Math.floor(Date.now() / 1000), bonuses);
      user.addIron(price);
      await userCache.updateUserInCache(userContext, user);

      return { newIron: user.iron, ironEarned: price };
    });

    return NextResponse.json({ success: true, newIron, ironEarned });
  } catch (error) {
    if (error instanceof InventorySlotEmptyError || error instanceof InventorySlotInvalidError) {
      return NextResponse.json({ error: 'Invalid or empty inventory slot' }, { status: 400 });
    }
    return handleApiError(error);
  }
}
