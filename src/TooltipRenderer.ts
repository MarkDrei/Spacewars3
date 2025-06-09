import { Ship } from './Ship';
import { SpaceObject } from './SpaceObject';

export class TooltipRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }

    private calculateDistanceToShip(object: SpaceObject, ship: Ship): number {
        if (object === ship) return 0;
        
        const dx = object.getX() - ship.getX();
        const dy = object.getY() - ship.getY();
        return Math.sqrt(dx * dx + dy * dy);
    }

    drawTooltip(spaceObjects: SpaceObject[], ship: Ship): void {
        // Find the first hovered object
        const hoveredObject = spaceObjects.find(obj => obj.isHoveredState());
        
        if (!hoveredObject) return;
        
        // Calculate screen position for the tooltip
        let screenX: number;
        let screenY: number;
        
        if (hoveredObject === ship) {
            screenX = this.canvas.width / 2;
            screenY = this.canvas.height / 2;
        } else {
            screenX = this.canvas.width / 2 + hoveredObject.getX() - ship.getX();
            screenY = this.canvas.height / 2 + hoveredObject.getY() - ship.getY();
        }
        
        // Get object type
        const objectType = hoveredObject === ship ? "Ship" : "Asteroid";
        
        // Calculate distance to ship
        const distance = this.calculateDistanceToShip(hoveredObject, ship);
        
        // Format angle in degrees (0-360)
        const angleDegrees = Math.round((hoveredObject.getAngle() * 180 / Math.PI + 360) % 360);
        
        // Prepare tooltip text
        const tooltipText = [
            `Type: ${objectType}`,
            `Speed: ${hoveredObject.getSpeed()}`,
            `Angle: ${angleDegrees}°`,
            `Distance: ${Math.round(distance)}`
        ];
        
        // Draw tooltip background
        const padding = 5;
        const lineHeight = 20;
        const tooltipWidth = 150;
        const tooltipHeight = tooltipText.length * lineHeight + padding * 2;
        
        // Position tooltip to avoid going off-screen
        const tooltipX = Math.min(screenX + 30, this.canvas.width - tooltipWidth - 5);
        const tooltipY = Math.min(screenY - tooltipHeight - 10, this.canvas.height - tooltipHeight - 5);
        
        // Draw tooltip background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw tooltip text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        
        tooltipText.forEach((line, index) => {
            this.ctx.fillText(
                line, 
                tooltipX + padding, 
                tooltipY + padding + (index + 1) * lineHeight - 5
            );
        });
    }
} 