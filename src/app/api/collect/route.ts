import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { calculateToroidalDistance } from '@shared/physics';
import { getDatabase } from '@/lib/server/database';
import { getUserById, saveUserToDb } from '@/lib/server/userRepo';
import { loadWorld, saveWorldToDb } from '@/lib/server/worldRepo';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    const body = await request.json();
    const { objectId } = body;
    
    if (!objectId || typeof objectId !== 'number') {
      throw new ApiError(400, 'Missing or invalid object ID');
    }
    
    const db = getDatabase();
    
    // Load user and world data
    const user = await getUserById(db, session.userId, saveUserToDb(db));
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const world = await loadWorld(db, saveWorldToDb(db));
    
    // Update physics for all objects first
    const currentTime = Date.now();
    world.updatePhysics(currentTime);
    
    // Find the object to collect
    const targetObject = world.getSpaceObject(objectId);
    if (!targetObject) {
      throw new ApiError(404, 'Object not found');
    }
    
    // Check if object is collectible
    if (targetObject.type === 'player_ship') {
      throw new ApiError(400, 'Cannot collect player ships');
    }
    
    // Find player's ship in the world
    const playerShips = world.getSpaceObjectsByType('player_ship');
    const playerShip = playerShips.find(ship => ship.id === user.ship_id);
    
    if (!playerShip) {
      throw new ApiError(404, 'Player ship not found');
    }
    
    // Calculate distance between player ship and target object using toroidal distance
    const distance = calculateToroidalDistance(
      playerShip,
      targetObject,
      world.worldSize
    );
    
    // Check if within collection range (125 units)
    if (distance > 125) {
      throw new ApiError(400, 'Object too far away');
    }
    
    // Collect the object
    user.collected(targetObject.type);
    await world.collected(objectId);
    
    // Save changes
    await user.save();
    await world.save();
    
    return NextResponse.json({ success: true, distance });
  } catch (error) {
    return handleApiError(error);
  }
}
