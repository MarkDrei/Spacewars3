import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

/**
 * Renderer for other player ships (not the current player's ship)
 * Uses the base SpaceObjectRenderer for positioning and wrapping
 */
export class OtherShipRenderer extends SpaceObjectRendererBase {
    private shipImages: Map<number, HTMLImageElement> = new Map();
    private imagesLoaded: Set<number> = new Set();

    constructor() {
        super();
        // Preload all ship images
        for (let i = 1; i <= 5; i++) {
            const img = new Image();
            img.onload = () => {
                this.imagesLoaded.add(i);
            };
            img.src = `/assets/images/ship${i}.png`;
            this.shipImages.set(i, img);
        }
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
     * Get the ship image based on shipPictureId
     */
    protected getObjectImage(spaceObject?: SpaceObject): HTMLImageElement | null {
        if (!spaceObject || spaceObject.type !== 'player_ship') {
            return this.shipImages.get(1) || null;
        }
        const shipPictureId = spaceObject.shipPictureId || 1;
        return this.shipImages.get(shipPictureId) || this.shipImages.get(1) || null;
    }
    
    /**
     * Check if the ship image is loaded
     */
    protected override isImageLoaded(spaceObject?: SpaceObject): boolean {
        if (!spaceObject || spaceObject.type !== 'player_ship') {
            return this.imagesLoaded.has(1);
        }
        const shipPictureId = spaceObject.shipPictureId || 1;
        return this.imagesLoaded.has(shipPictureId);
    }
    
    /**
     * Get the size to render the ship at
     */
    protected getObjectSize(): number {
        return 60; // Slightly smaller than the player ship for distinction
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
    
    /**
     * Draw player name below the ship
     */
    protected override drawPostEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        // Only draw username for player ships that have a username
        if (spaceObject.type === 'player_ship' && spaceObject.username) {
            // Save context for text rendering
            ctx.save();
            
            // Reset rotation to draw text horizontally (counter-rotate the ship's angle)
            ctx.rotate(-spaceObject.angle * (Math.PI / 180));
            
            // Set text properties
            ctx.font = '12px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            // Add a semi-transparent background for better readability
            const textMetrics = ctx.measureText(spaceObject.username);
            const textWidth = textMetrics.width;
            const textHeight = 14; // Approximate text height
            const padding = 4;
            const yOffset = 35; // Distance below the ship
            
            // Draw background rectangle
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(
                -textWidth / 2 - padding,
                yOffset - padding,
                textWidth + padding * 2,
                textHeight + padding * 2
            );
            
            // Draw the username text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(spaceObject.username, 0, yOffset);
            
            ctx.restore();
        }
    }
}
