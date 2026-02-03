import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

/**
 * Renderer for other player ships (not the current player's ship)
 * Uses the base SpaceObjectRenderer for positioning and wrapping
 */
export class OtherShipRenderer extends SpaceObjectRendererBase {
    private shipImages: Map<number, HTMLImageElement> = new Map();
    private imageLoadedStatus: Map<number, boolean> = new Map();
    // Store the reference size of ship1.png for scaling other ships
    private ship1Size: { width: number; height: number } | null = null;

    constructor() {
        super();
        // Pre-load ship1.png to get reference dimensions
        this.loadShipImage(1);
    }

    /**
     * Load a ship image with the given picture_id
     */
    private loadShipImage(pictureId: number): void {
        if (!this.shipImages.has(pictureId)) {
            const img = new Image();
            img.onload = () => {
                this.imageLoadedStatus.set(pictureId, true);
                // Store ship1 dimensions as reference
                if (pictureId === 1) {
                    this.ship1Size = { width: img.naturalWidth, height: img.naturalHeight };
                }
            };
            img.onerror = () => {
                // On error, fall back to ship1
                if (pictureId !== 1) {
                    console.warn(`Failed to load ship${pictureId}.png, using ship1.png as fallback`);
                    this.loadShipImage(1);
                }
            };
            img.src = `/assets/images/ship${pictureId}.png`;
            this.shipImages.set(pictureId, img);
            this.imageLoadedStatus.set(pictureId, false);
        }
    }

    /**
     * Get the ship image for the given picture_id, falling back to ship1 if not available
     */
    private getShipImageForPictureId(pictureId: number): HTMLImageElement | null {
        // Try to load the requested image if not already loaded
        this.loadShipImage(pictureId);
        
        const img = this.shipImages.get(pictureId);
        const isLoaded = this.imageLoadedStatus.get(pictureId);
        
        // If the image is loaded and valid, return it
        if (img && isLoaded) {
            return img;
        }
        
        // Fall back to ship1 if the requested image isn't loaded or failed
        if (pictureId !== 1) {
            this.loadShipImage(1);
            const fallbackImg = this.shipImages.get(1);
            if (fallbackImg && this.imageLoadedStatus.get(1)) {
                return fallbackImg;
            }
        }
        
        return null;
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
        // Store current ship being rendered so getObjectImage can access picture_id
        this.currentShip = ship;
        // Use the base class method to handle positioning and wrapping
        this.drawSpaceObject(ctx, centerX, centerY, viewportX, viewportY, ship);
        this.currentShip = null;
    }

    private currentShip: SpaceObject | null = null;

    /**
     * Get the ship image
     */
    protected getObjectImage(): HTMLImageElement | null {
        if (this.currentShip) {
            return this.getShipImageForPictureId(this.currentShip.picture_id);
        }
        return this.getShipImageForPictureId(1);
    }
    
    /**
     * Get the size to render the ship at
     */
    protected getObjectSize(): number {
        // Scale all ships to match ship1's rendered size
        if (this.ship1Size && this.currentShip && this.currentShip.picture_id !== 1) {
            const scale = 0.15; // Same scale used for ship1
            const ship1RenderedSize = Math.max(this.ship1Size.width, this.ship1Size.height) * scale;
            return ship1RenderedSize;
        }
        return 60; // Default size that matches ship1 at 0.15 scale
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
