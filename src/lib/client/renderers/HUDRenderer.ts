import { Ship } from '../game/Ship';

export class HUDRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.canvas = canvas;
    }

    drawHUD(ship: Ship): void {
        const padding = 15;
        const panelWidth = 180;
        const panelHeight = 110;
        
        // Draw ship info panel at top-left (outside clipped area)
        this.drawShipInfoPanel(ship, padding, padding, panelWidth, panelHeight);
    }
    private drawShipInfoPanel(ship: Ship, x: number, y: number, width: number, height: number): void {
        // Draw semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x, y, width, height);
        
        // Draw border
        this.ctx.strokeStyle = '#4caf50';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw title
        this.ctx.fillStyle = '#4caf50';
        this.ctx.font = 'bold 13px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('SHIP STATUS', x + 10, y + 20);
        
        // Draw separator line
        this.ctx.strokeStyle = '#4caf50';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 26);
        this.ctx.lineTo(x + width - 10, y + 26);
        this.ctx.stroke();
        
        // Draw ship data
        const lineHeight = 16;
        let currentY = y + 42;
        
        this.ctx.font = '11px Arial';
        
        // Position
        this.ctx.fillStyle = '#999999';
        this.ctx.fillText('Position:', x + 10, currentY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`${Math.round(ship.getX())}, ${Math.round(ship.getY())}`, x + 75, currentY);
        currentY += lineHeight;
        
        // Speed
        this.ctx.fillStyle = '#999999';
        this.ctx.fillText('Speed:', x + 10, currentY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`${ship.getSpeed().toFixed(1)} u/s`, x + 75, currentY);
        currentY += lineHeight;
        
        // Heading
        this.ctx.fillStyle = '#999999';
        this.ctx.fillText('Heading:', x + 10, currentY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`${Math.round(ship.getAngleDegrees())}°`, x + 75, currentY);
    }
}
