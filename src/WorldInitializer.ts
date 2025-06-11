import { World } from './World';
import { Ship } from './Ship';
import { Asteroid } from './Asteroid';

export interface WorldConfig {
    ship?: {
        x?: number;
        y?: number;
        angle?: number;
        speed?: number;
    };
    asteroids?: {
        x: number;
        y: number;
        angleDegrees: number;
        speed: number;
    }[];
}

export class WorldInitializer {
    /**
     * Creates a default world with predefined objects
     */
    static createDefaultWorld(): World {
        return new World();
    }
    
    /**
     * Creates a world from a configuration object
     */
    static createWorldFromConfig(config: WorldConfig): World {
        const world = new World();
        
        // Clear the default objects
        const defaultObjects = [...world.getSpaceObjects()];
        defaultObjects.forEach(obj => world.removeSpaceObject(obj));
        
        // Create and add ship with config values
        let shipX = 0;
        let shipY = 0;
        let shipAngle = 0;
        let shipSpeed = 20;
        
        if (config.ship) {
            if (config.ship.x !== undefined) shipX = config.ship.x;
            if (config.ship.y !== undefined) shipY = config.ship.y;
            if (config.ship.angle !== undefined) shipAngle = config.ship.angle;
            if (config.ship.speed !== undefined) shipSpeed = config.ship.speed;
        }
        
        const ship = new Ship(shipX, shipY, shipAngle, shipSpeed);
        world.addSpaceObject(ship);
        
        // Create and add asteroids
        if (config.asteroids) {
            config.asteroids.forEach(asteroidConfig => {
                const asteroid = new Asteroid(
                    asteroidConfig.x,
                    asteroidConfig.y,
                    asteroidConfig.angleDegrees,
                    asteroidConfig.speed
                );
                world.addSpaceObject(asteroid);
            });
        }
        
        return world;
    }
    
    /**
     * Loads a world configuration from a JSON file
     * Note: This would need to be implemented differently for browser vs Node.js
     */
    static async loadWorldFromFile(filePath: string): Promise<World> {
        try {
            const response = await fetch(filePath);
            const config = await response.json();
            return WorldInitializer.createWorldFromConfig(config);
        } catch (error) {
            console.error(`Failed to load world from ${filePath}:`, error);
            return WorldInitializer.createDefaultWorld();
        }
    }
} 