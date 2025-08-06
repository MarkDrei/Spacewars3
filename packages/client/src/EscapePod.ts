import { Collectible } from './Collectible';

/**
 * EscapePod collectible - a life-saving pod ejected from a destroyed ship.
 * Contains survivors that provide value and potentially other benefits when rescued.
 */
export class EscapePod extends Collectible {
    private survivors: number;
    
    /**
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param angleDegrees - Direction angle in degrees (0-360)
     * @param speed - Movement speed (typically slow)
     * @param value - Base value/points awarded when collected
     * @param survivors - Number of survivors in the pod
     */
    constructor(
        x: number, 
        y: number, 
        angleDegrees: number, 
        speed: number = 1, 
        value: number = 15,
        survivors: number = 1
    ) {
        super(x, y, angleDegrees, speed, value);
        this.survivors = survivors;
    }
    
    /**
     * Get the number of survivors in this escape pod
     */
    getSurvivors(): number {
        return this.survivors;
    }
    
    /**
     * Implementation of abstract method from Collectible.
     * Defines what happens when this escape pod is collected.
     */
    onCollect(): void {
        // Example effect: Could provide benefits based on number of survivors
        // For now, just mark as collected
        this.collect();
    }
    
    /**
     * Get the type of collectible for rendering and game logic
     */
    getType(): string {
        return 'escapepod';
    }
    
    // NOTE: updatePosition override removed - all positions come from server
    // /**
    //  * Override updatePosition to simulate pod distress signal behavior
    //  */
    // override updatePosition(deltaTime: number): void {
    //     // Call parent method to update position normally
    //     super.updatePosition(deltaTime);
    // }
} 