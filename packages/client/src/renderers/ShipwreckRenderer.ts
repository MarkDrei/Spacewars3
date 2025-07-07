import { CollectibleRenderer } from './CollectibleRenderer';
import { Collectible } from '../Collectible';
import { Shipwreck, SalvageType } from '../Shipwreck';

/**
 * Renderer for Shipwreck collectibles
 */
export class ShipwreckRenderer extends CollectibleRenderer {
    // Store animation timestamp for effects
    private animationTimestamp: number = Date.now();
    
    /**
     * Draw the shipwreck shape
     */
    protected drawCollectibleShape(ctx: CanvasRenderingContext2D, collectible: Collectible): void {
        if (!(collectible instanceof Shipwreck)) return;
        
        const shipwreck = collectible as Shipwreck;
        const size = 18; // Slightly larger size for more detail
        
        // Update animation timestamp
        this.animationTimestamp = Date.now();
        
        // Draw base debris field for all wreck types
        this.drawDebrisField(ctx, size);
        
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
        
        // Add subtle glow effect for all wrecks
        this.drawGlowEffect(ctx, size, shipwreck.getSalvageType());
    }
    
    /**
     * Draw small debris scattered around the main wreck
     */
    private drawDebrisField(ctx: CanvasRenderingContext2D, size: number): void {
        ctx.save();
        
        // Draw small debris pieces
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI * 2 * (i / 6);
            const distance = size * 1.2 + (Math.random() * size * 0.5);
            const debrisSize = size * 0.15 + (Math.random() * size * 0.1);
            
            ctx.save();
            ctx.translate(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance
            );
            ctx.rotate(Math.random() * Math.PI * 2);
            
            // Draw debris piece
            ctx.beginPath();
            if (Math.random() > 0.5) {
                // Square debris
                ctx.rect(-debrisSize/2, -debrisSize/2, debrisSize, debrisSize);
            } else {
                // Triangular debris
                ctx.moveTo(0, -debrisSize/2);
                ctx.lineTo(debrisSize/2, debrisSize/2);
                ctx.lineTo(-debrisSize/2, debrisSize/2);
                ctx.closePath();
            }
            
            // Use slightly different colors for debris
            const brightness = 30 + Math.floor(Math.random() * 20);
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            ctx.fill();
            
            ctx.restore();
        }
        
