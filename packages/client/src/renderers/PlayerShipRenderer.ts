import { Ship } from '../Ship';
import { SpaceObject } from '../SpaceObject';

/**
 * Renderer specifically for the player's own ship (always rendered in the center)
 */
export class PlayerShipRenderer {
    private shipImage: HTMLImageElement;
    private imageLoaded: boolean = false;

    constructor() {
        this.shipImage = new Image();
        this.shipImage.onload = () => {
            this.imageLoaded = true;
        };
        this.shipImage.src = 'resources/ai_gen/ship1.png';
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
            ctx.arc(centerX, centerY, SpaceObject.HOVER_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (!this.imageLoaded) {
            // Fallback: draw a simple triangle if image not loaded
            this.drawFallbackShip(ctx, centerX, centerY, ship);
            return;
        }

        // Draw the ship
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngleRadians() + Math.PI / 2); // Convert degrees to radians, adjust for ship orientation

        const scale = 0.15;
        const width = this.shipImage.width * scale;
        const height = this.shipImage.height * scale;
        ctx.drawImage(this.shipImage, -width / 2, -height / 2, width, height);

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
