import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

export class AsteroidRenderer extends SpaceObjectRendererBase {
    private asteroidImage: HTMLImageElement;

    constructor() {
        super();
        this.asteroidImage = new Image();
        this.asteroidImage.src = '/assets/images/asteroid1.png';
    }

    drawAsteroid(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number, asteroid: SpaceObject): void {
        // Use the base class method to handle common drawing functionality
        this.drawSpaceObject(ctx, centerX, centerY, shipX, shipY, asteroid);
    }

    /**
     * Get the asteroid image
     */
    protected getObjectImage(): HTMLImageElement | null {
        return this.asteroidImage;
    }
    
    /**
     * Get the size to render the asteroid at
     */
    protected getObjectSize(): number {
        return 50;
    }
    
    /**
     * Get the color for the fallback shape
     */
    protected getFallbackColor(): string {
        return 'rgba(180, 180, 180, 0.8)';
    }

    /**
     * Draw dust trail before the asteroid
     */
    protected override drawPreEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        this.drawDustTrail(ctx, spaceObject);
    }

    private drawDustTrail(ctx: CanvasRenderingContext2D, asteroid: SpaceObject): void {
        const speed = asteroid.speed;
        if (speed === 0) return;

        const trailLength = 150;
        const particleCount = 35;
        
        // In the rotated coordinate system, after the base rotation and the +90° image adjustment,
        // the asteroid front points in the +X direction (right)
        // So the dust trail should point in the -X direction (left)
        const trailDirection = Math.PI; // Point left in local coordinates (behind the asteroid)

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