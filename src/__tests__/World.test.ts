import { World } from '../World';
import { Ship } from '../Ship';
// import { Asteroid } from '../Asteroid'; // Commented out as it's unused
import { SpaceObject } from '../SpaceObject';

// Create a mock class for SpaceObject since it's abstract
class MockSpaceObject extends SpaceObject {
    constructor(x: number, y: number, angle: number, speed: number) {
        super(x, y, angle, speed);
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
    
    test('should update all objects positions', () => {
        // Create a world with predictable motion
        const testWorld = new World();
        
        // Remove all existing objects
        const objects = [...testWorld.getSpaceObjects()];
        objects.forEach(obj => testWorld.removeSpaceObject(obj));
        
        // Add a ship moving along the x-axis
        const ship = new Ship();
        ship.setX(0);
        ship.setY(0);
        ship.setAngle(0); // Moving right
        ship.setSpeed(10);
        testWorld.addSpaceObject(ship);
        
        // Add a mock space object instead of an Asteroid to avoid angle conversion
        const spaceObject = new MockSpaceObject(100, 100, Math.PI/2, 20); // Moving up
        testWorld.addSpaceObject(spaceObject);
        
        // Get initial positions
        const initialShipX = ship.getX();
        const initialShipY = ship.getY();
        const initialObjectX = spaceObject.getX();
        const initialObjectY = spaceObject.getY();
        
        // Update the world with a time delta
        testWorld.update(1.0); // 1 second
        
        // Ship should have moved along x-axis
        expect(ship.getX()).toBeGreaterThan(initialShipX);
        expect(ship.getY()).toEqual(initialShipY); // Y shouldn't change
        
        // Object should have moved along y-axis
        expect(spaceObject.getX()).toEqual(initialObjectX); // X shouldn't change
        expect(spaceObject.getY()).toBeGreaterThan(initialObjectY); // Y should increase
    });
    
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
        const ship = new Ship();
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
        
        // Check that interception data is cleared
        expect(world.getInterceptionData()).toBeNull();
    });
}); 