// POST /api/starbase/buy - Buy a commander from the starbase shop
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { InventoryService, InventoryFullError } from '@/lib/server/inventory/InventoryService';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { commanderBuyPrice } from '@/lib/server/starbase/commanderPrice';
import { StarbaseShop, SHOP_SIZE } from '@/lib/server/starbase/StarbaseShop';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

export const dynamic = 'force-dynamic';

const inventoryService = new InventoryService();

/**
 * POST /api/starbase/buy
 * Buys the offer in `slotIndex` of the user's server-side shop.
 *
 * Everything runs under USER_LOCK (4): the offer is taken from the shop, placed in the inventory
 * (USER_INVENTORY_LOCK (5) is acquired inside - valid order) and only then paid for. If placing
 * fails (e.g. inventory full) the offer goes back to the shop and no iron is charged.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    const userId = session.userId!;

    const body = await request.json();
    const slotIndex: unknown = body?.slotIndex;
    if (!Number.isInteger(slotIndex) || (slotIndex as number) < 0 || (slotIndex as number) >= SHOP_SIZE) {
      throw new ApiError(400, `slotIndex must be an integer between 0 and ${SHOP_SIZE - 1}`);
    }
    const slot = slotIndex as number;

    const userCache = UserCache.getInstance2();
    const shop = StarbaseShop.getInstance();

    const newIron = await createLockContext().useLockWithAcquire(USER_LOCK, async (userContext) => {
      if (!shop.getOffers(userContext, userId)) {
        throw new ApiError(400, 'No shop available. Visit the shop first.');
      }

      const user = await userCache.getUserByIdWithLock(userContext, userId);
      if (!user) throw new ApiError(404, 'User not found');

      const commander = shop.takeOffer(userContext, userId, slot);
      if (!commander) {
        throw new ApiError(400, 'Invalid slot index');
      }

      const price = commanderBuyPrice(commander);
      try {
        if (user.iron < price) {
          throw new ApiError(400, `Insufficient iron. Need ${price}, have ${user.iron}`);
        }
        const maxSlots = Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots));
        await inventoryService.addItemToFirstFreeSlotWithoutLock(userId, commander, maxSlots);
      } catch (error) {
        shop.restoreOffer(userContext, userId, slot, commander);
        throw error;
      }

      user.subtractIron(price);
      await userCache.updateUserInCache(userContext, user);
      return user.iron;
    });

    return NextResponse.json({ success: true, newIron });
  } catch (error) {
    if (error instanceof InventoryFullError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
