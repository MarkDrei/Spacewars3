// ---
// Repository functions for World persistence via in-memory cache with database persistence
// Phase 4: Migrated to IronGuard V2
// ---

import sqlite3 from 'sqlite3';
import { World, SpaceObject, SaveWorldCallback } from './world';
import { getTypedCacheManagerV2 } from './typedCacheManagerV2';
import { createLockContext, type LockContext, type LockLevel } from './ironGuardV2';
import type { ValidWorldLockContext } from './ironGuardTypesV2';
import { withWorldLock } from './lockHelpers';

/**
 * Load world data from database (used internally by cache manager)
 * This function is NOT migrated as it's called internally by TypedCacheManagerV2
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
    `;    
    
    db.all(query, [], (err, rows) => {
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
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 * Lock requirement: Can be called with empty context or with locks < WORLD
 */
export async function loadWorld(): Promise<World> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // Create empty context for this operation
  const ctx = createLockContext();
  
  // Acquire WORLD lock to ensure consistent access
  return withWorldLock(ctx, async (worldCtx) => {
    // Get world data safely (we have world lock)
    return cacheManager.getWorldUnsafe(worldCtx);
  });
}

/**
 * Save world data to database
 * This function is NOT migrated as it returns a callback used internally
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
 * Delete a space object
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 */
export async function deleteSpaceObject(
  objectId: number
): Promise<void> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withWorldLock(ctx, async (worldCtx) => {
    cacheManager.deleteSpaceObjectUnsafe(objectId, worldCtx);
  });
}

/**
 * Insert a new space object
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 */
export async function insertSpaceObject(
  obj: Omit<SpaceObject, 'id'>
): Promise<void> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withWorldLock(ctx, async (worldCtx) => {
    cacheManager.insertSpaceObjectUnsafe(obj, worldCtx);
  });
}

/**
 * Get world data with an existing lock context
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 * This version accepts a context that already has appropriate locks
 */
export async function getWorldWithContext<THeld extends readonly LockLevel[]>(
  context: ValidWorldLockContext<THeld>
): Promise<World> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // If context already has WORLD lock, use it directly
  // Type assertion: ValidWorldLockContext ensures this is safe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cacheManager.getWorldUnsafe(context as any);
}
