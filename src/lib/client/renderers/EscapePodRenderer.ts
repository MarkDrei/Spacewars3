import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

/**
 * Renderer for EscapePod collectibles
 */
export class EscapePodRenderer extends SpaceObjectRendererBase {
    private escapePodImage: HTMLImageElement;

    constructor() {
        super();
        this.escapePodImage = new Image();
        this.escapePodImage.src = '/assets/images/escape_pod.png';
    }

    drawEscapePod(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number, escapePod: SpaceObject): void {
        // Use the base class method to handle common drawing functionality
        this.drawSpaceObject(ctx, centerX, centerY, shipX, shipY, escapePod);
    }

    /**
     * Get the escape pod image
     */
    protected getObjectImage(): HTMLImageElement | null {
        return this.escapePodImage;
    }
    
    /**
     * Get the size to render the escape pod at
     */
    protected getObjectSize(): number {
        return 45;
    }
    
    /**
     * Get the color for the fallback shape
     */
    protected getFallbackColor(): string {
        return '#ff6b6b'; // Red/orange color for escape pod
    }

    /**
     * Draw engine flames after the escape pod
     */
    protected override drawPreEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        this.drawEngineFlames(ctx, spaceObject);
    }

    /**
     * Draw engine flames behind the escape pod
     */
    private drawEngineFlames(ctx: CanvasRenderingContext2D, escapePod: SpaceObject): void {
        if (escapePod.speed === 0) return;

        const time = Date.now();
        const flicker = Math.abs(Math.sin(time / 500)); // Flicker effect for the flame
        const flameLength = 20 + flicker * 10;
        const flameWidth = 10 + flicker * 4;
        const podLeftX = -40 / 2;

        ctx.beginPath();
        ctx.moveTo(podLeftX + 5, -flameWidth / 2);
        ctx.lineTo(podLeftX + 5, flameWidth / 2);
        ctx.lineTo(podLeftX - flameLength, 0);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(podLeftX, 0, podLeftX - flameLength, 0);
        gradient.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
        gradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fill();
    }
}