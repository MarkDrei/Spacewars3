import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';
import {
  NPC_ORBIT_RADIUS,
  NPC_STARBASE_CENTER_X,
  NPC_STARBASE_CENTER_Y,
} from './npcConstants';

/**
 * Renderer for NPC ships that orbit the starbase.
 * Performs client-side circular orbit interpolation for smooth movement.
 */
export class NPCShipRenderer extends SpaceObjectRendererBase {
    private npcImage: HTMLImageElement | null = null;
    private imageLoaded: boolean = false;
    private currentNpc: SpaceObject | null = null;

    constructor() {
        super();
        this.loadImage();
    }

    private loadImage(): void {
        if (typeof Image === 'undefined') return; // Skip in non-browser environments
        const img = new Image();
        img.onload = () => {
            this.imageLoaded = true;
        };
        img.src = '/assets/images/npc1.png';
        this.npcImage = img;
    }

    /**
     * Draw an NPC ship with client-side orbit interpolation
     */
    public drawNpcShip(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        viewportX: number,
        viewportY: number,
        npc: SpaceObject,
        playerLevel: number = 1
    ): void {
        // Apply client-side orbit interpolation before rendering
        const interpolated = this.interpolatePosition(npc);
        this.currentNpc = npc;
        this.currentPlayerLevel = playerLevel;
        this.drawSpaceObject(ctx, centerX, centerY, viewportX, viewportY, interpolated);
        this.currentNpc = null;
    }

    private currentPlayerLevel: number = 1;

    /**
     * Interpolate NPC position along circular orbit for smooth rendering
     */
    private interpolatePosition(npc: SpaceObject): SpaceObject {
        if (npc.orbitAngleDeg === undefined || npc.angularVelocityDegPerSec === undefined) {
            return npc;
        }

        const now = Date.now();
        const elapsedMs = now - npc.last_position_update_ms;
        const elapsedSec = elapsedMs / 1000;

        // Compute interpolated angle (clockwise = decreasing angle)
        const interpolatedAngle = npc.orbitAngleDeg - (npc.angularVelocityDegPerSec * elapsedSec);
        const normalizedAngle = ((interpolatedAngle % 360) + 360) % 360;

        // Calculate position from angle
        const angleRad = normalizedAngle * Math.PI / 180;
        const x = NPC_STARBASE_CENTER_X + NPC_ORBIT_RADIUS * Math.cos(angleRad);
        const y = NPC_STARBASE_CENTER_Y + NPC_ORBIT_RADIUS * Math.sin(angleRad);

        // Facing direction: tangent to circle (angle - 90 for clockwise)
        const facingAngle = normalizedAngle - 90;

        return {
            ...npc,
            x,
            y,
            angle: facingAngle,
        };
    }

    protected getObjectImage(): HTMLImageElement | null {
        if (this.npcImage && this.imageLoaded) {
            return this.npcImage;
        }
        return null;
    }

    protected getObjectSize(): number {
        return SpaceObjectRendererBase.SHIP_LENGTH;
    }

    protected getFallbackColor(): string {
        return '#ff6600'; // Orange color to distinguish NPCs
    }

    protected override drawFallbackShape(ctx: CanvasRenderingContext2D): void {
        // Draw a diamond shape for NPC ships
        ctx.beginPath();
        ctx.moveTo(0, -12); // Top point
        ctx.lineTo(-8, 0);  // Left
        ctx.lineTo(0, 12);  // Bottom
        ctx.lineTo(8, 0);   // Right
        ctx.closePath();

        ctx.fillStyle = this.getFallbackColor();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /**
     * Draw NPC level label below the ship
     */
    protected override drawPostEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        const npc = this.currentNpc ?? spaceObject;
        const label = npc.username ?? `NPC L${npc.level ?? '?'}`;

        ctx.save();

        // Reset rotation to draw text horizontally
        ctx.rotate(-spaceObject.angle * (Math.PI / 180));

        // Determine name color based on level difference
        const npcLevel = npc.level ?? 1;
        const nameColor = this.getNpcNameColor(this.currentPlayerLevel, npcLevel);

        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 14;
        const padding = 4;
        const yOffset = 35;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(
            -textWidth / 2 - padding,
            yOffset - padding,
            textWidth + padding * 2,
            textHeight + padding * 2
        );

        // Label text
        ctx.fillStyle = nameColor;
        ctx.fillText(label, 0, yOffset);

        ctx.restore();
    }

    private getNpcNameColor(playerLevel: number, npcLevel: number): string {
        const diff = npcLevel - playerLevel;
        if (diff >= 3) return '#ff0000'; // Red for much higher
        if (diff >= 1) return '#ff8800'; // Orange for higher
        if (diff === 0) return '#ffff00'; // Yellow for same level
        return '#00ff00'; // Green for lower
    }
}
