import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import {
  InventoryService,
  InventorySlotEmptyError,
  InventorySlotInvalidError,
  InventorySlotOccupiedError,
  BridgeSlotEmptyError,
  BridgeSlotInvalidError,
  BridgeSlotOccupiedError,
  BridgeItemIncompatibleError,
  InventoryFullError,
  BridgeFullError,
} from '@/lib/server/inventory/InventoryService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';

const inventoryService = new InventoryService();

async function getMaxSlotsForUser(userId: number): Promise<{ maxInventorySlots: number; maxBridgeSlots: number }> {
  const emptyCtx = createLockContext();
  const userCache = UserCache.getInstance2();
  return emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
    const user = await userCache.getUserByIdWithLock(userContext, userId);
    if (!user) throw new ApiError(404, 'User not found');
    return {
      maxInventorySlots: Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.InventorySlots)),
      maxBridgeSlots: Math.floor(getResearchEffectFromTree(user.techTree, ResearchType.BridgeSlots)),
    };
  });
}

interface SlotCoordBody {
  row: number;
  col: number;
}

function isValidSlotBody(s: unknown): s is SlotCoordBody {
  return (
    typeof s === 'object' && s !== null &&
    typeof (s as SlotCoordBody).row === 'number' &&
    typeof (s as SlotCoordBody).col === 'number'
  );
}

/**
 * POST /api/bridge/transfer/auto
 *
 * Body: { direction: 'inventoryToBridge' | 'bridgeToInventory', from: SlotCoord }
 *
 * Moves an item from the specified source slot into the first free slot on the
 * opposite storage area. Returns the destination coordinate in the response.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { direction, from } = body;

    if (direction !== 'inventoryToBridge' && direction !== 'bridgeToInventory') {
      return NextResponse.json(
        { error: 'direction must be "inventoryToBridge" or "bridgeToInventory"' },
        { status: 400 }
      );
    }

    if (!isValidSlotBody(from)) {
      return NextResponse.json(
        { error: 'from must be an object with numeric row and col' },
        { status: 400 }
      );
    }

    const { maxInventorySlots, maxBridgeSlots } = await getMaxSlotsForUser(session.userId!);
    let dest: SlotCoordBody;

    if (direction === 'inventoryToBridge') {
      dest = await inventoryService.moveInventoryToBridgeFirstFree(
        session.userId!, from, maxInventorySlots, maxBridgeSlots
      );
    } else {
      dest = await inventoryService.moveBridgeToInventoryFirstFree(
        session.userId!, from, maxBridgeSlots, maxInventorySlots
      );
    }

    UserBonusCache.getInstance().invalidateBonuses(session.userId!);
    return NextResponse.json({ success: true, to: dest });
  } catch (error) {
    if (
      error instanceof InventorySlotEmptyError ||
      error instanceof InventorySlotInvalidError ||
      error instanceof InventorySlotOccupiedError ||
      error instanceof BridgeSlotEmptyError ||
      error instanceof BridgeSlotInvalidError ||
      error instanceof BridgeSlotOccupiedError ||
      error instanceof BridgeItemIncompatibleError ||
      error instanceof InventoryFullError ||
      error instanceof BridgeFullError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
