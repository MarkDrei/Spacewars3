import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';
import { getShipNameColor } from '@shared/utils/levelUtils';

/** Hostile red color used for NPC fallback shape */
const NPC_HOSTILE_COLOR = '#ff4444';

/** Label font for NPC name display */
const LABEL_FONT = '12px Arial';

/** Semi-transparent background for label readability */
const LABEL_BG_COLOR = 'rgba(0, 0, 0, 0.6)';

/** Padding around label text */
const LABEL_PADDING = 4;

/** Approximate text height in pixels */
const LABEL_TEXT_HEIGHT = 14;

/** Vertical offset of the label below the ship centre */
const LABEL_Y_OFFSET = 35;

/**
 * Renderer for NPC ships ("Iron Horde Pirates").
 *
 * Loads images `npc1.png` … `npc4.png` based on the NPC's `picture_id`.
 * Performs client-side orbit interpolation between server polls so NPC
 * movement appears smooth.
 */
export class NPCShipRenderer extends SpaceObjectRendererBase {
    private npcImages: Map<number, HTMLImageElement> = new Map();
    private imageLoadedStatus: Map<number, boolean> = new Map();
    private currentNpc: SpaceObject | null = null;
    private playerLevel: number = 1;

    constructor() {
        super();
        // Pre-load npc1.png as default fallback
        this.loadNpcImage(1);
    }

    // ------- public API -------

    /**
     * Draw an NPC ship with client-side orbit interpolation.
     *
     * Before delegating to the base class renderer, we advance the NPC's
     * orbit angle by the time elapsed since the server last computed the
     * position and update x, y, and facing angle accordingly.
     */
    public drawNpcShip(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        viewportX: number,
        viewportY: number,
        npc: SpaceObject,
        playerLevel: number = 1,
    ): void {
        this.currentNpc = npc;
        this.playerLevel = playerLevel;

        // --- Client-side orbit interpolation ---
        this.interpolateOrbitPosition(npc);

        this.drawSpaceObject(ctx, centerX, centerY, viewportX, viewportY, npc);
        this.currentNpc = null;
    }

    // ------- SpaceObjectRendererBase overrides -------

    protected getObjectImage(): HTMLImageElement | null {
        if (this.currentNpc) {
            return this.getNpcImageForPictureId(this.currentNpc.picture_id);
        }
        return this.getNpcImageForPictureId(1);
    }

    protected getObjectSize(): number {
        return SpaceObjectRendererBase.SHIP_LENGTH;
    }

    protected getFallbackColor(): string {
        return NPC_HOSTILE_COLOR;
    }

    /**
     * Draw a hostile-coloured triangle when the image is not yet loaded.
     */
    protected override drawFallbackShape(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.moveTo(0, -10); // Front point
        ctx.lineTo(-6, 8);  // Back left
        ctx.lineTo(6, 8);   // Back right
        ctx.closePath();

        ctx.fillStyle = this.getFallbackColor();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /**
     * Draw the NPC name label below the ship with level-based coloring.
     */
    protected override drawPostEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        if (!spaceObject.username) return;

        ctx.save();

        // Counter-rotate so text is drawn horizontally
        ctx.rotate(-spaceObject.angle * (Math.PI / 180));

        // Determine name color based on level difference (same as player ships)
        const npcLevel = spaceObject.level ?? 1;
        const nameColor = getShipNameColor(this.playerLevel, npcLevel);

        ctx.font = LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textMetrics = ctx.measureText(spaceObject.username);
        const textWidth = textMetrics.width;

        // Draw semi-transparent background rectangle
        ctx.fillStyle = LABEL_BG_COLOR;
        ctx.fillRect(
            -textWidth / 2 - LABEL_PADDING,
            LABEL_Y_OFFSET - LABEL_PADDING,
            textWidth + LABEL_PADDING * 2,
            LABEL_TEXT_HEIGHT + LABEL_PADDING * 2,
        );

        // Draw the name text with level-based colour
        ctx.fillStyle = nameColor;
        ctx.fillText(spaceObject.username, 0, LABEL_Y_OFFSET);

        ctx.restore();
    }

    // ------- private helpers -------

    /**
     * Advance the NPC's orbit position based on elapsed time since the
     * server last computed the angle.
     *
     * The server sends `orbitAngleDeg` (the angle at `last_position_update_ms`)
     * and `angularVelocityDegPerSec` (already multiplied by the time multiplier).
     * We extrapolate forward to get smooth motion between polls.
     *
     * The server increases the angle over time (counter-clockwise in standard
     * math coordinates), so the client must also add.
     */
    private interpolateOrbitPosition(npc: SpaceObject): void {
        if (
            npc.orbitAngleDeg === undefined ||
            npc.angularVelocityDegPerSec === undefined ||
            !npc.last_position_update_ms
        ) {
            return; // no orbit data — render at server position
        }

        const elapsedSec = (Date.now() - npc.last_position_update_ms) / 1000;
        // Server adds deltaAngle to orbitAngleDeg, so client must also add
        const currentAngleDeg = npc.orbitAngleDeg + npc.angularVelocityDegPerSec * elapsedSec;

        // Derive the orbit centre & radius from the server's snapshot so we
        // don't hard-code the starbase position on the client.
        // At the server snapshot: x = cx + r * cos(θ_server), y = cy + r * sin(θ_server)
        // With θ_server = orbitAngleDeg, we can compute cx and cy if we know r,
        // but the simplest reliable approach is to use the known constants.
        // The orbit centre and radius are game constants that won't change.
        const ORBIT_CENTER_X = 4000;
        const ORBIT_CENTER_Y = 4000;
        const ORBIT_RADIUS = 750;

        const rad = (currentAngleDeg * Math.PI) / 180;
        npc.x = ORBIT_CENTER_X + ORBIT_RADIUS * Math.cos(rad);
        npc.y = ORBIT_CENTER_Y + ORBIT_RADIUS * Math.sin(rad);

        // Facing direction = tangent to the circle (counter-clockwise motion)
        npc.angle = currentAngleDeg + 90;
    }

    /**
     * Load an NPC ship image by picture ID (1-4).
     */
    private loadNpcImage(pictureId: number): void {
        if (this.npcImages.has(pictureId)) return;

        const img = new Image();
        img.onload = () => {
            this.imageLoadedStatus.set(pictureId, true);
        };
        img.onerror = () => {
            if (pictureId !== 1) {
                console.warn(`Failed to load npc${pictureId}.png, using npc1.png as fallback`);
                this.loadNpcImage(1);
            }
        };
        img.src = `/assets/images/npc${pictureId}.png`;
        this.npcImages.set(pictureId, img);
        this.imageLoadedStatus.set(pictureId, false);
    }

    /**
     * Get the loaded image for the given picture ID, falling back to npc1 if
     * the requested image is not yet ready.
     */
    private getNpcImageForPictureId(pictureId: number): HTMLImageElement | null {
        this.loadNpcImage(pictureId);

        const img = this.npcImages.get(pictureId);
        if (img && this.imageLoadedStatus.get(pictureId)) {
            return img;
        }

        // Fallback to npc1
        if (pictureId !== 1) {
            this.loadNpcImage(1);
            const fallback = this.npcImages.get(1);
            if (fallback && this.imageLoadedStatus.get(1)) {
                return fallback;
            }
        }

        return null;
    }
}
