/**
 * Tests for InterceptCalculator usage of World dimensions
 * 
 * Verifies that InterceptCalculator correctly uses World.WIDTH and World.HEIGHT
 * static properties (which are now initialized from shared constants).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InterceptCalculator } from '../../lib/client/game/InterceptCalculator';
import { World } from '../../lib/client/game/World';
import { Ship } from '../../lib/client/game/Ship';
import { Asteroid } from '../../lib/client/game/Asteroid';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

describe('InterceptCalculator world dimension integration', () => {
  
  beforeEach(() => {
    // Reset World dimensions to defaults
    World.WIDTH = DEFAULT_WORLD_WIDTH;
    World.HEIGHT = DEFAULT_WORLD_HEIGHT;
  });
  
  describe('interceptCalculation_worldWrapping_useWorldStaticProperties', () => {
    it('should calculate intercept angles considering world wrapping', () => {
      // Create a ship at position (100, 250)
      const shipData = {
        id: 1,
        type: 'player_ship' as const,
        x: 100,
        y: 250,
        speed: 30,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1
      };
      const ship = new Ship(shipData);
      
      // Create an asteroid near opposite edge (450, 250) moving right
      const asteroidData = {
        id: 2,
        type: 'asteroid' as const,
        x: 450,
        y: 250,
        speed: 10,
        angle: 0, // Moving right/east
        last_position_update_ms: Date.now(),
        picture_id: 1,
        asteroidType: 'M' as const,
        size: 'medium' as const,
        value: 100
      };
      const asteroid = new Asteroid(asteroidData);
      
      // Calculate intercept (worldSize: 500, maxSpeed: 30)
      const result = InterceptCalculator.calculateInterceptAngle(ship, asteroid, World.WIDTH, 30);
      
      // Should find a valid intercept angle (not NaN)
      expect(result.angle).not.toBeNaN();
      expect(result.timeToIntercept).toBeGreaterThan(0);
      expect(result.timeToIntercept).toBeLessThan(Number.POSITIVE_INFINITY);
      
      // Intercept point should be within world bounds
      expect(result.interceptPoint.x).toBeGreaterThanOrEqual(0);
      expect(result.interceptPoint.x).toBeLessThan(World.WIDTH);
      expect(result.interceptPoint.y).toBeGreaterThanOrEqual(0);
      expect(result.interceptPoint.y).toBeLessThan(World.HEIGHT);
    });
    
    it('should handle targets wrapping around world edges', () => {
      // Ship near right edge
      const shipData = {
        id: 1,
        type: 'player_ship' as const,
        x: 480, // Near right edge in 500-wide world
        y: 250,
        speed: 25,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1
      };
      const ship = new Ship(shipData);
      
      // Target near left edge, moving right (will wrap around)
      const asteroidData = {
        id: 2,
        type: 'asteroid' as const,
        x: 20, // Near left edge
        y: 250,
        speed: 15,
        angle: 0, // Moving right
        last_position_update_ms: Date.now(),
        picture_id: 1,
        asteroidType: 'M' as const,
        size: 'medium' as const,
        value: 100
      };
      const asteroid = new Asteroid(asteroidData);
      
      // Calculate intercept (worldSize: 500, maxSpeed: 25)
      const result = InterceptCalculator.calculateInterceptAngle(ship, asteroid, World.WIDTH, 25);
      
      // Should find valid intercept considering wrapping
      expect(result.angle).not.toBeNaN();
      expect(result.timeToIntercept).toBeLessThan(Number.POSITIVE_INFINITY);
      
      // Verify intercept point is valid
      expect(result.interceptPoint.x).toBeGreaterThanOrEqual(0);
      expect(result.interceptPoint.x).toBeLessThan(DEFAULT_WORLD_WIDTH);
      expect(result.interceptPoint.y).toBeGreaterThanOrEqual(0);
      expect(result.interceptPoint.y).toBeLessThan(DEFAULT_WORLD_HEIGHT);
    });
  });
  
  describe('interceptCalculation_worldResize_adaptToNewDimensions', () => {
    it('should adapt calculations when World dimensions change', () => {
      // Simulate server update changing world size
      World.WIDTH = 1000;
      World.HEIGHT = 1000;
      
      const shipData = {
        id: 1,
        type: 'player_ship' as const,
        x: 500,
        y: 500,
        speed: 20,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1
      };
      const ship = new Ship(shipData);
      
      const asteroidData = {
        id: 2,
        type: 'asteroid' as const,
        x: 900, // Near edge in 1000-wide world
        y: 500,
        speed: 10,
        angle: 90, // Moving down
        last_position_update_ms: Date.now(),
        picture_id: 1,
        asteroidType: 'M' as const,
        size: 'medium' as const,
        value: 100
      };
      const asteroid = new Asteroid(asteroidData);
      
      const result = InterceptCalculator.calculateInterceptAngle(ship, asteroid, World.WIDTH, 20);
      
      // Should calculate correctly with new world size
      expect(result.angle).not.toBeNaN();
      expect(result.timeToIntercept).toBeLessThan(Number.POSITIVE_INFINITY);
      
      // Reset for other tests
      World.WIDTH = DEFAULT_WORLD_WIDTH;
      World.HEIGHT = DEFAULT_WORLD_HEIGHT;
    });
  });
  
  describe('interceptCalculation_stationary_handleEdgeCases', () => {
    it('should handle ship at same position as target', () => {
      const shipData = {
        id: 1,
        type: 'player_ship' as const,
        x: 250,
        y: 250,
        speed: 20,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1
      };
      const ship = new Ship(shipData);
      
      const asteroidData = {
        id: 2,
        type: 'asteroid' as const,
        x: 250, // Same position
        y: 250,
        speed: 10,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1,
        asteroidType: 'M' as const,
        size: 'medium' as const,
        value: 100
      };
      const asteroid = new Asteroid(asteroidData);
      
      const result = InterceptCalculator.calculateInterceptAngle(ship, asteroid, World.WIDTH);
      
      // Time to intercept should be 0 (already at target)
      expect(result.timeToIntercept).toBe(0);
      expect(result.interceptPoint.x).toBe(250);
      expect(result.interceptPoint.y).toBe(250);
    });
    
    it('should handle ship with zero speed', () => {
      const shipData = {
        id: 1,
        type: 'player_ship' as const,
        x: 100,
        y: 100,
        speed: 0, // Not moving
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1
      };
      const ship = new Ship(shipData);
      
      const asteroidData = {
        id: 2,
        type: 'asteroid' as const,
        x: 300,
        y: 300,
        speed: 10,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1,
        asteroidType: 'M' as const,
        size: 'medium' as const,
        value: 100
      };
      const asteroid = new Asteroid(asteroidData);
      
      const result = InterceptCalculator.calculateInterceptAngle(ship, asteroid, World.WIDTH);
      
      // Interception impossible with zero speed
      expect(result.angle).toBeNaN();
      expect(result.timeToIntercept).toBe(Number.POSITIVE_INFINITY);
    });
  });
  
  describe('sharedConstants_interceptCalculator_maintainCompatibility', () => {
    it('should work with default shared constants', () => {
      // Verify InterceptCalculator works with shared constants (500x500)
      expect(World.WIDTH).toBe(DEFAULT_WORLD_WIDTH);
      expect(World.HEIGHT).toBe(DEFAULT_WORLD_HEIGHT);
      
      const shipData = {
        id: 1,
        type: 'player_ship' as const,
        x: 250,
        y: 250,
        speed: 25,
        angle: 0,
        last_position_update_ms: Date.now(),
        picture_id: 1
      };
      const ship = new Ship(shipData);
      
      const asteroidData = {
        id: 2,
        type: 'asteroid' as const,
        x: 400,
        y: 250,
        speed: 5,
        angle: 180, // Moving left/west
        last_position_update_ms: Date.now(),
        picture_id: 1,
        asteroidType: 'M' as const,
        size: 'medium' as const,
        value: 100
      };
      const asteroid = new Asteroid(asteroidData);
      
      const result = InterceptCalculator.calculateInterceptAngle(ship, asteroid, World.WIDTH, 25);
      
      // Should successfully calculate intercept
      expect(result.angle).not.toBeNaN();
      expect(result.timeToIntercept).toBeGreaterThan(0);
      expect(result.timeToIntercept).toBeLessThan(Number.POSITIVE_INFINITY);
    });
  });
});
