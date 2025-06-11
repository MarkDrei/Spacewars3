import { Collectible } from './Collectible';
import { Player } from './Player';

export class Asteroid extends Collectible {
    constructor(x: number, y: number, angleDegrees: number, speed: number, value: number = 5) {
        // Convert degrees to radians and adjust for 0 degrees pointing up
        const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
        super(x, y, angleRadians, speed, value);
    }

    /**
     * Define what happens when this asteroid is collected
     * @param player - Reference to the player
     */
    onCollect(player: Player): void {
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