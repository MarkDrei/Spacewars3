import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

/**
 * Renderer for Shipwreck collectibles
 */
export class ShipwreckRenderer extends SpaceObjectRendererBase {
    private shipwreckImage: HTMLImageElement;

    constructor() {
        super();
        this.shipwreckImage = new Image();
        this.shipwreckImage.src = '/assets/images/shipwreck2.png';
    }
    
    drawShipwreck(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, shipX: number, shipY: number, shipwreck: SpaceObject): void {
        // Use the base class method to handle common drawing functionality
        this.drawSpaceObject(ctx, centerX, centerY, shipX, shipY, shipwreck);
    }

    /**
     * Get the shipwreck image
     */
    protected getObjectImage(): HTMLImageElement | null {
        return this.shipwreckImage;
    }
    
    /**
     * Get the size to render the shipwreck at
     */
    protected getObjectSize(): number {
        return 55;
    }
    
    /**
     * Get the color for the fallback shape
     */
    protected getFallbackColor(): string {
        return '#8b4513'; // Brown color for shipwreck
    }
}
