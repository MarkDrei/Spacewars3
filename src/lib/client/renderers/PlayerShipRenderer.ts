import { Ship } from '../game/Ship';
import { SpaceObjectOld } from '../game/SpaceObject';

/**
 * Renderer specifically for the player's own ship (always rendered in the center)
 */
export class PlayerShipRenderer {
    private shipImages: Map<number, HTMLImageElement> = new Map();
    private currentShipPicture: number = 1;

    constructor() {
        // Preload common ship images (1-5)
        for (let i = 1; i <= 5; i++) {
            this.loadShipImage(i);
        }
    }

    /**
     * Load a ship image by number
     */
    private loadShipImage(shipNumber: number): void {
        if (!this.shipImages.has(shipNumber)) {
            const img = new Image();
            img.src = `/assets/images/ship${shipNumber}.png`;
            this.shipImages.set(shipNumber, img);
        }
    }

    /**
     * Set the ship picture to use for rendering
     */
    setShipPicture(shipNumber: number): void {
        this.currentShipPicture = shipNumber;
        this.loadShipImage(shipNumber);
    }

    /**
     * Get the current ship image
     */
    private getCurrentShipImage(): HTMLImageElement | null {
        const img = this.shipImages.get(this.currentShipPicture);
        return (img && img.complete) ? img : null;
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

        const shipImage = this.getCurrentShipImage();
        if (!shipImage) {
            // Fallback: draw a simple triangle if image not loaded
            this.drawFallbackShip(ctx, centerX, centerY, ship);
            return;
        }

        // Draw the ship
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngleRadians() + Math.PI / 2); // Convert degrees to radians, adjust for ship orientation

        const scale = 0.15;
        const width = shipImage.width * scale;
        const height = shipImage.height * scale;
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
