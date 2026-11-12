// ---
// Repository functions for World persistence via in-memory cache with database persistence
// ---

import { DatabaseConnection } from '../database';
import { World, SpaceObject, SaveWorldCallback } from './world';
import { DEFAULT_WORLD_BOUNDS } from '@shared/worldConstants';
import { normalizePosition } from '@shared/physics';
import { calculateLevelFromXp } from '@shared/utils/levelUtils';

/**
 * Load world data from database (used internally by cache manager)
 *
 * Option B: Level information for player ships is fetched from the users table on
 * WorldCache initialisation and kept in the in-memory SpaceObject. This avoids
 * extra per-request DB look-ups while ensuring the level is available for rendering
 * and attack-range checks without a separate API call.
 */
export async function loadWorldFromDb(db: DatabaseConnection, saveCallback: SaveWorldCallback): Promise<World> {
  // Join with users table to get usernames and XP for player ships
  const query = `
    SELECT
      so.id,
      so.type,
      so.x,
      so.y,
      so.speed,
      so.angle,
      so.last_position_update_ms,
      so.picture_id,
      u.username,
      u.id as user_id,
      u.in_battle,
      u.xp
    FROM space_objects so
    LEFT JOIN users u ON so.type = 'player_ship' AND so.id = u.ship_id
  `;
  
  const result = await db.query(query);
  
  const spaceObjects = result.rows.map(row => {
    // Normalize positions to ensure they're within valid world bounds
    const normalized = normalizePosition(row.x, row.y, DEFAULT_WORLD_BOUNDS);
    
    return {
      id: row.id,
      type: row.type as SpaceObject['type'],
      x: normalized.x,
      y: normalized.y,
      // Force speed to 0 if player is in battle
      speed: (row.type === 'player_ship' && row.in_battle) ? 0 : row.speed,
      angle: row.angle,
      last_position_update_ms: row.last_position_update_ms,
      picture_id: row.picture_id || 1, // Default to 1 if not set
      // Only include username, userId, and level for player ships with a valid user record
      ...(row.type === 'player_ship' && row.username && row.user_id != null ? { 
        username: row.username,
        userId: row.user_id,
        level: calculateLevelFromXp(row.xp ?? 0),
      } : {})
    };
  });

  const world = new World(
    DEFAULT_WORLD_BOUNDS,
    spaceObjects,
    saveCallback,
    db
  );

  return world;
}

/**
 * Save world data to database.
 *
 * Uses a single batched UPDATE (UNNEST over parallel arrays) instead of one query per object:
 * one round trip, atomic, and no concurrent queries on a single client (deprecated in pg 8.20+,
 * removed in pg 9 — relevant for the shared transaction client in tests).
 */
export function saveWorldToDb(db: DatabaseConnection): SaveWorldCallback {
  return async (world: World) => {
    const objects = world.spaceObjects;
    if (objects.length === 0) {
      return;
    }

    await db.query(
      `UPDATE space_objects AS s
          SET x = v.x, y = v.y, speed = v.speed, angle = v.angle,
              last_position_update_ms = v.last_position_update_ms
         FROM UNNEST($1::int[], $2::float8[], $3::float8[], $4::float8[], $5::float8[], $6::float8[])
              AS v(id, x, y, speed, angle, last_position_update_ms)
        WHERE s.id = v.id`,
      [
        objects.map(obj => obj.id),
        objects.map(obj => obj.x),
        objects.map(obj => obj.y),
        objects.map(obj => obj.speed),
        objects.map(obj => obj.angle),
        objects.map(obj => obj.last_position_update_ms),
      ]
    );
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
    'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [obj.type, obj.x, obj.y, obj.speed, obj.angle, obj.last_position_update_ms, obj.picture_id || 1]
  );
  
  return result.rows[0].id;
}
