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
        this.escapePodImage.src = 'resources/ai_gen/escape_pod.png';
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
        const speed = escapePod.speed;
        if (speed === 0) return;

        // Calculate escape pod dimensions based on image aspect ratio (same as rendered image)
        const baseSize = this.getObjectSize();
        const aspectRatio = this.getImageAspectRatio();
        
        let podWidth: number, podHeight: number;
        if (aspectRatio > 1) {
            // Image is wider than tall
            podWidth = baseSize;
            podHeight = baseSize / aspectRatio;
        } else {
            // Image is taller than wide (or square)
            podWidth = baseSize * aspectRatio;
            podHeight = baseSize;
        }

        const time = Date.now();
        const flicker = Math.abs(Math.sin(time * 0.001)); // Flicker effect for the flame
        
        // Scale flame dimensions based on pod size
        const flameLength = (podHeight * 0.6) + flicker * (podHeight * 0.3);
        const flameWidth = podWidth * 0.4 + flicker * (podWidth * 0.2);
        
        // Position flames at the "back" of the pod (behind movement direction)
        // Since the base class rotates by 90°, the back is in the negative X direction
        const podBackX = -podWidth / 2;

        // Draw main flame
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(podBackX, 0, podBackX - flameLength, 0);
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 255, 100, 0.0)');
        
        ctx.fillStyle = gradient;
        ctx.ellipse(podBackX - flameLength / 2, 0, flameLength / 2, flameWidth / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw inner flame core (proportionally smaller)
        ctx.beginPath();
        const coreGradient = ctx.createLinearGradient(podBackX, 0, podBackX - flameLength * 0.6, 0);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        coreGradient.addColorStop(1, 'rgba(255, 100, 0, 0.0)');
        
        ctx.fillStyle = coreGradient;
        ctx.ellipse(podBackX - flameLength * 0.3, 0, flameLength * 0.3, flameWidth * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}