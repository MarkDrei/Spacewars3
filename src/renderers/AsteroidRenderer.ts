import { Asteroid } from '../Asteroid';
import { SpaceObject } from '../SpaceObject';
import { Collectible } from '../Collectible';
import { CollectibleRenderer } from './CollectibleRenderer';

export class AsteroidRenderer extends CollectibleRenderer {
    private asteroidImage: HTMLImageElement;

    constructor() {
        super();
        this.asteroidImage = new Image();
        // Updated path to the asteroid image
        this.asteroidImage.src = 'resources/ai_gen/asteroid1.png';
    }

    drawAsteroid(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number, asteroid: SpaceObject): void {
        // Use the base class method to handle common drawing functionality
        this.drawCollectible(ctx, centerX, centerY, shipX, shipY, asteroid as Collectible);
    }

    /**
     * Implementation of the abstract method from CollectibleRenderer
     */
    protected drawCollectibleShape(ctx: CanvasRenderingContext2D, collectible: Collectible): void {
        if (this.asteroidImage.complete && this.asteroidImage.naturalHeight !== 0) {
            const size = 35; // Size of the asteroid
            ctx.drawImage(this.asteroidImage, -size / 2, -size / 2, size, size);
        }
    }
} 