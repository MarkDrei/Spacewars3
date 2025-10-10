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
        const panelHeight = 140;
        
        // Draw ship info panel at top-left (outside clipped area)
        this.drawShipInfoPanel(ship, padding, padding, panelWidth, panelHeight);
        
        // Draw heading compass at top-right
        this.drawHeadingCompass(ship, this.canvas.width - padding - 100, padding, 100);
        
        // Draw subtle scan lines for sci-fi effect
        this.drawScanLines();
    }
    
    private drawScanLines(): void {
        // Draw subtle horizontal scan lines across the entire canvas
        this.ctx.strokeStyle = 'rgba(0, 255, 170, 0.03)';
        this.ctx.lineWidth = 1;
        
        for (let y = 0; y < this.canvas.height; y += 4) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    private drawShipInfoPanel(ship: Ship, x: number, y: number, width: number, height: number): void {
        // Draw semi-transparent background
        const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, 'rgba(0, 30, 50, 0.85)');
        gradient.addColorStop(1, 'rgba(0, 15, 25, 0.85)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
        
        // Draw border with glow
        this.ctx.strokeStyle = '#00ddaa';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00ddaa';
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.shadowBlur = 0;
        
        // Draw title
        this.ctx.fillStyle = '#00ffaa';
        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('SHIP STATUS', x + 10, y + 22);
        
        // Draw separator line
        this.ctx.strokeStyle = '#00ddaa';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 30);
        this.ctx.lineTo(x + width - 10, y + 30);
        this.ctx.stroke();
        
        // Draw ship data
        const lineHeight = 18;
        let currentY = y + 50;
        
        this.ctx.fillStyle = '#88ccff';
        this.ctx.font = '12px monospace';
        
        // Position
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Position:', x + 10, currentY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`${Math.round(ship.getX())}, ${Math.round(ship.getY())}`, x + 90, currentY);
        currentY += lineHeight;
        
        // Speed with bar indicator
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Speed:', x + 10, currentY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`${ship.getSpeed().toFixed(1)} u/s`, x + 90, currentY);
        currentY += lineHeight;
        
        // Speed bar (assume max speed is around 10 for display purposes)
        const barWidth = width - 20;
        const barHeight = 6;
        const barX = x + 10;
        const barY = currentY - 10;
        const maxSpeedDisplay = 10;
        const speedPercent = Math.min(ship.getSpeed() / maxSpeedDisplay, 1);
        
        // Draw bar background
        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw bar fill with gradient
        if (speedPercent > 0) {
            const barGradient = this.ctx.createLinearGradient(barX, barY, barX + barWidth * speedPercent, barY);
            barGradient.addColorStop(0, '#00ff88');
            barGradient.addColorStop(1, '#00ccff');
            this.ctx.fillStyle = barGradient;
            this.ctx.fillRect(barX, barY, barWidth * speedPercent, barHeight);
            
            // Add glow effect
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = '#00ff88';
            this.ctx.fillRect(barX, barY, barWidth * speedPercent, barHeight);
            this.ctx.shadowBlur = 0;
        }
        
        // Draw bar border
        this.ctx.strokeStyle = '#00aa88';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        currentY += lineHeight - 5;
        
        // Heading
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Heading:', x + 10, currentY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`${Math.round(ship.getAngleDegrees())}°`, x + 90, currentY);
    }

    private drawHeadingCompass(ship: Ship, x: number, y: number, size: number): void {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const radius = size / 2 - 10;
        
        // Draw compass background
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(0, 30, 50, 0.85)');
        gradient.addColorStop(1, 'rgba(0, 15, 25, 0.85)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw compass border
        this.ctx.strokeStyle = '#00ddaa';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00ddaa';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Draw cardinal directions
        this.ctx.fillStyle = '#00ffaa';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // N, E, S, W markers
        const directions = [
            { label: 'N', angle: -Math.PI / 2 },
            { label: 'E', angle: 0 },
            { label: 'S', angle: Math.PI / 2 },
            { label: 'W', angle: Math.PI }
        ];
        
        directions.forEach(({ label, angle }) => {
            const textRadius = radius - 15;
            const textX = centerX + textRadius * Math.cos(angle);
            const textY = centerY + textRadius * Math.sin(angle);
            this.ctx.fillText(label, textX, textY);
        });
        
        // Draw heading needle
        const angleRad = (ship.getAngleDegrees() - 90) * Math.PI / 180;
        const needleLength = radius - 20;
        
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = '#ff4444';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.lineTo(
            centerX + needleLength * Math.cos(angleRad),
            centerY + needleLength * Math.sin(angleRad)
        );
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Draw center dot
        this.ctx.fillStyle = '#ff4444';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw heading text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${Math.round(ship.getAngleDegrees())}°`, centerX, centerY + radius + 20);
    }
}
