import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { requireAuth, handleApiError } from '@/lib/server/errors';
import { TechFactory } from '@/lib/server/techs/TechFactory';

/**
 * GET /api/tech-catalog
 * Get available weapons and defense items catalog
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    console.log(`📋 Tech catalog requested by user: ${session.userId}`);
    
    const weapons = TechFactory.getAllWeaponSpecs();
    const defenses = TechFactory.getAllDefenseSpecs();
    
    return NextResponse.json({
      success: true,
      weapons,
      defenses,
      weaponKeys: TechFactory.getWeaponKeys(),
      defenseKeys: TechFactory.getDefenseKeys()
    });
    
  } catch (error) {
    console.error('Tech catalog API error:', error);
    return handleApiError(error);
  }
}
