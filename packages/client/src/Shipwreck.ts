import { Collectible } from './Collectible';

/**
 * Shipwreck collectible - remains of a destroyed ship that can be salvaged.
 * Provides value points when collected.
 */
export class Shipwreck extends Collectible {
    /**
     * @param x - X coordinate  
     * @param y - Y coordinate
     * @param angleDegrees - Direction angle in degrees (0-360)
     * @param speed - Movement speed (typically slow)
     * @param value - Base value/points awarded when collected
     */
    constructor(
        x: number, 
        y: number, 
        angleDegrees: number = 0, 
        speed: number = 2,
        value: number = 10
    ) {
        super(x, y, angleDegrees, speed, value);
    }
    
    /**
     * Implementation of abstract method from Collectible.
     * Defines what happens when this shipwreck is collected.
     * @param _player - Reference to the player (unused for shipwrecks)
     */
    onCollect(): void {
        // Mark as collected - no special effects
        this.collect();
    }
    
    /**
     * Get the type of collectible for rendering and game logic
     */
    getType(): string {
        return 'shipwreck';
    }
}