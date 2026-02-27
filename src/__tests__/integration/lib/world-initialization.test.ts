/**
 * Tests for world initialization with shared constants
 * Verifies that World.createDefault() and loadWorldFromDb() use shared world size constants
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { World } from '../../../lib/server/world/world';
import { loadWorldFromDb } from '../../../lib/server/world/worldRepo';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT, DEFAULT_WORLD_BOUNDS } from '@shared/worldConstants';
import { getDatabase } from '../../../lib/server/database';
import type { DatabaseConnection } from '../../../lib/server/database';

describe('worldInitialization_usesSharedConstants', () => {
  let db: DatabaseConnection;

  beforeAll(async () => {
    db = await getDatabase();
  });

  afterAll(async () => {
    // Database cleanup is handled by test environment
  });

  it('worldCreateDefault_size_matchesSharedConstants', () => {
    const saveCallback = async () => {};
    const world = World.createDefault(saveCallback, db);

    expect(world.worldSize.width).toBe(DEFAULT_WORLD_WIDTH);
    expect(world.worldSize.height).toBe(DEFAULT_WORLD_HEIGHT);
  });

  it('worldCreateDefault_size_matchesDefaultWorldBounds', () => {
    const saveCallback = async () => {};
    const world = World.createDefault(saveCallback, db);

    expect(world.worldSize).toEqual(DEFAULT_WORLD_BOUNDS);
  });

  it('loadWorldFromDb_size_matchesSharedConstants', async () => {
    const saveCallback = async () => {};
    const world = await loadWorldFromDb(db, saveCallback);

    expect(world.worldSize.width).toBe(DEFAULT_WORLD_WIDTH);
    expect(world.worldSize.height).toBe(DEFAULT_WORLD_HEIGHT);
  });

  it('loadWorldFromDb_size_matchesDefaultWorldBounds', async () => {
    const saveCallback = async () => {};
    const world = await loadWorldFromDb(db, saveCallback);

    expect(world.worldSize).toEqual(DEFAULT_WORLD_BOUNDS);
  });

  it('worldSize_currentValue_is5000x5000', () => {
    // World size updated to 5000x5000 (Goal 8 complete)
    expect(DEFAULT_WORLD_WIDTH).toBe(5000);
    expect(DEFAULT_WORLD_HEIGHT).toBe(5000);
  });
});
