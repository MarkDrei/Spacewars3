// POST /api/starbase/buy - Buy a commander from the starbase shop
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { UserCache } from '@/lib/server/user/userCache';
import { InventoryService } from '@/lib/server/inventory/InventoryService';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { commanderBuyPrice } from '@/lib/server/starbase/commanderPrice';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

export const dynamic = 'force-dynamic';

const inventoryService = new InventoryService();

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { slotIndex } = body;

    if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 9) {
      throw new ApiError(400, 'slotIndex must be a number between 0 and 9');
    }

    if (!session.starbaseShop || session.starbaseShop.length === 0) {
      throw new ApiError(400, 'No shop available. Visit the shop first.');
    }

    const commander = session.starbaseShop[slotIndex];
    if (!commander) {
      throw new ApiError(400, 'Invalid slot index');
    }

    const price = commanderBuyPrice(commander);
    const userId = session.userId!;

    const userCache = UserCache.getInstance2();
    const context = createLockContext();

    const newIron = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const user = await userCache.getUserByIdWithLock(userContext, userId);
      if (!user) throw new ApiError(404, 'User not found');

      if (user.iron < price) {
        throw new ApiError(400, `Insufficient iron. Need ${price}, have ${user.iron}`);
      }

      const bonuses = await UserBonusCache.getInstance().getBonuses(userContext, userId);
      user.updateStats(Math.floor(Date.now() / 1000), bonuses);
      user.subtractIron(price);

      await userCache.updateUserInCache(userContext, user);

      const maxSlots = Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots));

      // Add to inventory (USER_INVENTORY_LOCK acquired internally — safe to nest under USER_LOCK)
      await inventoryService.addItemToFirstFreeSlotWithoutLock(userId, commander, maxSlots);

      return user.iron;
    });

    return NextResponse.json({ success: true, newIron });
  } catch (error) {
    return handleApiError(error);
  }
}
