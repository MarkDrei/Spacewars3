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
        
        // Add some collectibles to the default world
        world.addSpaceObject(new Shipwreck(150, 150, 0, 0, 10, SalvageType.FUEL));
        world.addSpaceObject(new EscapePod(350, 250, Math.PI / 4, 2, 20, 2, true));
        
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