        ctx.restore();
    }
    
    /**
     * Draw a subtle glow effect based on salvage type
     */
    private drawGlowEffect(ctx: CanvasRenderingContext2D, size: number, salvageType: SalvageType): void {
        // Different glow colors based on salvage type
        let glowColor: string;
        switch (salvageType) {
            case SalvageType.FUEL:
                glowColor = 'rgba(255, 180, 0, 0.2)';
                break;
            case SalvageType.WEAPONS:
                glowColor = 'rgba(255, 0, 0, 0.15)';
                break;
            case SalvageType.TECH:
                glowColor = 'rgba(0, 255, 255, 0.2)';
                break;
            case SalvageType.GENERIC:
            default:
                glowColor = 'rgba(100, 100, 255, 0.1)';
                break;
        }
        
        // Create pulsing effect
        const pulseAmount = 0.7 + 0.3 * Math.sin(this.animationTimestamp / 500);
        const glowRadius = size * 1.8 * pulseAmount;
        
        // Draw glow using radial gradient
        const gradient = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, glowRadius);
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Draw a generic shipwreck
     */
    private drawGenericWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw twisted ship hull fragments
        ctx.beginPath();
        
        // Create irregular hull shape to look damaged
        ctx.moveTo(-size, -size/2);
        ctx.lineTo(size * 0.8, -size * 0.6);
        ctx.lineTo(size, -size * 0.3);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.5, size * 0.6);
        ctx.lineTo(-size * 0.8, size * 0.2);
        ctx.closePath();
        
        // Create metallic gradient
        const gradient = ctx.createLinearGradient(-size, -size, size, size);
        gradient.addColorStop(0, '#3a3a3a');
        gradient.addColorStop(0.5, '#555555');
        gradient.addColorStop(0.7, '#444444');
        gradient.addColorStop(1, '#333333');
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Add some hull details with line strokes
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        
        // Panel lines and rivet details
        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.4);
        ctx.lineTo(-size * 0.7, size * 0.4);
        ctx.moveTo(-size * 0.3, -size * 0.5);
        ctx.lineTo(-size * 0.3, size * 0.5);
        ctx.moveTo(size * 0.2, -size * 0.6);
        ctx.lineTo(size * 0.2, size * 0.5);
        ctx.moveTo(size * 0.6, -size * 0.4);
        ctx.lineTo(size * 0.6, size * 0.3);
        ctx.stroke();
        
        // Add some rivets
        ctx.fillStyle = '#999999';
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 2; j++) {
                const x = -size * 0.8 + i * size * 0.4;
                const y = -size * 0.4 + j * size * 0.8;
                
                ctx.beginPath();
                ctx.arc(x, y, size * 0.05, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Add damage effects - torn edges
        ctx.beginPath();
        ctx.moveTo(size * 0.8, -size * 0.6);
        ctx.lineTo(size * 0.9, -size * 0.7);
        ctx.lineTo(size, -size * 0.6);
        ctx.lineTo(size * 0.9, -size * 0.5);
        ctx.closePath();
        ctx.fillStyle = '#222222';
        ctx.fill();
        
        // Second damage section
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, size * 0.6);
        ctx.lineTo(-size * 0.6, size * 0.7);
        ctx.lineTo(-size * 0.7, size * 0.6);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.closePath();
        ctx.fillStyle = '#222222';
        ctx.fill();
    }
    
    /**
     * Draw a fuel tank shipwreck
     */
    private drawFuelTankWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Main tank body with metallic effect
        const tankGradient = ctx.createLinearGradient(0, -size/2, 0, size/2);
        tankGradient.addColorStop(0, '#aa9922');
        tankGradient.addColorStop(0.5, '#776611');
        tankGradient.addColorStop(1, '#554400');
        
        // Draw main tank - damaged/cracked
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size/2, 0, 0, Math.PI * 2);
        ctx.fillStyle = tankGradient;
        ctx.fill();
        
        // Draw crack in the tank
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, -size * 0.4);
        ctx.lineTo(size * 0.1, 0);
        ctx.lineTo(-size * 0.3, size * 0.3);
        ctx.strokeStyle = '#221100';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Hazard stripes with better definition
        ctx.save();
        // Clip to tank shape to keep stripes within bounds
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.9, size * 0.45, 0, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw multiple hazard stripes
        const stripeCount = 5;
        const stripeWidth = size * 2 / stripeCount;
        
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = '#ffcc00';
            } else {
                ctx.fillStyle = '#222200';
            }
            
            ctx.fillRect(
                -size - (i * stripeWidth), 
                -size * 0.1, 
                stripeWidth, 
                size * 0.2
            );
        }
        ctx.restore();
        
        // Add leaking fuel effect
        const leakGradient = ctx.createRadialGradient(
            size * 0.4, size * 0.2, 0,
            size * 0.4, size * 0.2, size * 0.8
        );
        leakGradient.addColorStop(0, 'rgba(255, 180, 0, 0.6)');
        leakGradient.addColorStop(0.3, 'rgba(200, 150, 0, 0.3)');
        leakGradient.addColorStop(1, 'rgba(150, 100, 0, 0)');
        
        ctx.beginPath();
        ctx.ellipse(size * 0.4, size * 0.2, size * 0.3, size * 0.8, Math.PI * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = leakGradient;
        ctx.fill();
        
        // Add fuel symbol
        ctx.beginPath();
        ctx.arc(0, 0, size/3, 0, Math.PI * 2);
        const symbolGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size/3);
        symbolGradient.addColorStop(0, '#ffee22');
        symbolGradient.addColorStop(1, '#cc9900');
        ctx.fillStyle = symbolGradient;
        ctx.fill();
        
        // Add "F" letter for fuel
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${size/2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F', 0, 0);
    }
    
    /**
     * Draw a weapons shipwreck
     */
    private drawWeaponsWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw a weapons cache/container - damaged
        const cacheGradient = ctx.createLinearGradient(-size, -size/2, size, size/2);
        cacheGradient.addColorStop(0, '#773333');
        cacheGradient.addColorStop(0.5, '#553333');
        cacheGradient.addColorStop(1, '#331111');
        
        // Draw main container
        ctx.beginPath();
        ctx.moveTo(-size, -size/2);
        ctx.lineTo(size, -size/2);
        ctx.lineTo(size * 1.1, -size * 0.3);
        ctx.lineTo(size, size/2);
        ctx.lineTo(-size, size/2);
        ctx.lineTo(-size * 1.1, size * 0.3);
        ctx.closePath();
        ctx.fillStyle = cacheGradient;
        ctx.fill();
        
        // Add metallic edge highlight
        ctx.beginPath();
        ctx.moveTo(-size, -size/2);
        ctx.lineTo(size, -size/2);
        ctx.lineTo(size * 1.1, -size * 0.3);
        ctx.lineTo(size, size/2);
        ctx.lineTo(-size, size/2);
        ctx.lineTo(-size * 1.1, size * 0.3);
        ctx.closePath();
        ctx.strokeStyle = '#aa5555';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Draw exposed ammunition/weapons with flickering effect
        const flicker = Math.random() * 0.4 + 0.6; // Random brightness for flicker effect
        
        // Draw ammunition crates
        for (let i = -2; i <= 2; i++) {
            const ammoGradient = ctx.createLinearGradient(
                i * size/3 - size/8, -size/3,
                i * size/3 + size/8, size/3
            );
            ammoGradient.addColorStop(0, `rgba(${Math.floor(204 * flicker)}, 0, 0, 1)`);
            ammoGradient.addColorStop(1, `rgba(${Math.floor(150 * flicker)}, 0, 0, 1)`);
            
            ctx.beginPath();
            ctx.rect(i * size/3 - size/8, -size/3, size/4, size/1.5);
            ctx.fillStyle = ammoGradient;
            ctx.fill();
            
            // Add metallic highlights to ammo
            ctx.beginPath();
            ctx.rect(i * size/3 - size/8, -size/3, size/4, size/1.5);
            ctx.strokeStyle = `rgba(255, ${Math.floor(100 * flicker)}, ${Math.floor(100 * flicker)}, 1)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
        
        // Add warning symbols
        ctx.save();
        
        // Create warning stripes pattern
        const stripeSize = size * 0.15;
        const stripeCount = Math.ceil(size * 2 / stripeSize);
        
        // Draw hazard stripes at the top
        ctx.translate(-size, -size * 0.45);
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = '#ff0000';
            } else {
                ctx.fillStyle = '#ffffff';
            }
            ctx.fillRect(i * stripeSize, 0, stripeSize, stripeSize);
        }
        
        // Draw hazard stripes at the bottom
        ctx.translate(0, size * 0.9);
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.fillStyle = '#ff0000';
            }
            ctx.fillRect(i * stripeSize, 0, stripeSize, stripeSize);
        }
        
        ctx.restore();
        
        // Add danger symbol
        ctx.save();
        ctx.translate(0, 0);
        
        // Draw warning triangle
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.3);
        ctx.lineTo(size * 0.3, size * 0.2);
        ctx.lineTo(-size * 0.3, size * 0.2);
        ctx.closePath();
        
        // Create flashing effect for warning symbol
        const flash = (this.animationTimestamp % 1000) < 500;
        ctx.fillStyle = flash ? '#ff0000' : '#990000';
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Add exclamation mark
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${size * 0.4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 0);
        
        ctx.restore();
    }
    
    /**
     * Draw a tech shipwreck
     */
    private drawTechWreck(ctx: CanvasRenderingContext2D, size: number): void {
        // Draw tech module with more advanced appearance
        ctx.save();
        
        // Create reflective surface
        const moduleGradient = ctx.createLinearGradient(-size, -size, size, size);
        moduleGradient.addColorStop(0, '#223344');
        moduleGradient.addColorStop(0.3, '#334455');
        moduleGradient.addColorStop(0.7, '#445566');
        moduleGradient.addColorStop(1, '#223344');
        
        // Draw main tech module shape with slight rotation for dynamic look
        ctx.rotate(Math.PI * 0.05);
        
        // Draw main tech module
        ctx.beginPath();
        ctx.rect(-size, -size, size*2, size*2);
        ctx.fillStyle = moduleGradient;
        ctx.fill();
        
        // Add metallic frame
        ctx.strokeStyle = '#6688aa';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw circuit patterns with glowing effect
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        
        // Animation timing for circuit pattern glow
        const cycleTime = this.animationTimestamp % 3000;
        const cyclePosition = cycleTime / 3000;
        
        // Draw horizontal circuit traces
        for (let i = -4; i <= 4; i++) {
            const normalizedPos = (i + 4) / 8; // 0 to 1
            const glowIntensity = Math.max(0, 1 - Math.abs(normalizedPos - cyclePosition) * 5);
            
            ctx.beginPath();
            ctx.moveTo(-size, i * size/4);
            ctx.lineTo(size, i * size/4);
            ctx.strokeStyle = `rgba(0, ${Math.floor(200 + 55 * glowIntensity)}, ${Math.floor(200 + 55 * glowIntensity)}, ${0.5 + 0.5 * glowIntensity})`;
            ctx.stroke();
        }
        
        // Draw vertical circuit traces
        for (let i = -4; i <= 4; i++) {
            const normalizedPos = (i + 4) / 8; // 0 to 1
            const glowIntensity = Math.max(0, 1 - Math.abs(normalizedPos - (1 - cyclePosition)) * 5);
            
            ctx.beginPath();
            ctx.moveTo(i * size/4, -size);
            ctx.lineTo(i * size/4, size);
            ctx.strokeStyle = `rgba(0, ${Math.floor(200 + 55 * glowIntensity)}, ${Math.floor(200 + 55 * glowIntensity)}, ${0.5 + 0.5 * glowIntensity})`;
            ctx.stroke();
        }
        
        // Add electronic components
        for (let i = -3; i <= 3; i += 2) {
            for (let j = -3; j <= 3; j += 2) {
                if (Math.random() > 0.5) {
                    // Draw small chip
                    ctx.fillStyle = '#111122';
                    ctx.fillRect(
                        i * size/8 - size/12, 
                        j * size/8 - size/12, 
                        size/6, 
                        size/6
                    );
                    
                    // Add pins
                    ctx.strokeStyle = '#aaccff';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    for (let pin = 0; pin < 3; pin++) {
                        // Left side pins
                        ctx.moveTo(i * size/8 - size/12, j * size/8 - size/20 + pin * size/20);
                        ctx.lineTo(i * size/8 - size/8, j * size/8 - size/20 + pin * size/20);
                        
                        // Right side pins
                        ctx.moveTo(i * size/8 + size/12, j * size/8 - size/20 + pin * size/20);
                        ctx.lineTo(i * size/8 + size/8, j * size/8 - size/20 + pin * size/20);
                    }
                    ctx.stroke();
                }
            }
        }
        
        // Add multiple blinking lights
        for (let i = -1; i <= 1; i++) {
            const blinkRate = (this.animationTimestamp + i * 300) % 1000 > 500;
            const pulseAmount = 0.7 + 0.3 * Math.sin((this.animationTimestamp + i * 500) / 300);
            
            // Main light
            ctx.beginPath();
            ctx.arc(i * size/2, i * size/4, size/6, 0, Math.PI * 2);
            ctx.fillStyle = blinkRate ? 
                `rgba(0, ${Math.floor(255 * pulseAmount)}, ${Math.floor(255 * pulseAmount)}, 0.8)` : 
                '#006666';
            ctx.fill();
            
            // Outer glow for the light
            if (blinkRate) {
                const lightGlow = ctx.createRadialGradient(
                    i * size/2, i * size/4, 0,
                    i * size/2, i * size/4, size/3
                );
                lightGlow.addColorStop(0, `rgba(0, 255, 255, ${0.7 * pulseAmount})`);
                lightGlow.addColorStop(0.5, `rgba(0, 200, 255, ${0.3 * pulseAmount})`);
                lightGlow.addColorStop(1, 'rgba(0, 100, 150, 0)');
                
                ctx.beginPath();
                ctx.arc(i * size/2, i * size/4, size/3, 0, Math.PI * 2);
                ctx.fillStyle = lightGlow;
                ctx.globalCompositeOperation = 'lighter';
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        
        // Add a central damaged area with exposed internal components
        ctx.beginPath();
        ctx.arc(0, 0, size/2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#111122';
        ctx.fill();
        
        // Draw exposed wires in the damaged area
        for (let i = 0; i < 8; i++) {
            const wireAngle = (i / 8) * Math.PI * 2;
            const wireLength = size/3 * (0.7 + Math.random() * 0.3);
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(
                Math.cos(wireAngle) * wireLength,
                Math.sin(wireAngle) * wireLength
            );
            
            // Random wire colors
            const wireColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff'];
            ctx.strokeStyle = wireColors[i % wireColors.length];
            ctx.lineWidth = 1 + Math.random();
            ctx.stroke();
        }
        
        ctx.restore();
    }
} 