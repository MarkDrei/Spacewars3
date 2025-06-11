import { CollectibleRenderer } from './CollectibleRenderer';
import { Collectible } from '../Collectible';
import { Shipwreck, SalvageType } from '../Shipwreck';

/**
 * Renderer for Shipwreck collectibles
 */
export class ShipwreckRenderer extends CollectibleRenderer {
    /**
     * Draw the shipwreck shape
     */
    protected drawCollectibleShape(ctx: CanvasRenderingContext2D, collectible: Collectible): void {
        if (!(collectible instanceof Shipwreck)) return;
        
        const shipwreck = collectible as Shipwreck;
        const size = 15;
        
        // Draw different shapes based on salvage type
        switch (shipwreck.getSalvageType()) {
            case SalvageType.FUEL:
                this.drawFuelTankWreck(ctx, size);
                break;
                
            case SalvageType.WEAPONS:
                this.drawWeaponsWreck(ctx, size);
                break;
                
            case SalvageType.TECH:
                this.drawTechWreck(ctx, size);
                break;
                
            case SalvageType.GENERIC:
            default:
                this.drawGenericWreck(ctx, size);
                break;
        }
    }
    
    /**
     * Draw a generic shipwreck
     */
    private drawGenericWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw ship hull fragments
        ctx.beginPath();
        // Main hull piece
        ctx.moveTo(-size, -size/2);
        ctx.lineTo(size, -size/2);
        ctx.lineTo(size/2, size/2);
        ctx.lineTo(-size/2, size/2);
        ctx.closePath();
        
        // Fill with dark gray
        ctx.fillStyle = '#555555';
        ctx.fill();
        
        // Add some details with line strokes
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        
        // Interior details
        ctx.beginPath();
        ctx.moveTo(-size/2, -size/2);
        ctx.lineTo(-size/2, size/2);
        ctx.moveTo(0, -size/2);
        ctx.lineTo(0, size/2);
        ctx.moveTo(size/2, -size/2);
        ctx.lineTo(size/2, size/2);
        ctx.stroke();
    }
    
    /**
     * Draw a fuel tank shipwreck
     */
    private drawFuelTankWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw a fuel tank
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size/2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#776611';
        ctx.fill();
        
        // Add hazard stripes
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();
        
        // Add fuel symbol
        ctx.beginPath();
        ctx.arc(0, 0, size/3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
    }
    
    /**
     * Draw a weapons shipwreck
     */
    private drawWeaponsWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw a weapons cache
        ctx.beginPath();
        ctx.rect(-size, -size/2, size*2, size);
        ctx.fillStyle = '#553333';
        ctx.fill();
        
        // Draw ammunition
        ctx.fillStyle = '#cc0000';
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.rect(i * size/3, -size/3, size/4, size/1.5);
            ctx.fill();
        }
        
        // Add warning symbol
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-size/2, -size/3);
        ctx.lineTo(size/2, -size/3);
        ctx.moveTo(-size/2, size/3);
        ctx.lineTo(size/2, size/3);
        ctx.stroke();
    }
    
    /**
     * Draw a tech shipwreck
     */
    private drawTechWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw a tech module
        ctx.beginPath();
        ctx.rect(-size, -size, size*2, size*2);
        ctx.fillStyle = '#334455';
        ctx.fill();
        
        // Draw circuit patterns
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        
        // Horizontal lines
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-size, i * size/4);
            ctx.lineTo(size, i * size/4);
            ctx.stroke();
        }
        
        // Vertical lines
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(i * size/4, -size);
            ctx.lineTo(i * size/4, size);
            ctx.stroke();
        }
        
        // Add a blinking light
        const blinkRate = Date.now() % 1000 > 500;
        ctx.beginPath();
        ctx.arc(0, 0, size/4, 0, Math.PI * 2);
        ctx.fillStyle = blinkRate ? '#00ffff' : '#006666';
        ctx.fill();
    }
} 