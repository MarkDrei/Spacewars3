import { Collectible } from './Collectible';
import { Player } from './Player';

/**
 * EscapePod collectible - a life-saving pod ejected from a destroyed ship.
 * Contains survivors that provide value and potentially other benefits when rescued.
 */
export class EscapePod extends Collectible {
    private readonly survivors: number;
    
    /**
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param angle - Direction angle in radians
     * @param speed - Movement speed (typically slow)
     * @param value - Base value/points awarded when collected
     * @param survivors - Number of survivors in the pod
     */
    constructor(
        x: number, 
        y: number, 
        angle: number, 
        speed: number = 1, 
        value: number = 15,
        survivors: number = 1,
    ) {
        super(x, y, angle, speed, value);
        this.survivors = survivors;
        
        // Value is increased based on number of survivors
        this.value = value * survivors;
    }
    
    /**
     * Implementation of abstract method from Collectible.
     * Defines what happens when this escape pod is collected.
     * @param player - Reference to the player
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onCollect(_player: Player): void {
        // Example effect: Could provide benefits based on number of survivors
        // For now, just mark as collected
        this.collect();
        
        // Log rescue information
        console.log(`Rescued ${this.survivors} survivors from escape pod`);
    }
    
    /**
     * Get the type of collectible for rendering and game logic
     */
    getType(): string {
        return 'escapepod';
    }
    
    /**
     * Get number of survivors in the pod
     */
    getSurvivors(): number {
        return this.survivors;
    }
    
    /**
     * Override updatePosition to simulate pod distress signal behavior
     */
    override updatePosition(deltaTime: number): void {
        // Call parent method to update position normally
        super.updatePosition(deltaTime);
    }
} 