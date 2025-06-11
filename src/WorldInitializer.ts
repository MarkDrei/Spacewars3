import { World } from './World';
import { Ship } from './Ship';
import { Asteroid } from './Asteroid';
import { Shipwreck, SalvageType } from './Shipwreck';
import { EscapePod } from './EscapePod';

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
        value?: number;
    }[];
    shipWrecks?: {
        x: number;
        y: number;
        angle?: number;
        speed?: number;
        value?: number;
        salvageType?: SalvageType;
    }[];
    escapePods?: {
        x: number;
        y: number;
        angle: number;
        speed?: number;
        value?: number;
        survivors?: number;
        distressSignalActive?: boolean;
    }[];
}

export class WorldInitializer {
    /**
     * Creates a default world with predefined objects
     */
    static createDefaultWorld(): World {
        const world = new World();
        
        // Add asteroids in various positions
        world.addSpaceObject(new Asteroid(100, 100, 45, 3));  // Moving northeast
        world.addSpaceObject(new Asteroid(400, 100, 135, 2)); // Moving southeast
        world.addSpaceObject(new Asteroid(400, 400, 225, 4)); // Moving southwest
        world.addSpaceObject(new Asteroid(100, 400, 315, 1)); // Moving northwest
        world.addSpaceObject(new Asteroid(250, 150, 180, 3)); // Moving south
        
        // Add shipwrecks with different salvage types
        world.addSpaceObject(new Shipwreck(150, 150, 0, 0, 10, SalvageType.FUEL));
        world.addSpaceObject(new Shipwreck(350, 350, 0, 0, 15, SalvageType.WEAPONS));
        world.addSpaceObject(new Shipwreck(200, 400, 0, 0, 20, SalvageType.GENERIC));
        
        // Add escape pods
        world.addSpaceObject(new EscapePod(350, 250, Math.PI / 4, 2, 20, 2, true));
        world.addSpaceObject(new EscapePod(100, 300, Math.PI / 2, 3, 25, 3, true));
        world.addSpaceObject(new EscapePod(450, 150, -Math.PI / 6, 1.5, 15, 1, false));
        
        // Add a moving shipwreck (like it's drifting)
        world.addSpaceObject(new Shipwreck(300, 200, Math.PI / 3, 0.5, 30, SalvageType.TECH));
        
        return world;
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
        
        // Create a new ship with the specified configuration
        const ship = new Ship(shipX, shipY, shipAngle, shipSpeed);
        
        // Update the player's ship in the world
        world.setPlayerShip(ship);
        
        // Create and add asteroids
        if (config.asteroids) {
            config.asteroids.forEach(asteroidConfig => {
                const asteroid = new Asteroid(
                    asteroidConfig.x,
                    asteroidConfig.y,
                    asteroidConfig.angleDegrees,
                    asteroidConfig.speed,
                    asteroidConfig.value
                );
                world.addSpaceObject(asteroid);
            });
        }
        
        // Create and add ship wrecks
        if (config.shipWrecks) {
            config.shipWrecks.forEach(wreckConfig => {
                const shipWreck = new Shipwreck(
                    wreckConfig.x,
                    wreckConfig.y,
                    wreckConfig.angle || 0,
                    wreckConfig.speed || 0,
                    wreckConfig.value || 10,
                    wreckConfig.salvageType || SalvageType.GENERIC
                );
                world.addSpaceObject(shipWreck);
            });
        }
        
        // Create and add escape pods
        if (config.escapePods) {
            config.escapePods.forEach(podConfig => {
                const escapePod = new EscapePod(
                    podConfig.x,
                    podConfig.y,
                    podConfig.angle,
                    podConfig.speed || 1,
                    podConfig.value || 15,
                    podConfig.survivors || 1,
                    podConfig.distressSignalActive !== undefined ? podConfig.distressSignalActive : true
                );
                world.addSpaceObject(escapePod);
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