import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public', 'assets', 'images');
    console.log('[API] Scanning for ships in:', publicDir);
    
    let files: string[] = [];
    try {
      files = await fs.readdir(publicDir);
    } catch (error) {
      console.error('[API] Error reading images directory:', error);
      return NextResponse.json({ ships: [], error: 'Failed to read directory' }, { status: 500 });
    }
    
    const shipIds = files
      .filter(file => /^ship\d+\.png$/.test(file))
      .map(file => parseInt(file.replace('ship', '').replace('.png', ''), 10))
      .sort((a, b) => a - b);
      
    return NextResponse.json({ ships: shipIds });
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json({ ships: [], error: 'Internal server error' }, { status: 500 });
  }
}
