import { Ship } from '../game/Ship';
import { SpaceObjectOld } from '../game/SpaceObject';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

/**
 * Renderer specifically for the player's own ship (always rendered in the center)
 */
export class PlayerShipRenderer {
    private shipImages: Map<number, HTMLImageElement> = new Map();
    private imageLoadedStatus: Map<number, boolean> = new Map();

    /** Timestamp (ms) when the afterburner was last activated, or null if not active. */
    private afterburnerActivatedAt: number | null = null;
    private afterburnerIsActive: boolean = false;

    constructor() {
        // Pre-load ship1.png
        this.loadShipImage(1);
    }

    /**
     * Update afterburner state for animation purposes.
     * Called every frame (or whenever the state changes) from GameRenderer.
     */
    setAfterburnerActive(isActive: boolean): void {
        if (isActive && !this.afterburnerIsActive) {
            // Just activated — record the timestamp for the launch burst
            this.afterburnerActivatedAt = Date.now();
        } else if (!isActive) {
            this.afterburnerActivatedAt = null;
        }
        this.afterburnerIsActive = isActive;
    }

    /**
     * Load a ship image with the given picture_id
     */
    private loadShipImage(pictureId: number): void {
        if (!this.shipImages.has(pictureId)) {
            const img = new Image();
            img.onload = () => {
                this.imageLoadedStatus.set(pictureId, true);
            };
            img.onerror = () => {
                // On error, fall back to ship1
                if (pictureId !== 1) {
                    console.warn(`Failed to load ship${pictureId}.png, using ship1.png as fallback`);
                    this.loadShipImage(1);
                }
            };
            img.src = `/assets/images/ship${pictureId}.png`;
            this.shipImages.set(pictureId, img);
            this.imageLoadedStatus.set(pictureId, false);
        }
    }

    /**
     * Get the ship image for the given picture_id, falling back to ship1 if not available
     */
    private getShipImage(pictureId: number): HTMLImageElement {
        // Try to load the requested image if not already loaded
        this.loadShipImage(pictureId);
        
        const img = this.shipImages.get(pictureId);
        const isLoaded = this.imageLoadedStatus.get(pictureId);
        
        // If the image is loaded and valid, return it
        if (img && isLoaded) {
            return img;
        }
        
        // Fall back to ship1 if the requested image isn't loaded or failed
        if (pictureId !== 1) {
            this.loadShipImage(1);
            const fallbackImg = this.shipImages.get(1);
            if (fallbackImg && this.imageLoadedStatus.get(1)) {
                return fallbackImg;
            }
        }
        
        // Return the (possibly not yet loaded) image
        return img || this.shipImages.get(1)!;
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

        const pictureId = ship.getPictureId();
        const shipImage = this.getShipImage(pictureId);
        const isLoaded = this.imageLoadedStatus.get(pictureId) || this.imageLoadedStatus.get(1);

        if (!isLoaded) {
            // Fallback: draw a simple triangle if image not loaded
            this.drawFallbackShip(ctx, centerX, centerY, ship);
            return;
        }

        // Draw the ship
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ship.getAngleRadians() + Math.PI / 2); // Convert degrees to radians, adjust for ship orientation

        // Scale ship to constant height (Y-axis)
        const aspectRatio = shipImage.naturalWidth / shipImage.naturalHeight;
        const height = SpaceObjectRendererBase.SHIP_LENGTH;
        const width = height * aspectRatio;

        // Draw afterburner exhaust *behind* the ship image (pre-effect)
        if (this.afterburnerIsActive) {
            this.drawAfterburnerPlumes(ctx, width, height, this.getAfterburnerLengthMultiplier());
        }
        
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

        if (this.afterburnerIsActive) {
            this.drawAfterburnerPlumes(ctx, 12, 20, this.getAfterburnerLengthMultiplier());
        }
        
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

    /**
     * Returns the current length multiplier for the afterburner plumes.
     * On activation the tail is 4× normal and collapses linearly to 1× over 1 second.
     */
    private getAfterburnerLengthMultiplier(): number {
        const BURST_DURATION = 1000; // ms
        if (this.afterburnerActivatedAt === null) return 1;
        const elapsed = Date.now() - this.afterburnerActivatedAt;
        if (elapsed >= BURST_DURATION) return 1;
        // Linear collapse: 4 → 1 over the burst duration
        return 4 - 3 * (elapsed / BURST_DURATION);
    }

