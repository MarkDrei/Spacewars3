import { WorldInitializer, WorldConfig } from '../WorldInitializer';
import { Ship } from '../Ship';
import { Asteroid } from '../Asteroid';
import { Collectible } from '../Collectible';

describe('WorldInitializer', () => {
    test('should create a default world', () => {
        // Act
        const world = WorldInitializer.createDefaultWorld();
        
        // Assert
        expect(world).toBeDefined();
        expect(world.getShip()).toBeInstanceOf(Ship);
        expect(world.getSpaceObjects().length).toBeGreaterThan(1); // Ship + some asteroids
    });
    
    test('should create a world from config with custom ship', () => {
        // Arrange
        const config: WorldConfig = {
            ship: {
                x: 100,
                y: 200,
                angle: Math.PI,
                speed: 30
            }
        };
        
        // Act
        const world = WorldInitializer.createWorldFromConfig(config);
        
        // Get the ship and verify it's set correctly
        const ship = world.getShip();
        
        // Assert
        expect(ship.getX()).toBe(100);
        expect(ship.getY()).toBe(200);
        expect(ship.getAngle()).toBe(Math.PI);
        expect(ship.getSpeed()).toBe(30);
    });
    
    test('should create a world from config with custom asteroids', () => {
        // Arrange
        const config: WorldConfig = {
            asteroids: [
                {
                    x: 50,
                    y: 60,
                    angleDegrees: 90,
                    speed: 5,
                    value: 10
                },
                {
                    x: -50,
                    y: -60,
                    angleDegrees: 270,
                    speed: 10,
                    value: 15
                }
            ]
        };
        
        // Act
        const world = WorldInitializer.createWorldFromConfig(config);
        
        // Assert
        // Should have ship + 2 asteroids
        expect(world.getSpaceObjects().length).toBe(3);
        
        // Filter out the ship to get just the asteroids
        const asteroids = world.getSpaceObjects().filter(obj => obj !== world.getShip());
        expect(asteroids.length).toBe(2);
        
        // Check asteroid positions (order might vary)
        const positions = asteroids.map(a => ({ x: a.getX(), y: a.getY() }));
        expect(positions).toContainEqual(expect.objectContaining({ x: 50, y: 60 }));
        expect(positions).toContainEqual(expect.objectContaining({ x: -50, y: -60 }));
        
        // Verify they are collectible
        asteroids.forEach(asteroid => {
            expect(asteroid).toBeInstanceOf(Collectible);
            expect(asteroid).toBeInstanceOf(Asteroid);
        });
    });
    
    test('should create a world from config with partial ship properties', () => {
        // Arrange
        const config: WorldConfig = {
            ship: {
                x: 100,
                // y is not specified
                angle: Math.PI
                // speed is not specified
            }
        };
        
        // Act
        const world = WorldInitializer.createWorldFromConfig(config);
        
        // Assert
        const ship = world.getShip();
        expect(ship.getX()).toBe(100);
        expect(ship.getY()).toBe(0); // Default value
        expect(ship.getAngle()).toBe(Math.PI);
        expect(ship.getSpeed()).toBe(20); // Default value
    });
    
    test('should create a world from config with empty config', () => {
        // Arrange
        const config: WorldConfig = {};
        
        // Act
        const world = WorldInitializer.createWorldFromConfig(config);
        
        // Assert
        expect(world).toBeDefined();
        expect(world.getShip()).toBeInstanceOf(Ship);
        expect(world.getSpaceObjects().length).toBe(1); // Just the ship
    });
});