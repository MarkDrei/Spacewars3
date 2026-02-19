import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import {
  InventoryService,
  InventorySlotEmptyError,
  InventorySlotInvalidError,
  InventorySlotOccupiedError,
} from '@/lib/server/inventory/InventoryService';

const inventoryService = new InventoryService();

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

    await inventoryService.moveItem(session.userId, from, to);
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
