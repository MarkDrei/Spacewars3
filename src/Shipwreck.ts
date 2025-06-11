import { Collectible } from './Collectible';
import { World } from './World';

/**
 * ShipWreck collectible - remains of a destroyed ship that can be salvaged.
 * Provides value points and potentially other benefits when collected.
 */
export class Shipwreck extends Collectible {
    private readonly salvageType: SalvageType;
    
    /**
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param angle - Direction angle in radians
     * @param speed - Movement speed (typically slow or stationary)
     * @param value - Base value/points awarded when collected
     * @param salvageType - Type of salvage in this wreck
     */
    constructor(
        x: number, 
        y: number, 
        angle: number = 0, 
        speed: number = 0, 
        value: number = 10,
        salvageType: SalvageType = SalvageType.GENERIC
    ) {
        super(x, y, angle, speed, value);
        this.salvageType = salvageType;
    }
    
    /**
     * Implementation of abstract method from Collectible.
     * Defines what happens when this ship wreck is collected.
     * @param world - Reference to the game world
     */
    onCollect(world: World): void {
        // Apply effects based on salvage type
        switch (this.salvageType) {
            case SalvageType.FUEL:
                // Example: Increase ship speed
                const ship = world.getShip();
                ship.setSpeed(ship.getSpeed() + 5);
                break;
                
            case SalvageType.WEAPONS:
                // Example effect: Could enhance weapons in future implementation
                // This is a placeholder for future functionality
                console.log("Weapons salvage collected");
                break;
                
            case SalvageType.TECH:
                // Example effect: Could provide tech upgrades in future implementation
                // This is a placeholder for future functionality
                console.log("Tech salvage collected");
                break;
                
            case SalvageType.GENERIC:
            default:
                // Generic salvage just provides points, no special effects
                break;
        }
        
        // Mark as collected
        this.collect();
    }
    
    /**
     * Get the type of collectible for rendering and game logic
     */
    getType(): string {
        return 'shipwreck';
    }
    
    /**
     * Get the salvage type for this wreck
     */
    getSalvageType(): SalvageType {
        return this.salvageType;
    }
}

/**
 * Types of salvage that can be found in a ship wreck
 */
export enum SalvageType {
    GENERIC = 'generic',
    FUEL = 'fuel',
    WEAPONS = 'weapons',
    TECH = 'tech'
} 