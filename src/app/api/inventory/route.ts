import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';
import { InventoryService, InventorySlotEmptyError, InventorySlotInvalidError } from '@/lib/server/inventory/InventoryService';

const inventoryService = new InventoryService();

// GET - retrieve the current player's inventory
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    const grid = await inventoryService.getInventory(session.userId);
    return NextResponse.json({ grid });
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

    const removed = await inventoryService.removeItem(session.userId, { row, col });
    return NextResponse.json({ removed });
  } catch (error) {
    if (error instanceof InventorySlotEmptyError || error instanceof InventorySlotInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
