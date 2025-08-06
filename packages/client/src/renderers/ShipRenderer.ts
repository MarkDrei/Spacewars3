import { Ship } from '../Ship';
import { SpaceObject } from '../SpaceObject';
import { World } from '../World';

export class ShipRenderer {
    private shipImage: HTMLImageElement;
    private imageLoaded: boolean = false;

    constructor() {
        this.shipImage = new Image();
        this.shipImage.onload = () => {
            this.imageLoaded = true;
        };
        this.shipImage.src = 'resources/ai_gen/ship1.png';
    }

    drawShip(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        ship: Ship
    ): void {
        // Draw the main ship
        this.drawShipAtPosition(ctx, centerX, centerY, ship);
        
        // Check if we need to draw wrapped copies of the ship
        this.drawWrappedShips(ctx, centerX, centerY, ship);
    }
    
    /**
     * Draw wrapped copies of the ship when they would be visible on screen
     */
    private drawWrappedShips(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        ship: Ship
    ): void {
        const shipX = ship.getX();
        const shipY = ship.getY();
        const worldWidth = World.WIDTH;
        const worldHeight = World.HEIGHT;
        
        // Calculate canvas dimensions
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Define offsets for the 8 possible wrapped positions (including diagonals)
        const wrapOffsets = [
            { x: -worldWidth, y: 0 },             // Left
            { x: worldWidth, y: 0 },              // Right
            { x: 0, y: -worldHeight },            // Top
            { x: 0, y: worldHeight },             // Bottom
            { x: -worldWidth, y: -worldHeight },  // Top-Left
            { x: worldWidth, y: -worldHeight },   // Top-Right
            { x: -worldWidth, y: worldHeight },   // Bottom-Left
            { x: worldWidth, y: worldHeight }     // Bottom-Right
        ];
        
        // Create a wrapper object with modified positions
        const createWrappedShip = (x: number, y: number) => {
            return {
                getX: () => x,
                getY: () => y,
                getAngle: () => ship.getAngleDegrees(), // Return degrees for tooltip
                getSpeed: () => ship.getSpeed(),
                isHoveredState: () => ship.isHoveredState()
            } as Ship;
        };
        
        // Helper function to check if a screen position is visible
        const isPositionVisible = (screenX: number, screenY: number): boolean => {
            const margin = 50; // Add margin for ship size
            return (
                screenX > -margin && 
                screenX < canvasWidth + margin && 
                screenY > -margin && 
                screenY < canvasHeight + margin
            );
        };
        
        // Check all possible wrapped positions
        wrapOffsets.forEach(offset => {
            // Calculate the wrapped ship position
            const wrappedX = shipX + offset.x;
            const wrappedY = shipY + offset.y;
            
            // Calculate where this would be on screen
            const wrappedScreenX = centerX + offset.x;
            const wrappedScreenY = centerY + offset.y;
            
            // Only draw if it would be visible on screen
            if (isPositionVisible(wrappedScreenX, wrappedScreenY)) {
                const wrappedShip = createWrappedShip(wrappedX, wrappedY);
                this.drawShipAtPosition(ctx, wrappedScreenX, wrappedScreenY, wrappedShip);
            }
        });
    }

    /**
     * Draw the ship at the specified position
     */
    private drawShipAtPosition(
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
            return; // Don't draw ship if image not loaded yet
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
} 