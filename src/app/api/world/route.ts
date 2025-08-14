import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDatabase } from '@/lib/server/database';
import { loadWorld, saveWorldToDb } from '@/lib/server/worldRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth } from '@/lib/server/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);

    // console.log(`🌍 World data request - userId: ${session.userId}`);

    const db = getDatabase();
    
    // Load world data from database
    const world = await loadWorld(db, saveWorldToDb(db));
    
    // Update physics for all objects
    const currentTime = Date.now();
    world.updatePhysics(currentTime);
    
    // Log all ships in the world for debugging
    // const ships = world.getSpaceObjectsByType('player_ship');
    // console.log(`🚢 All ships in world (${ships.length} total):`);
    // ships.forEach(ship => {
    //   console.log(`  Ship ID: ${ship.id}, position: (${ship.x}, ${ship.y}), speed: ${ship.speed}, angle: ${ship.angle}, lastUpdate: ${ship.last_position_update_ms}`);
    // });
    
    // // Log total object counts
    // const objectCounts = world.spaceObjects.reduce((counts: Record<string, number>, obj) => {
    //   counts[obj.type] = (counts[obj.type] || 0) + 1;
    //   return counts;
    // }, {});
    // console.log(`📊 Object counts:`, objectCounts);
    
    // Save updated positions back to database
    await world.save();
    
    // Return world data
    const worldData = world.getWorldData();
    return NextResponse.json(worldData);
  } catch (error) {
    return handleApiError(error);
  }
}
