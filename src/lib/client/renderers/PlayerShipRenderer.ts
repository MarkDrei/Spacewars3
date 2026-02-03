import { Ship } from '../game/Ship';
import { SpaceObjectOld } from '../game/SpaceObject';

/**
 * Renderer specifically for the player's own ship (always rendered in the center)
 */
export class PlayerShipRenderer {
    private shipImages: Map<number, HTMLImageElement> = new Map();
    private imageLoadedStatus: Map<number, boolean> = new Map();
    // Store the reference size of ship1.png for scaling other ships
    private ship1Size: { width: number; height: number } | null = null;

    constructor() {
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
    private getShipImage(pictureId: number): HTMLImageElement {
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
        
        // Return the (possibly not yet loaded) image
        return img || this.shipImages.get(1)!;
    }

    /**
     * Draw the player's ship at the center of the screen
     */
    drawPlayerShip(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        ship: Ship
    ): void {
        // Draw hover effect if ship is hovered
        if (ship.isHoveredState()) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, SpaceObjectOld.HOVER_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        const pictureId = ship.getPictureId();
        const shipImage = this.getShipImage(pictureId);
        const isLoaded = this.imageLoadedStatus.get(pictureId) || this.imageLoadedStatus.get(1);

        if (!isLoaded) {
            // Fallback: draw a simple triangle if image not loaded
            this.drawFallbackShip(ctx, centerX, centerY, ship);
            return;
        }

        // Draw the ship
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngleRadians() + Math.PI / 2); // Convert degrees to radians, adjust for ship orientation

        // Scale all ships to match ship1's rendered size (not natural size)
        const scale = 0.15;
        let width: number, height: number;
        
        if (this.ship1Size && pictureId !== 1) {
            // Scale other ships to match ship1's rendered dimensions
            const ship1RenderedWidth = this.ship1Size.width * scale;
            const ship1RenderedHeight = this.ship1Size.height * scale;
            
            // Calculate scale factor to match ship1's rendered size
            const scaleX = ship1RenderedWidth / shipImage.naturalWidth;
            const scaleY = ship1RenderedHeight / shipImage.naturalHeight;
            
            // Use the smaller scale to ensure the ship fits within ship1's dimensions
            const adjustedScale = Math.min(scaleX, scaleY);
            width = shipImage.naturalWidth * adjustedScale;
            height = shipImage.naturalHeight * adjustedScale;
        } else {
            // For ship1 or if ship1 size not yet loaded, use original scaling
            width = shipImage.naturalWidth * scale;
            height = shipImage.naturalHeight * scale;
        }
        
        ctx.drawImage(shipImage, -width / 2, -height / 2, width, height);

        ctx.restore();
    }
    
    /**
     * Fallback rendering when image is not loaded
     */
    private drawFallbackShip(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, ship: Ship): void {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngleRadians() + Math.PI / 2);
        
        // Draw a simple triangle representing the ship
        ctx.beginPath();
        ctx.moveTo(0, -10); // Front point
        ctx.lineTo(-6, 8);  // Back left
        ctx.lineTo(6, 8);   // Back right
        ctx.closePath();
        
        ctx.fillStyle = '#00ff00'; // Bright green for player ship
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
}
