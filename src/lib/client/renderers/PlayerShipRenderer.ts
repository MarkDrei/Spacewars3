import { Ship } from '../game/Ship';
import { SpaceObjectOld } from '../game/SpaceObject';

/**
 * Renderer specifically for the player's own ship (always rendered in the center)
 */
export class PlayerShipRenderer {
    private shipImages: Map<number, HTMLImageElement> = new Map();
    private imagesLoaded: Set<number> = new Set();
    private currentShipPictureId: number = 1;

    constructor() {
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
     * Set the ship picture ID for the player
     */
    setShipPictureId(shipPictureId: number): void {
        this.currentShipPictureId = shipPictureId;
    }

    /**
     * Get the current ship image based on shipPictureId
     */
    private getCurrentShipImage(): HTMLImageElement | null {
        return this.shipImages.get(this.currentShipPictureId) || this.shipImages.get(1) || null;
    }

    /**
     * Check if the current ship image is loaded
     */
    private isCurrentShipImageLoaded(): boolean {
        return this.imagesLoaded.has(this.currentShipPictureId);
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

        if (!this.isCurrentShipImageLoaded()) {
            // Fallback: draw a simple triangle if image not loaded
            this.drawFallbackShip(ctx, centerX, centerY, ship);
            return;
        }

        const shipImage = this.getCurrentShipImage();
        if (!shipImage) {
            this.drawFallbackShip(ctx, centerX, centerY, ship);
            return;
        }

        // Draw the ship
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngleRadians() + Math.PI / 2); // Convert degrees to radians, adjust for ship orientation

        // Calculate scale based on ship image size
        // Ship1: 419x412, Ships 2-5: 1024x1024
        // We want all ships to render at the same size as ship1 at scale 0.15
        const targetWidth = 419 * 0.15;  // Target width based on ship1
        const targetHeight = 412 * 0.15; // Target height based on ship1
        
        const scaleX = targetWidth / shipImage.width;
        const scaleY = targetHeight / shipImage.height;
        
        const width = shipImage.width * scaleX;
        const height = shipImage.height * scaleY;
        
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
