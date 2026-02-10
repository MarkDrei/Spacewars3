/**
 * Tests for position normalization in client World.ts
 * Verifies that positions received from server are normalized before object creation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../lib/client/game/World';
import { WorldData } from '@shared/types/gameTypes';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

describe('updateFromServerData position normalization', () => {
  let world: World;

  beforeEach(() => {
    // Reset static properties
    World.WIDTH = DEFAULT_WORLD_WIDTH;
    World.HEIGHT = DEFAULT_WORLD_HEIGHT;
    
    // Create a world instance without default initialization
    world = new World(false);
  });

  it('updateFromServerData_outOfBoundsPositiveX_normalizesToValidRange', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 506.667, // Out of bounds
          y: 250,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized (506.667 % 500 = 6.667)
    expect(objects[0].getX()).toBeCloseTo(6.667, 2);
    expect(objects[0].getY()).toBe(250);
  });

  it('updateFromServerData_outOfBoundsPositiveY_normalizesToValidRange', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 250,
          y: 510, // Out of bounds
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized (510 % 500 = 10)
    expect(objects[0].getX()).toBe(250);
    expect(objects[0].getY()).toBe(10);
  });

  it('updateFromServerData_negativePositionX_wrapsToPositiveRange', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: -100, // Negative
          y: 250,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized (-100 wraps to 400 in 500-width world)
    expect(objects[0].getX()).toBe(400);
    expect(objects[0].getY()).toBe(250);
  });

  it('updateFromServerData_negativePositionY_wrapsToPositiveRange', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 250,
          y: -50, // Negative
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized (-50 wraps to 450 in 500-height world)
    expect(objects[0].getX()).toBe(250);
    expect(objects[0].getY()).toBe(450);
  });

  it('updateFromServerData_veryLargePosition_normalizesCorrectly', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 30000, // Very large
          y: 25000, // Very large
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized (30000 % 500 = 0, 25000 % 500 = 0)
    expect(objects[0].getX()).toBe(0);
    expect(objects[0].getY()).toBe(0);
  });

  it('updateFromServerData_veryNegativePosition_normalizesCorrectly', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: -3010, // Very negative
          y: -2505, // Very negative
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized
    // ((-3010 % 500) + 500) % 500 = 490
    // ((-2505 % 500) + 500) % 500 = 495
    expect(objects[0].getX()).toBe(490);
    expect(objects[0].getY()).toBe(495);
  });

  it('updateFromServerData_positionWithinBounds_remainsUnchanged', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 250,
          y: 300,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position remains unchanged
    expect(objects[0].getX()).toBe(250);
    expect(objects[0].getY()).toBe(300);
  });

  it('updateFromServerData_floatingPointPosition_normalizesCorrectly', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 250.5,
          y: 300.75,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify floating point position is handled correctly
    expect(objects[0].getX()).toBeCloseTo(250.5, 2);
    expect(objects[0].getY()).toBeCloseTo(300.75, 2);
  });

  it('updateFromServerData_positionAtBoundary_wrapsToZero', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 500, // At boundary
          y: 500, // At boundary
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position at boundary wraps to 0
    expect(objects[0].getX()).toBe(0);
    expect(objects[0].getY()).toBe(0);
  });

  it('updateFromServerData_playerShipWithOutOfBoundsPosition_normalizesCorrectly', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'player_ship',
          x: 600, // Out of bounds
          y: -50, // Negative
          speed: 20,
          angle: 45,
          last_position_update_ms: Date.now(),
          picture_id: 1,
          username: 'test_player',
          userId: 123
        }
      ]
    };

    world.updateFromServerData(worldData, 1);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify player ship position was normalized
    // 600 % 500 = 100, -50 wraps to 450
    expect(objects[0].getX()).toBe(100);
    expect(objects[0].getY()).toBe(450);
  });

  it('updateFromServerData_multipleObjectTypesWithVariousPositions_allNormalizedCorrectly', () => {
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'player_ship',
          x: 600,
          y: 250,
          speed: 20,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1,
          username: 'player1',
          userId: 1
        },
        {
          id: 2,
          type: 'asteroid',
          x: -100,
          y: 350,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        },
        {
          id: 3,
          type: 'asteroid',
          x: 250,
          y: 510,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        },
        {
          id: 4,
          type: 'asteroid',
          x: 1000,
          y: -200,
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData, 1);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(4);
    
    // Verify all objects were normalized correctly
    // Player ship: 600 % 500 = 100, 250 unchanged
    expect(objects[0].getX()).toBe(100);
    expect(objects[0].getY()).toBe(250);
    
    // Asteroid: -100 wraps to 400, 350 unchanged
    expect(objects[1].getX()).toBe(400);
    expect(objects[1].getY()).toBe(350);
    
    // Asteroid: 250 unchanged, 510 % 500 = 10
    expect(objects[2].getX()).toBe(250);
    expect(objects[2].getY()).toBe(10);
    
    // Asteroid: 1000 % 500 = 0, -200 wraps to 300
    expect(objects[3].getX()).toBe(0);
    expect(objects[3].getY()).toBe(300);
  });

  it('updateFromServerData_customWorldSize_normalizesWithCorrectBounds', () => {
    const worldData: WorldData = {
      worldSize: { width: 1000, height: 2000 }, // Custom size
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: 1500, // Should wrap in 1000-width world
          y: 2500, // Should wrap in 2000-height world
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // Verify position was normalized with custom world size
    // 1500 % 1000 = 500, 2500 % 2000 = 500
    expect(objects[0].getX()).toBe(500);
    expect(objects[0].getY()).toBe(500);
    
    // Verify world dimensions were updated
    expect(World.WIDTH).toBe(1000);
    expect(World.HEIGHT).toBe(2000);
  });

  it('updateFromServerData_normalizationOccursBeforeObjectConstruction_ensuresValidObjectState', () => {
    // This test verifies that normalization happens before object construction
    // by checking that objects are created with normalized values
    const worldData: WorldData = {
      worldSize: { width: 500, height: 500 },
      currentTime: Date.now(),
      spaceObjects: [
        {
          id: 1,
          type: 'asteroid',
          x: -50, // Will be normalized to 450
          y: 600, // Will be normalized to 100
          speed: 0,
          angle: 0,
          last_position_update_ms: Date.now(),
          picture_id: 1
        }
      ]
    };

    world.updateFromServerData(worldData);
    
    const objects = world.getSpaceObjects();
    expect(objects.length).toBe(1);
    
    // If normalization happened before construction, the object should have normalized values
    const asteroid = objects[0];
    expect(asteroid.getX()).toBe(450);
    expect(asteroid.getY()).toBe(100);
    
    // Verify the object is in a valid state (not corrupted by invalid initial coordinates)
    expect(asteroid.getId()).toBe(1);
    expect(asteroid.getSpeed()).toBe(0);
  });
});
