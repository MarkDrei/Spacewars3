// ---
// Repository functions for World persistence via in-memory cache with database persistence
// ---

import sqlite3 from 'sqlite3';
import { World, SpaceObject, SaveWorldCallback } from './world';
import { getTypedCacheManager } from './typedCacheManager';
import { createEmptyContext, type LockContext } from './ironGuardSystem';

/**
 * Load world data from database (used internally by cache manager)
 */
export function loadWorldFromDb(db: sqlite3.Database, saveCallback: SaveWorldCallback): Promise<World> {
  return new Promise((resolve, reject) => {
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
        u.in_battle
      FROM space_objects so
      LEFT JOIN users u ON so.type = 'player_ship' AND so.id = u.ship_id
    `;    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const spaceObjects = (rows as Array<{
        id: number;
        type: string;
        x: number;
        y: number;
        speed: number;
        angle: number;
        last_position_update_ms: number;
        username: string | null;
        user_id: number | null;
        in_battle: number | null;
      }>).map(row => ({
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
          userId: row.user_id 
        } : {})
      }));

      const world = new World(
        { width: 500, height: 500 }, // Hardcoded for now
        spaceObjects,
        saveCallback,
        db
      );

      resolve(world);
    });
  });
}

/**
 * Load world data via cache manager (cache-aware public function)
 * @param context Lock context from caller (REQUIRED - no default)
 */
export async function loadWorld(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: LockContext<any, any>
): Promise<World> {
  // Use typed cache manager for cache-aware access
  const cacheManager = getTypedCacheManager();
  await cacheManager.initialize();
  
  // Use world read lock to ensure consistent access
  return await cacheManager.withWorldRead(context, async (worldCtx) => {
    // Get world data safely (we have world read lock)
    return cacheManager.getWorldUnsafe(worldCtx);
  });
}

/**
 * Save world data to database
 */
export function saveWorldToDb(db: sqlite3.Database): SaveWorldCallback {
  return async (world: World) => {
    return new Promise((resolve, reject) => {
      const updatePromises = world.spaceObjects.map(obj => {
        return new Promise<void>((objResolve, objReject) => {
          db.run(
            'UPDATE space_objects SET x = ?, y = ?, speed = ?, angle = ?, last_position_update_ms = ? WHERE id = ?',
            [obj.x, obj.y, obj.speed, obj.angle, obj.last_position_update_ms, obj.id],
            (err) => {
              if (err) {
                objReject(err);
              } else {
                objResolve();
              }
            }
          );
        });
      });

      Promise.all(updatePromises)
        .then(() => resolve())
        .catch(reject);
    });
  };
}

/**
 * Delete a space object using cache manager
 * @param context Lock context from caller (REQUIRED - no default)
 */
export async function deleteSpaceObject(
  db: sqlite3.Database,
  objectId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: LockContext<any, any>
): Promise<void> {
  // Use cache manager to delete the object
  const cacheManager = getTypedCacheManager();
  await cacheManager.initialize();
  
  // Use world write lock to delete the object
  await cacheManager.withWorldWrite(context, async (worldCtx) => {
    cacheManager.deleteSpaceObjectUnsafe(objectId, worldCtx);
  });
  
  // Note: The cache manager will persist the change to DB via background persistence
  // or when flushAllToDatabase() is called
}

/**
 * Insert a new space object into database and update cache
 * NOTE: This requires DB write first to get the object ID
 * @param context Lock context from caller (REQUIRED - no default)
 */
export async function insertSpaceObject(
  db: sqlite3.Database,
  obj: Omit<SpaceObject, 'id'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: LockContext<any, any>
): Promise<number> {
  // First insert into database to get the ID
  const objectId = await new Promise<number>((resolve, reject) => {
    db.run(
      'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [obj.type, obj.x, obj.y, obj.speed, obj.angle, obj.last_position_update_ms],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID); // Return the new object's ID
        }
      }
    );
  });

  // Then update cache with the new object including its ID
  try {
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    
    const newObj = { ...obj, id: objectId } as SpaceObject;
    
    // Use world write lock to add the object to cache
    await cacheManager.withWorldWrite(context, async (worldCtx) => {
      const world = cacheManager.getWorldUnsafe(worldCtx);
      world.spaceObjects.push(newObj);
      // Don't mark as dirty since we just wrote to DB
    });
  } catch (cacheErr) {
    console.error('Failed to update world cache after object insertion:', cacheErr);
    // Don't throw here as the database operation succeeded
  }

  return objectId;
}
