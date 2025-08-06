import { SpaceObject } from '../SpaceObject';
import { SpaceObjectRenderer } from './SpaceObjectRenderer';

/**
 * Renderer for other player ships (not the current player's ship)
 * Uses the base SpaceObjectRenderer for positioning and wrapping
 */
export class OtherShipRenderer extends SpaceObjectRenderer {
    private shipImage: HTMLImageElement;

    constructor() {
        super();
        this.shipImage = new Image();
        this.shipImage.src = 'resources/ai_gen/ship1.png';
    }
    
    /**
     * Draw an other player's ship at the correct position relative to the player
     */
    public drawOtherShip(
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        viewportX: number, 
        viewportY: number, 
        ship: SpaceObject
    ): void {
        // Use the base class method to handle positioning and wrapping
        this.drawSpaceObject(ctx, centerX, centerY, viewportX, viewportY, ship);
    }

    /**
     * Get the ship image
     */
    protected getObjectImage(): HTMLImageElement | null {
        return this.shipImage;
    }
    
    /**
     * Get the size to render the ship at
     */
    protected getObjectSize(): number {
        return 40; // Slightly smaller than the player ship for distinction
    }
    
    /**
     * Get the color for the fallback triangle
     */
    protected getFallbackColor(): string {
        return '#4caf50'; // Green color to distinguish other ships
    }
    
    /**
     * Override fallback shape to draw a triangle instead of circle
     */
    protected override drawFallbackShape(ctx: CanvasRenderingContext2D): void {
        // Draw a simple triangle representing the ship
        ctx.beginPath();
        ctx.moveTo(0, -10); // Front point
        ctx.lineTo(-6, 8);  // Back left
        ctx.lineTo(6, 8);   // Back right
        ctx.closePath();
        
        ctx.fillStyle = this.getFallbackColor();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
