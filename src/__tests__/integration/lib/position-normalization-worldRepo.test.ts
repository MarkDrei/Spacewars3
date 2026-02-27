/**
 * Tests for position normalization in worldRepo.ts
 * Verifies that positions loaded from database are normalized to valid world bounds
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../../../lib/server/database';
import type { DatabaseConnection } from '../../../lib/server/database';
import { loadWorldFromDb, saveWorldToDb } from '../../../lib/server/world/worldRepo';
import { DEFAULT_WORLD_BOUNDS } from '@shared/worldConstants';

describe('loadWorldFromDb position normalization', () => {
  let db: DatabaseConnection;

  beforeAll(async () => {
    db = await getDatabase();
  });

  it('loadWorldFromDb_outOfBoundsPositiveX_normalizesToValidRange', async () => {
    // Insert a test object with x beyond world width
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', 506.667, 250, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      // Load world from database
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      
      // Find the test object
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position was normalized (506.667 % 5000 = 506.667)
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBeCloseTo(506.667, 2);
      expect(testObject!.y).toBe(250);
    } finally {
      // Clean up
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_outOfBoundsPositiveY_normalizesToValidRange', async () => {
    // Insert a test object with y beyond world height
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', 250, 510, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position was normalized (510 % 5000 = 510)
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(250);
      expect(testObject!.y).toBe(510);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_negativePositionX_wrapsToPositiveRange', async () => {
    // Insert a test object with negative x
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', -100, 250, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position was normalized (-100 wraps to 4900 in 5000-width world)
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(4900);
      expect(testObject!.y).toBe(250);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_negativePositionY_wrapsToPositiveRange', async () => {
    // Insert a test object with negative y
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', 250, -50, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position was normalized (-50 wraps to 4950 in 5000-height world)
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(250);
      expect(testObject!.y).toBe(4950);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_veryLargePosition_normalizesCorrectly', async () => {
    // Insert a test object with very large coordinates
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', 30000, 25000, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position was normalized
      // 30000 % 5000 = 0, 25000 % 5000 = 0
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(0);
      expect(testObject!.y).toBe(0);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_veryNegativePosition_normalizesCorrectly', async () => {
    // Insert a test object with very negative coordinates
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', -3010, -2505, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position was normalized
      // ((-3010 % 5000) + 5000) % 5000 = ((-3010) + 5000) % 5000 = 1990
      // ((-2505 % 5000) + 5000) % 5000 = ((-2505) + 5000) % 5000 = 2495
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(1990);
      expect(testObject!.y).toBe(2495);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_positionWithinBounds_remainsUnchanged', async () => {
    // Insert a test object with valid coordinates
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', 250, 300, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position remains unchanged
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(250);
      expect(testObject!.y).toBe(300);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_floatingPointPosition_normalizesCorrectly', async () => {
    // Insert a test object with floating point coordinates
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', 250.5, 300.75, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify floating point position is handled correctly
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBeCloseTo(250.5, 2);
      expect(testObject!.y).toBeCloseTo(300.75, 2);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_positionAtBoundary_wrapsToZero', async () => {
    // Insert a test object at exact boundary (should wrap to 0)
    const result = await db.query(
      `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['asteroid', DEFAULT_WORLD_BOUNDS.width, DEFAULT_WORLD_BOUNDS.height, 0, 0, Date.now(), 1]
    );
    const objectId = result.rows[0].id;

    try {
      const world = await loadWorldFromDb(db, saveWorldToDb(db));
      const testObject = world.spaceObjects.find(obj => obj.id === objectId);
      
      // Verify position at boundary wraps to 0
      expect(testObject).toBeDefined();
      expect(testObject!.x).toBe(0);
      expect(testObject!.y).toBe(0);
    } finally {
      await db.query('DELETE FROM space_objects WHERE id = $1', [objectId]);
    }
  });

  it('loadWorldFromDb_multipleObjectsWithVariousPositions_allNormalizedCorrectly', async () => {
    // Insert multiple test objects with different position scenarios
    const objects = [
      { x: 5100, y: 250, expectedX: 100, expectedY: 250 },
      { x: -100, y: 350, expectedX: 4900, expectedY: 350 },
      { x: 250, y: 5010, expectedX: 250, expectedY: 10 }
    ];

    const insertedIds: number[] = [];

    try {
      // Insert all test objects
      for (const obj of objects) {
        const result = await db.query(
          `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms, picture_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          ['asteroid', obj.x, obj.y, 0, 0, Date.now(), 1]
        );
        insertedIds.push(result.rows[0].id);
      }

      // Load world from database
      const world = await loadWorldFromDb(db, saveWorldToDb(db));

      // Verify all objects were normalized correctly
      for (let i = 0; i < insertedIds.length; i++) {
        const testObject = world.spaceObjects.find(o => o.id === insertedIds[i]);
        expect(testObject).toBeDefined();
        expect(testObject!.x).toBe(objects[i].expectedX);
        expect(testObject!.y).toBe(objects[i].expectedY);
      }
    } finally {
      // Clean up all test objects
      for (const id of insertedIds) {
        await db.query('DELETE FROM space_objects WHERE id = $1', [id]);
      }
    }
  });
});
