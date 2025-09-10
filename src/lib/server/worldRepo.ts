// ---
// Repository functions for World persistence via in-memory cache with database persistence
// ---

import sqlite3 from 'sqlite3';
import { World, SpaceObject, SaveWorldCallback } from './world';
import { getTypedCacheManager } from './typedCacheManager';
import { createEmptyContext } from './typedLocks';

/**
 * Load world data from database (used internally by cache manager)
 */
export function loadWorldFromDb(db: sqlite3.Database, saveCallback: SaveWorldCallback): Promise<World> {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM space_objects', [], (err, rows) => {
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
      }>).map(row => ({
        ...row,
        type: row.type as SpaceObject['type']
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
 */
export async function loadWorld(db: sqlite3.Database, saveCallback: SaveWorldCallback): Promise<World> {
  // Use typed cache manager for cache-aware access
  const cacheManager = getTypedCacheManager();
  await cacheManager.initialize();
  
  const emptyCtx = createEmptyContext();
  
  // Use world read lock to ensure consistent access
  return await cacheManager.withWorldRead(emptyCtx, async (worldCtx) => {
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
 * Delete a space object from database and update cache
 */
export async function deleteSpaceObject(db: sqlite3.Database, objectId: number): Promise<void> {
  // First delete from database
  await new Promise<void>((resolve, reject) => {
    db.run('DELETE FROM space_objects WHERE id = ?', [objectId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  // Then update cache by refreshing the world
  try {
    // Force cache refresh by reinitializing the world data
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    // Note: The cache manager will automatically reload world data on next access
    // since these operations modify the database directly
  } catch (cacheErr) {
    console.error('Failed to refresh world cache after object deletion:', cacheErr);
    // Don't throw here as the database operation succeeded
  }
}

/**
 * Insert a new space object into database and update cache
 */
export async function insertSpaceObject(db: sqlite3.Database, obj: Omit<SpaceObject, 'id'>): Promise<number> {
  // First insert into database
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

  // Then update cache by refreshing the world
  try {
    // Force cache refresh by reinitializing the world data
    const cacheManager = getTypedCacheManager();
    await cacheManager.initialize();
    // Note: The cache manager will automatically reload world data on next access
    // since these operations modify the database directly
  } catch (cacheErr) {
    console.error('Failed to refresh world cache after object insertion:', cacheErr);
    // Don't throw here as the database operation succeeded
  }

  return objectId;
}
