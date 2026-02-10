/**
 * Tests for client-side World class usage of shared constants
 * 
 * Verifies that the client World class properly imports and uses
 * shared world constants as default values for WIDTH and HEIGHT.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../lib/client/game/World';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

describe('World class shared constants integration', () => {
  
  describe('worldStaticProperties_initialization_matchSharedConstants', () => {
    it('should initialize World.WIDTH from DEFAULT_WORLD_WIDTH', () => {
      // The World.WIDTH should be initialized from shared constants
      // Currently 500, will be 5000 after Goal 8
      expect(World.WIDTH).toBe(DEFAULT_WORLD_WIDTH);
      expect(World.WIDTH).toBe(500);
    });
    
    it('should initialize World.HEIGHT from DEFAULT_WORLD_HEIGHT', () => {
      // The World.HEIGHT should be initialized from shared constants
      // Currently 500, will be 5000 after Goal 8
      expect(World.HEIGHT).toBe(DEFAULT_WORLD_HEIGHT);
      expect(World.HEIGHT).toBe(500);
    });
  });
  
  describe('worldStaticProperties_serverUpdate_overrideDefaults', () => {
    let world: World;
    
    beforeEach(() => {
      // Create a fresh World instance
      world = new World(false); // Don't initialize with defaults
      
      // Reset static properties to defaults (in case previous tests modified them)
      World.WIDTH = DEFAULT_WORLD_WIDTH;
      World.HEIGHT = DEFAULT_WORLD_HEIGHT;
    });
    
    it('should allow server data to override WIDTH and HEIGHT', () => {
      // Simulate server update with different dimensions
      const serverWorldData = {
        worldSize: { width: 5000, height: 5000 },
        currentTime: Date.now(),
        spaceObjects: [
          {
            id: 1,
            type: 'player_ship' as const,
            x: 2500,
            y: 2500,
            speed: 20,
            angle: 0,
            last_position_update_ms: Date.now(),
            picture_id: 1
          }
        ]
      };
      
      world.updateFromServerData(serverWorldData, 1);
      
      // Verify static properties were updated
      expect(World.WIDTH).toBe(5000);
      expect(World.HEIGHT).toBe(5000);
      
      // Reset for other tests
      World.WIDTH = DEFAULT_WORLD_WIDTH;
      World.HEIGHT = DEFAULT_WORLD_HEIGHT;
    });
    
    it('should use defaults before server update', () => {
      // Before updateFromServerData is called, should use shared constants
      expect(World.WIDTH).toBe(DEFAULT_WORLD_WIDTH);
      expect(World.HEIGHT).toBe(DEFAULT_WORLD_HEIGHT);
    });
  });
  
  describe('worldInstanceMethods_dimensions_useStaticProperties', () => {
    let world: World;
    
    beforeEach(() => {
      world = new World(false);
      World.WIDTH = DEFAULT_WORLD_WIDTH;
      World.HEIGHT = DEFAULT_WORLD_HEIGHT;
    });
    
    it('should return WIDTH from getWidth()', () => {
      expect(world.getWidth()).toBe(World.WIDTH);
      expect(world.getWidth()).toBe(DEFAULT_WORLD_WIDTH);
    });
    
    it('should return HEIGHT from getHeight()', () => {
      expect(world.getHeight()).toBe(World.HEIGHT);
      expect(world.getHeight()).toBe(DEFAULT_WORLD_HEIGHT);
    });
  });
  
  describe('worldWrapping_positions_useSharedConstants', () => {
    let world: World;
    
    beforeEach(() => {
      world = new World(false);
      World.WIDTH = DEFAULT_WORLD_WIDTH;
      World.HEIGHT = DEFAULT_WORLD_HEIGHT;
    });
    
    it('should wrap positions using World.WIDTH and World.HEIGHT', () => {
      // Test position wrapping at boundaries
      const wrapped1 = world.wrapPosition(600, 300);
      expect(wrapped1.x).toBe(100); // 600 % 500 = 100
      expect(wrapped1.y).toBe(300);
      
      const wrapped2 = world.wrapPosition(250, 700);
      expect(wrapped2.x).toBe(250);
      expect(wrapped2.y).toBe(200); // 700 % 500 = 200
    });
    
    it('should wrap negative positions correctly', () => {
      const wrapped = world.wrapPosition(-100, -50);
      expect(wrapped.x).toBe(400); // -100 wraps to 400 in 500-wide world
      expect(wrapped.y).toBe(450); // -50 wraps to 450 in 500-high world
    });
    
    it('should handle positions exactly at boundaries', () => {
      const wrapped = world.wrapPosition(DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT);
      expect(wrapped.x).toBe(0); // 500 % 500 = 0
      expect(wrapped.y).toBe(0); // 500 % 500 = 0
    });
  });
  
  describe('sharedConstants_consistency_maintainSingleSource', () => {
    it('should use the same constants as server-side code', () => {
      // This ensures client and server start with same default world size
      // The server will send actual world size to client, which may differ
      expect(World.WIDTH).toBe(DEFAULT_WORLD_WIDTH);
      expect(World.HEIGHT).toBe(DEFAULT_WORLD_HEIGHT);
    });
    
    it('should reference constants that will scale to 5000x5000 in Goal 8', () => {
      // Document that these values will change in Goal 8
      // Currently 500x500, future 5000x5000
      expect(DEFAULT_WORLD_WIDTH).toBe(500);
      expect(DEFAULT_WORLD_HEIGHT).toBe(500);
      
      // When Goal 8 is complete, these values will both be 5000
    });
  });
});
