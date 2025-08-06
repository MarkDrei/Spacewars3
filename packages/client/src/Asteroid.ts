import { Collectible } from './Collectible';

export class Asteroid extends Collectible {
    constructor(x: number, y: number, angleDegrees: number, speed: number, value: number = 5) {
        // Pass degrees directly - no conversion needed
        super(x, y, angleDegrees, speed, value);
    }

    /**
     * Define what happens when this asteroid is collected
     * @param player - Reference to the player
     */
    onCollect(): void {
        // For now, just basic collection behavior
        // Points are already added in the Player.collectItem method
        this.collect();
    }

    /**
     * Get the type of collectible
     */
    getType(): string {
        return 'asteroid';
    }
} 