import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import {
  InventoryService,
  InventorySlotEmptyError,
  InventorySlotInvalidError,
  InventorySlotOccupiedError,
  BridgeSlotEmptyError,
  BridgeSlotInvalidError,
  BridgeSlotOccupiedError,
  BridgeItemIncompatibleError,
} from '@/lib/server/inventory/InventoryService';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';

const inventoryService = new InventoryService();

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

/**
 * POST /api/bridge/transfer
 *
 * Body: { direction: 'inventoryToBridge' | 'bridgeToInventory', from: SlotCoord, to: SlotCoord }
 *
 * Moves an item atomically between the player's inventory and their bridge.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const body = await request.json();
    const { direction, from, to } = body;

    if (direction !== 'inventoryToBridge' && direction !== 'bridgeToInventory') {
      return NextResponse.json(
        { error: 'direction must be "inventoryToBridge" or "bridgeToInventory"' },
        { status: 400 }
      );
    }

    if (!isValidSlotBody(from) || !isValidSlotBody(to)) {
      return NextResponse.json(
        { error: 'from and to must be objects with numeric row and col' },
        { status: 400 }
      );
    }

    const { maxInventorySlots, maxBridgeSlots } = await getMaxSlotsForUser(session.userId!);

    if (direction === 'inventoryToBridge') {
      await inventoryService.moveInventoryToBridge(
        session.userId!, from, to, maxInventorySlots, maxBridgeSlots
      );
    } else {
      await inventoryService.moveBridgeToInventory(
        session.userId!, from, to, maxBridgeSlots, maxInventorySlots
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof InventorySlotEmptyError ||
      error instanceof InventorySlotInvalidError ||
      error instanceof InventorySlotOccupiedError ||
      error instanceof BridgeSlotEmptyError ||
      error instanceof BridgeSlotInvalidError ||
      error instanceof BridgeSlotOccupiedError ||
      error instanceof BridgeItemIncompatibleError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
