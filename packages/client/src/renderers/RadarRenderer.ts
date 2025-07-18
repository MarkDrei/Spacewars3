import { Ship } from '../Ship';

export class RadarRenderer {
    drawRadar(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, ship: Ship): void {
        const maxRadius = Math.min(centerX, centerY);

        // Draw outer circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#8b0000';  // Dark red for rings
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw inner circle at 125 distance
        ctx.beginPath();
        ctx.arc(centerX, centerY, 125, 0, Math.PI * 2);
        ctx.strokeStyle = '#8b0000';  // Dark red for rings
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw crosshairs and coordinates
        this.drawCrosshairsAndCoordinates(ctx, centerX, centerY, maxRadius, ship);
    }

    private drawCrosshairsAndCoordinates(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, maxRadius: number, ship: Ship): void {
        const useScreenEdges = false; // Hardcoded boolean - true for screen edges, false for center crossing
        
        // Draw horizontal and vertical lines
        ctx.strokeStyle = '#8b0000';  // Dark red for lines
        ctx.lineWidth = 1;
        
        if (useScreenEdges) {
            // Draw lines at screen edges
            // Horizontal line at bottom of screen
            ctx.beginPath();
            ctx.moveTo(0, centerY * 2);
            ctx.lineTo(centerX * 2, centerY * 2);
            ctx.stroke();
            
            // Vertical line at left of screen
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, centerY * 2);
            ctx.stroke();
        } else {
            // Draw lines crossing the center
            // Draw horizontal line
            ctx.beginPath();
            ctx.moveTo(centerX - maxRadius, centerY);
            ctx.lineTo(centerX + maxRadius, centerY);
            ctx.stroke();
            
            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - maxRadius);
            ctx.lineTo(centerX, centerY + maxRadius);
            ctx.stroke();
        }

        // Draw coordinates
        const shipX = ship.getX();
        const shipY = ship.getY();
        const coordinateDistance = 400;
        const innerExclusionZone = 70;

        ctx.font = '12px Arial';
        ctx.fillStyle = '#ff0000';

        if (useScreenEdges) {
            // Draw X coordinates along bottom edge (above the line)
            ctx.textAlign = 'center';
            for (let x = Math.floor((shipX - coordinateDistance) / 100) * 100; x <= Math.ceil((shipX + coordinateDistance) / 100) * 100; x += 100) {
                const screenX = centerX + (x - shipX);
                if (screenX >= 0 && screenX <= centerX * 2) { // Keep on screen
                    ctx.fillText(x.toString(), screenX, centerY * 2 - 5);
                }
            }

            // Draw Y coordinates along left edge
            ctx.textAlign = 'left';
            for (let y = Math.floor((shipY - coordinateDistance) / 100) * 100; y <= Math.ceil((shipY + coordinateDistance) / 100) * 100; y += 100) {
                const distanceFromShip = Math.abs(y - shipY);
                if (distanceFromShip >= innerExclusionZone && distanceFromShip <= coordinateDistance) {
                    const screenY = centerY + (y - shipY);
                    if (screenY >= 15 && screenY <= centerY * 2) { // Keep on screen
                        ctx.fillText(y.toString(), 5, screenY);
                    }
                }
            }
        } else {
            // Draw X coordinates along horizontal axis (center crossing)
            ctx.textAlign = 'center';
            for (let x = Math.floor((shipX - coordinateDistance) / 100) * 100; x <= Math.ceil((shipX + coordinateDistance) / 100) * 100; x += 100) {
                const distanceFromShip = Math.abs(x - shipX);
                if (distanceFromShip >= innerExclusionZone && distanceFromShip <= coordinateDistance) {
                    ctx.fillText(x.toString(), centerX + (x - shipX), centerY + 15);
                }
            }

            // Draw Y coordinates along vertical axis (center crossing)
            ctx.textAlign = 'right';
            for (let y = Math.floor((shipY - coordinateDistance) / 100) * 100; y <= Math.ceil((shipY + coordinateDistance) / 100) * 100; y += 100) {
                const distanceFromShip = Math.abs(y - shipY);
                if (distanceFromShip >= innerExclusionZone && distanceFromShip <= coordinateDistance) {
                    ctx.fillText(y.toString(), centerX - 15, centerY + (y - shipY));
                }
            }
        }
    }
} 