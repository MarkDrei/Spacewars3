import { describe, expect, test, beforeEach } from 'vitest';
import { World } from '../src/World';
import { Ship } from '../src/Ship';
import { SpaceObjectOld } from '../src/SpaceObject';

// Create a mock class for SpaceObject since it's abstract
class MockSpaceObject extends SpaceObjectOld {
    constructor(x: number, y: number, angle: number, speed: number) {
        // Create server data object for the new constructor
        const serverData = {
            id: Math.floor(Math.random() * 1000000), // Random ID for testing
            type: 'asteroid' as const,
            x: x,
            y: y,
            speed: speed,
            angle: angle,
            last_position_update_ms: Date.now()
        };
        super(serverData);
    }
}

describe('World', () => {
    let world: World;
    
    beforeEach(() => {
        world = new World();
    });
    
    test('should initialize with default objects', () => {
        // Check that the world has at least one object (the ship)
        expect(world.getSpaceObjects().length).toBeGreaterThan(0);
        
        // Check that one of the objects is a Ship
        const ship = world.getShip();
        expect(ship).toBeInstanceOf(Ship);
        
        // Check that the ship is included in the space objects
        expect(world.getSpaceObjects()).toContain(ship);
    });
    
    // NOTE: Test removed - client-side physics update functionality moved to server
    // The World class no longer has an update() method as physics are handled server-side
    
    test('should update hover states correctly', () => {
        // Create a clean world
        const testWorld = new World();
        const objects = [...testWorld.getSpaceObjects()];
        objects.forEach(obj => testWorld.removeSpaceObject(obj));
        
        // Create a test object at a known position
        const testObject = new MockSpaceObject(100, 100, 0, 0);
        testWorld.addSpaceObject(testObject);
        
        // Update hover states with mouse far from the object
        testWorld.updateHoverStates(0, 0);
        expect(testObject.isHoveredState()).toBe(false);
        
        // Update hover states with mouse over the object
        testWorld.updateHoverStates(100, 100);
        expect(testObject.isHoveredState()).toBe(true);
    });
    
    test('should find hovered objects correctly', () => {
        // Create a clean world with just a ship
        const testWorld = new World();
        const objects = [...testWorld.getSpaceObjects()];
        objects.forEach(obj => testWorld.removeSpaceObject(obj));
        
        // Add a ship (which should be ignored by findHoveredObject)
        const shipData = {
            id: 1,
            type: 'player_ship' as const,
            x: 50,
            y: 50,
            speed: 20,
            angle: 0,
            last_position_update_ms: Date.now()
        };
        const ship = new Ship(shipData);
        ship.setHovered(false); // Make sure ship is not hovered
        testWorld.addSpaceObject(ship);
        
        // Create a test object at a known position
        const testObject = new MockSpaceObject(100, 100, 0, 0);
        testObject.setHovered(false); // Make sure test object is not hovered
        testWorld.addSpaceObject(testObject);
        
        // With no objects hovered, should return undefined
        expect(testWorld.findHoveredObject()).toBeUndefined();
        
        // Set hover state for test object
        testObject.setHovered(true);
        
        // Now findHoveredObject should return the test object
        expect(testWorld.findHoveredObject()).toBe(testObject);
    });
    
    test('should add and remove space objects', () => {
        // Get initial count
        const initialCount = world.getSpaceObjects().length;
        
        // Add a new object
        const newObject = new MockSpaceObject(200, 200, 0, 0);
        world.addSpaceObject(newObject);
        expect(world.getSpaceObjects().length).toBe(initialCount + 1);
        expect(world.getSpaceObjects()).toContain(newObject);
        
        // Remove the object
        world.removeSpaceObject(newObject);
        expect(world.getSpaceObjects().length).toBe(initialCount);
        expect(world.getSpaceObjects()).not.toContain(newObject);
    });
    
    test('should set ship angle correctly', () => {
        // Set a new angle
        const newAngle = Math.PI / 4; // 45 degrees
        world.setShipAngle(newAngle);
        
        // Check that the angle was set
        expect(world.getShip().getAngle()).toBe(newAngle);
    });
}); 