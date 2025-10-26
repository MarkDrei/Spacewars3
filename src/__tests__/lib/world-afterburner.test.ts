import { describe, expect, test } from 'vitest';
import { World, SpaceObject } from '@/lib/server/world';
import { getDatabase } from '@/lib/server/database';

describe('World Afterburner Physics', () => {
  const db = getDatabase();
  const dummySave = async () => { /* no-op */ };

  test('updatePhysics_noAfterburnerActive_normalPhysics', () => {
    const ship: SpaceObject = {
      id: 1,
      type: 'player_ship',
      x: 100,
      y: 100,
      speed: 25,
      angle: 0,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: null,
      afterburner_cooldown_end_ms: null,
      afterburner_old_max_speed: null
    };

    const world = new World(
      { width: 500, height: 500 },
      [ship],
      dummySave,
      db
    );

    // Update physics by 1 second
    world.updatePhysics(2000);

    const updatedShip = world.getSpaceObject(1);
    expect(updatedShip).toBeDefined();
    expect(updatedShip!.speed).toBe(25); // Speed unchanged
    expect(updatedShip!.afterburner_cooldown_end_ms).toBeNull();
  });

  test('updatePhysics_cooldownNotYetReached_noChange', () => {
    const ship: SpaceObject = {
      id: 1,
      type: 'player_ship',
      x: 100,
      y: 100,
      speed: 50, // Boosted speed
      angle: 0,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 50,
      afterburner_cooldown_end_ms: 5000, // Cooldown ends at 5000
      afterburner_old_max_speed: 25
    };

    const world = new World(
      { width: 500, height: 500 },
      [ship],
      dummySave,
      db
    );

    // Update physics to time 3000 (before cooldown end)
    world.updatePhysics(3000);

    const updatedShip = world.getSpaceObject(1);
    expect(updatedShip).toBeDefined();
    expect(updatedShip!.speed).toBe(50); // Speed still boosted
    expect(updatedShip!.afterburner_cooldown_end_ms).toBe(5000); // Cooldown still active
  });

  test('updatePhysics_cooldownEnds_restoresSpeed', () => {
    const ship: SpaceObject = {
      id: 1,
      type: 'player_ship',
      x: 100,
      y: 100,
      speed: 50, // Boosted speed
      angle: 0,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 50,
      afterburner_cooldown_end_ms: 3000, // Cooldown ends at 3000
      afterburner_old_max_speed: 25
    };

    const world = new World(
      { width: 500, height: 500 },
      [ship],
      dummySave,
      db
    );

    // Update physics to time 5000 (after cooldown end)
    world.updatePhysics(5000);

    const updatedShip = world.getSpaceObject(1);
    expect(updatedShip).toBeDefined();
    // Speed should be restored to old max speed
    expect(updatedShip!.speed).toBe(25);
    // Afterburner state should be cleared
    expect(updatedShip!.afterburner_cooldown_end_ms).toBeNull();
    expect(updatedShip!.afterburner_boosted_speed).toBeNull();
    expect(updatedShip!.afterburner_old_max_speed).toBeNull();
  });

  test('updatePhysics_cooldownEnds_keepsLowerSpeed', () => {
    const ship: SpaceObject = {
      id: 1,
      type: 'player_ship',
      x: 100,
      y: 100,
      speed: 10, // Lower than old max speed (user slowed down)
      angle: 0,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 50,
      afterburner_cooldown_end_ms: 3000, // Cooldown ends at 3000
      afterburner_old_max_speed: 25
    };

    const world = new World(
      { width: 500, height: 500 },
      [ship],
      dummySave,
      db
    );

    // Update physics to time 5000 (after cooldown end)
    world.updatePhysics(5000);

    const updatedShip = world.getSpaceObject(1);
    expect(updatedShip).toBeDefined();
    // Speed should remain at 10 (lower than old max)
    expect(updatedShip!.speed).toBe(10);
    // Afterburner state should be cleared
    expect(updatedShip!.afterburner_cooldown_end_ms).toBeNull();
  });

  test('updatePhysics_cooldownEndsMidUpdate_splitsCalculation', () => {
    const ship: SpaceObject = {
      id: 1,
      type: 'player_ship',
      x: 100,
      y: 100,
      speed: 50, // Boosted speed
      angle: 90, // Moving straight up
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 50,
      afterburner_cooldown_end_ms: 3000, // Cooldown ends mid-update
      afterburner_old_max_speed: 25
    };

    const world = new World(
      { width: 500, height: 500 },
      [ship],
      dummySave,
      db
    );

    // Update physics from 1000 to 5000 (4 seconds = 4000ms)
    // Ship moves at 50 units/min for 2000ms (until 3000)
    // Then moves at 25 units/min for 2000ms (after 3000)
    world.updatePhysics(5000);

    const updatedShip = world.getSpaceObject(1);
    expect(updatedShip).toBeDefined();
    
    // Final speed should be old max speed
    expect(updatedShip!.speed).toBe(25);
    
    // Position should reflect split calculation
    // Physics uses factor=50 and speed in units/min
    // 2000ms at 50 units/min: 50 * 2000 / 60000 * 50 = 83.33 units
    // 2000ms at 25 units/min: 25 * 2000 / 60000 * 50 = 41.67 units
    // Total = 125 units in Y direction (angle 90)
    // Y should be approximately 100 + 125 = 225
    expect(updatedShip!.y).toBeCloseTo(225, 0);
    
    // Afterburner state should be cleared
    expect(updatedShip!.afterburner_cooldown_end_ms).toBeNull();
  });

  test('updatePhysics_multiplShips_onlyAffectsShipsWithCooldown', () => {
    const ship1: SpaceObject = {
      id: 1,
      type: 'player_ship',
      x: 100,
      y: 100,
      speed: 50,
      angle: 0,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: 50,
      afterburner_cooldown_end_ms: 3000,
      afterburner_old_max_speed: 25
    };

    const ship2: SpaceObject = {
      id: 2,
      type: 'player_ship',
      x: 200,
      y: 200,
      speed: 30,
      angle: 0,
      last_position_update_ms: 1000,
      afterburner_boosted_speed: null,
      afterburner_cooldown_end_ms: null,
      afterburner_old_max_speed: null
    };

    const world = new World(
      { width: 500, height: 500 },
      [ship1, ship2],
      dummySave,
      db
    );

    world.updatePhysics(5000);

    const updatedShip1 = world.getSpaceObject(1);
    const updatedShip2 = world.getSpaceObject(2);

    // Ship 1 should have afterburner cleared and speed restored
    expect(updatedShip1!.speed).toBe(25);
    expect(updatedShip1!.afterburner_cooldown_end_ms).toBeNull();

    // Ship 2 should be unaffected
    expect(updatedShip2!.speed).toBe(30);
    expect(updatedShip2!.afterburner_cooldown_end_ms).toBeNull();
  });
});
