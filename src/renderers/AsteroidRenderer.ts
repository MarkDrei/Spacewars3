// import { Asteroid } from '../Asteroid'; // Commented out as it's unused
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
        this.drawDustTrail(ctx, collectible);
        
        if (this.asteroidImage.complete && this.asteroidImage.naturalHeight !== 0) {
            const size = 45; // Size of the asteroid
            ctx.drawImage(this.asteroidImage, -size / 2, -size / 2, size, size);
        }
        
    }

    private drawDustTrail(ctx: CanvasRenderingContext2D, asteroid: Collectible): void {
        if (asteroid.getSpeed() === 0) return;

        const trailLength = 150;
        const particleCount = 35;
        const asteroidAngle = asteroid.getAngle();
        const trailDirection = asteroidAngle + Math.PI; // Opposite to the direction of movement

        for (let i = 0; i < particleCount; i++) {
            const distanceFromAsteroid = (i / particleCount) * trailLength * (Math.random() * 0.5 + 0.5);
            const particleAngle = trailDirection + (Math.random() - 0.5) * 0.5; // Add some spread
            
            const x = Math.cos(particleAngle) * distanceFromAsteroid;
            const y = Math.sin(particleAngle) * distanceFromAsteroid;

            const size = (1 - i / particleCount) * 2; // Particles get smaller as they are farther away
            const alpha = (1 - i / particleCount) * 0.5; // Particles fade out

            this.drawParticle(ctx, x, y, size, alpha);
        }
    }

    private drawParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
        ctx.fill();
    }
} 