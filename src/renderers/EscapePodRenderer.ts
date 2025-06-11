import { CollectibleRenderer } from './CollectibleRenderer';
import { Collectible } from '../Collectible';
import { EscapePod } from '../EscapePod';

/**
 * Renderer for EscapePod collectibles
 */
export class EscapePodRenderer extends CollectibleRenderer {
    /**
     * Draw the escape pod shape
     */
    protected drawCollectibleShape(ctx: CanvasRenderingContext2D, collectible: Collectible): void {
        if (!(collectible instanceof EscapePod)) return;
        
        const escapePod = collectible as EscapePod;
        const size = 12;
        
        // Draw the main pod body (rounded capsule shape)
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size/1.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#e0e0e0';
        ctx.fill();
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw escape pod window
        ctx.beginPath();
        ctx.arc(size/2, 0, size/4, 0, Math.PI * 2);
        ctx.fillStyle = '#88aaff';
        ctx.fill();
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw life support indicator
        ctx.beginPath();
        ctx.arc(-size/2, 0, size/5, 0, Math.PI * 2);
        ctx.fillStyle = '#00cc00';  // Green for active life support
        ctx.fill();
        
        // Draw thrusters
        ctx.beginPath();
        ctx.rect(-size - size/4, -size/4, size/4, size/2);
        ctx.fillStyle = '#888888';
        ctx.fill();
        
        // Draw thrust if pod is moving
        if (escapePod.getSpeed() > 0) {
            ctx.beginPath();
            ctx.moveTo(-size - size/4, -size/6);
            ctx.lineTo(-size - size/2, 0);
            ctx.lineTo(-size - size/4, size/6);
            ctx.fillStyle = '#ff6600';
            ctx.fill();
        }
        
        // Draw distress signal if active
        if (escapePod.isDistressSignalActive()) {
            this.drawDistressSignal(ctx, size);
        }
        
        // Indicate number of survivors
        this.drawSurvivorIndicator(ctx, size, escapePod.getSurvivors());
    }
    
    /**
     * Draw the distress signal emanating from the pod
     */
    private drawDistressSignal(ctx: CanvasRenderingContext2D, size: number): void {
        // Pulsing effect based on time
        const time = Date.now() % 2000 / 2000;
        const signalSize = size * (1 + time);
        const alpha = 0.7 - time * 0.7;  // Fade out as it expands
        
        // Draw circular pulse
        ctx.beginPath();
        ctx.arc(0, 0, signalSize, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw emergency beacon on top
        ctx.beginPath();
        ctx.arc(0, -size/1.2, size/6, 0, Math.PI * 2);
        const beaconBlink = Date.now() % 500 > 250;
        ctx.fillStyle = beaconBlink ? '#ff0000' : '#880000';
        ctx.fill();
    }
    
    /**
     * Draw indicator showing number of survivors
     */
    private drawSurvivorIndicator(ctx: CanvasRenderingContext2D, size: number, survivors: number): void {
        // Maximum survivors to display
        const maxDisplay = 3;
        const displayCount = Math.min(survivors, maxDisplay);
        
        // Draw survivor icons
        for (let i = 0; i < displayCount; i++) {
            const xPos = -size/2 + i * (size/2);
            
            // Draw person shape
            ctx.beginPath();
            // Head
            ctx.arc(xPos, -size/1.8, size/8, 0, Math.PI * 2);
            // Body
            ctx.moveTo(xPos, -size/1.8 + size/8);
            ctx.lineTo(xPos, -size/1.8 + size/4);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // If there are more survivors than we can display, add a "+X" indicator
        if (survivors > maxDisplay) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `${size/4}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`+${survivors - maxDisplay}`, size/2, -size/1.8);
        }
    }
} 