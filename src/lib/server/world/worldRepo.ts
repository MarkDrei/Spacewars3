// ---
// Repository functions for World persistence via in-memory cache with database persistence
// ---

import { DatabaseConnection } from '../database';
import { World, SpaceObject, SaveWorldCallback } from './world';

/**
 * Load world data from database (used internally by cache manager)
 */
export async function loadWorldFromDb(db: DatabaseConnection, saveCallback: SaveWorldCallback): Promise<World> {
  // Join with users table to get usernames for player ships
  const query = `
    SELECT
      so.id,
      so.type,
      so.x,
      so.y,
      so.speed,
      so.angle,
      so.last_position_update_ms,
      u.username,
      u.id as user_id,
      u.in_battle,
      u.ship_picture_id
    FROM space_objects so
    LEFT JOIN users u ON so.type = 'player_ship' AND so.id = u.ship_id
  `;
  
  const result = await db.query(query);
  
  const spaceObjects = result.rows.map(row => ({
    id: row.id,
    type: row.type as SpaceObject['type'],
    x: row.x,
    y: row.y,
    // Force speed to 0 if player is in battle
    speed: (row.type === 'player_ship' && row.in_battle) ? 0 : row.speed,
    angle: row.angle,
    last_position_update_ms: row.last_position_update_ms,
    // Only include username and userId for player ships
    ...(row.type === 'player_ship' && row.username ? { 
      username: row.username,
      userId: row.user_id,
      shipPictureId: row.ship_picture_id || 1
    } : {})
  }));

  const world = new World(
    { width: 500, height: 500 }, // Hardcoded for now
    spaceObjects,
    saveCallback,
    db
  );

  return world;
}

/**
 * Save world data to database
 */
export function saveWorldToDb(db: DatabaseConnection): SaveWorldCallback {
  return async (world: World) => {
    const updatePromises = world.spaceObjects.map(obj => 
      db.query(
        'UPDATE space_objects SET x = $1, y = $2, speed = $3, angle = $4, last_position_update_ms = $5 WHERE id = $6',
        [obj.x, obj.y, obj.speed, obj.angle, obj.last_position_update_ms, obj.id]
      )
    );

    await Promise.all(updatePromises);
  };
}

/**
 * Delete a space object from database and update cache
 */
export async function deleteSpaceObject(db: DatabaseConnection, objectId: number): Promise<void> {
  await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
}

/**
 * Insert a new space object into database and update cache
 */
export async function insertSpaceObject(db: DatabaseConnection, obj: Omit<SpaceObject, 'id'>): Promise<number> {
  const result = await db.query(
    'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [obj.type, obj.x, obj.y, obj.speed, obj.angle, obj.last_position_update_ms]
  );
  
  return result.rows[0].id;
}
