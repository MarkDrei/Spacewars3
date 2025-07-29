// ---
// Repository functions for World persistence
// ---

import sqlite3 from 'sqlite3';
import { World, SpaceObject, SaveWorldCallback } from './world';

/**
 * Load world data from database
 */
export function loadWorld(db: sqlite3.Database, saveCallback: SaveWorldCallback): Promise<World> {
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
        velocity: number;
        angle: number;
        last_position_update: number;
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
 * Save world data to database
 */
export function saveWorldToDb(db: sqlite3.Database): SaveWorldCallback {
  return async (world: World) => {
    return new Promise((resolve, reject) => {
      const updatePromises = world.spaceObjects.map(obj => {
        return new Promise<void>((objResolve, objReject) => {
          db.run(
            'UPDATE space_objects SET x = ?, y = ?, last_position_update = ? WHERE id = ?',
            [obj.x, obj.y, obj.last_position_update, obj.id],
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
 * Delete a space object from database
 */
export function deleteSpaceObject(db: sqlite3.Database, objectId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM space_objects WHERE id = ?', [objectId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Insert a new space object into database
 */
export function insertSpaceObject(db: sqlite3.Database, obj: Omit<SpaceObject, 'id'>): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO space_objects (type, x, y, velocity, angle, last_position_update) VALUES (?, ?, ?, ?, ?, ?)',
      [obj.type, obj.x, obj.y, obj.velocity, obj.angle, obj.last_position_update],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID); // Return the new object's ID
        }
      }
    );
  });
}