    /**
     * Draw multi-plume afterburner exhaust flames behind the ship.
     * ctx is already translated to ship center and rotated to ship heading.
     * In this coordinate system +Y is toward the back of the ship.
     * lengthMultiplier scales the plume length (>1 during the activation burst).
     */
    private drawAfterburnerPlumes(ctx: CanvasRenderingContext2D, shipWidth: number, shipHeight: number, lengthMultiplier: number = 1): void {
        const time = Date.now();
        const t = time / 1000;

        // Flicker seeds — each plume uses a slightly different phase
        const flicker0 = 0.65 + 0.35 * Math.abs(Math.sin(t * 11.3));
        const flicker1 = 0.65 + 0.35 * Math.abs(Math.sin(t * 13.7 + 1.1));
        const flicker2 = 0.65 + 0.35 * Math.abs(Math.sin(t * 9.8 + 2.4));

        const backY = shipHeight / 2; // Y-coordinate of the ship's stern in local space

        // --- Central mega-plume: white-hot core → yellow → orange → red ---
        this.drawPlume(ctx, 0, backY, 0, 90 * flicker0 * lengthMultiplier, 22 * flicker0, [
            { stop: 0,    color: 'rgba(255, 255, 255, 1.0)' },
            { stop: 0.15, color: 'rgba(255, 255, 180, 0.95)' },
            { stop: 0.4,  color: 'rgba(255, 160, 20, 0.9)' },
            { stop: 0.7,  color: 'rgba(220, 60, 10, 0.7)' },
            { stop: 0.9,  color: 'rgba(150, 20, 0, 0.3)' },
            { stop: 1,    color: 'rgba(80, 0, 0, 0)' },
        ]);

        // --- Left side plume ---
        this.drawPlume(ctx, -shipWidth * 0.28, backY - 4, -8, 60 * flicker1 * lengthMultiplier, 11 * flicker1, [
            { stop: 0,    color: 'rgba(255, 240, 180, 0.9)' },
            { stop: 0.3,  color: 'rgba(255, 120, 20, 0.8)' },
            { stop: 0.7,  color: 'rgba(200, 50, 10, 0.5)' },
            { stop: 1,    color: 'rgba(100, 10, 0, 0)' },
        ]);

        // --- Right side plume ---
        this.drawPlume(ctx, shipWidth * 0.28, backY - 4, 8, 60 * flicker2 * lengthMultiplier, 11 * flicker2, [
            { stop: 0,    color: 'rgba(255, 240, 180, 0.9)' },
            { stop: 0.3,  color: 'rgba(255, 120, 20, 0.8)' },
            { stop: 0.7,  color: 'rgba(200, 50, 10, 0.5)' },
            { stop: 1,    color: 'rgba(100, 10, 0, 0)' },
        ]);

        // --- Outer fire sparks ---
        this.drawAfterburnerSparks(ctx, backY, shipWidth, time);

        // Glow ring at the exhaust nozzle — warm yellow/orange
        const glowPulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 8.5));
        ctx.save();
        const nozzleGradient = ctx.createRadialGradient(0, backY, 0, 0, backY, 18 * glowPulse);
        nozzleGradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
        nozzleGradient.addColorStop(0.4, 'rgba(255, 140, 30, 0.6)');
        nozzleGradient.addColorStop(1, 'rgba(200, 50, 0, 0)');
        ctx.beginPath();
        ctx.arc(0, backY, 18 * glowPulse, 0, Math.PI * 2);
        ctx.fillStyle = nozzleGradient;
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw a single tapered exhaust plume.
     * originX/Y: nozzle position in local coords.
     * splayDeg: how many degrees off-axis the plume fans out.
     * length: plume length in world units.
     * width: plume width at the base.
     */
    private drawPlume(
        ctx: CanvasRenderingContext2D,
        originX: number,
        originY: number,
        splayDeg: number,
        length: number,
        width: number,
        colorStops: { stop: number; color: string }[],
    ): void {
        const splayRad = splayDeg * Math.PI / 180;

        ctx.save();
        ctx.translate(originX, originY);
        ctx.rotate(splayRad);

        const gradient = ctx.createLinearGradient(0, 0, 0, length);
        for (const cs of colorStops) {
            gradient.addColorStop(cs.stop, cs.color);
        }

        ctx.beginPath();
        ctx.moveTo(-width / 2, 0);
        ctx.lineTo(width / 2, 0);
        ctx.lineTo(0, length);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw small bright streaks that simulate electric sparks / plasma arcs.
     */
    private drawAfterburnerSparks(
        ctx: CanvasRenderingContext2D,
        backY: number,
        shipWidth: number,
        time: number,
    ): void {
        const sparkCount = 5;
        for (let i = 0; i < sparkCount; i++) {
            // 120 ms cycle gives fast enough flicker; 137.5 is a near-golden-ratio step so
            // adjacent sparks don't visually align or repeat patterns.
            const seed = (time / 120 + i * 137.5) % (Math.PI * 2);
            const xOff = (Math.sin(seed * 3.1 + i) * shipWidth * 0.4);
            const len = 18 + 14 * Math.abs(Math.sin(seed * 1.7));
            const alpha = 0.4 + 0.5 * Math.abs(Math.cos(seed * 2.3));

            ctx.save();
            ctx.translate(xOff, backY);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, len);
            ctx.strokeStyle = `rgba(255, ${Math.floor(100 + 80 * alpha)}, 20, ${alpha.toFixed(2)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        }
    }

}

