import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Cache forever; ship images do not change at runtime.
export const revalidate = false;

let cachedShipIds: number[] | null = null;
let shipIdsLoadPromise: Promise<number[]> | null = null;

async function loadShipIds(): Promise<number[]> {
  if (cachedShipIds) {
    return cachedShipIds;
  }
  if (shipIdsLoadPromise) {
    return shipIdsLoadPromise;
  }

  shipIdsLoadPromise = (async () => {
    const publicDir = path.join(process.cwd(), 'public', 'assets', 'images');
    const files = await fs.readdir(publicDir);
    const shipIds = files
      .filter(file => /^ship\d+\.png$/.test(file))
      .map(file => parseInt(file.replace('ship', '').replace('.png', ''), 10))
      .sort((a, b) => a - b);

    cachedShipIds = shipIds;
    return shipIds;
  })();

  try {
    return await shipIdsLoadPromise;
  } catch (error) {
    shipIdsLoadPromise = null;
    throw error;
  }
}

export async function GET() {
  try {
    const shipIds = await loadShipIds();
    return NextResponse.json({ ships: shipIds });
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({ ships: [], error: 'Internal server error' }, { status: 500 });
  }
}
