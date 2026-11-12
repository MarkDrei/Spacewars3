/**
 * Tests for saveWorldToDb in worldRepo.ts
 * Verifies the batched UPDATE persists all objects of the world in one statement.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '@/lib/server/database';
import type { DatabaseConnection } from '@/lib/server/database';
import { loadWorldFromDb, saveWorldToDb } from '@/lib/server/world/worldRepo';
import { withTransaction } from '../../helpers/transactionHelper';

async function insertAsteroid(db: DatabaseConnection, x: number, y: number): Promise<number> {
  const result = await db.query(
    `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id)
     VALUES ('asteroid', $1, $2, 0, 0, 1000, 1) RETURNING id`,
    [x, y]
  );
  return result.rows[0].id;
}

async function readPosition(db: DatabaseConnection, id: number) {
  const result = await db.query(
    'SELECT x, y, speed, angle, last_position_update_ms FROM space_objects WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

describe('saveWorldToDb', () => {
  let db: DatabaseConnection;

  beforeAll(async () => {
    db = await getDatabase();
  });

  it('saveWorldToDb_multipleObjectsChanged_persistsAllValues', async () => {
    await withTransaction(async () => {
      const idA = await insertAsteroid(db, 100, 100);
      const idB = await insertAsteroid(db, 200, 200);
      const world = await loadWorldFromDb(db, saveWorldToDb(db));

      const a = world.spaceObjects.find(obj => obj.id === idA)!;
      const b = world.spaceObjects.find(obj => obj.id === idB)!;
      Object.assign(a, { x: 111.5, y: 122.25, speed: 3.5, angle: 45, last_position_update_ms: 5000 });
      Object.assign(b, { x: 333, y: 444, speed: 7, angle: 270.5, last_position_update_ms: 6000 });

      await saveWorldToDb(db)(world);

      expect(await readPosition(db, idA)).toEqual({
        x: 111.5, y: 122.25, speed: 3.5, angle: 45, last_position_update_ms: 5000,
      });
      expect(await readPosition(db, idB)).toEqual({
        x: 333, y: 444, speed: 7, angle: 270.5, last_position_update_ms: 6000,
      });
    });
  });

  it('saveWorldToDb_objectNotInWorld_leavesRowUnchanged', async () => {
    await withTransaction(async () => {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const outsideId = await insertAsteroid(db, 50, 60);

      await saveWorldToDb(db)(world);

      expect(await readPosition(db, outsideId)).toEqual({
        x: 50, y: 60, speed: 0, angle: 0, last_position_update_ms: 1000,
      });
    });
  });
});
