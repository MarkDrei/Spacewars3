import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';
import { getShipNameColor } from '@shared/utils/levelUtils';
import { HOSTILE_ARCHETYPES } from '@/shared/quests/npcArchetypes';

/** Hostile red color used for NPC fallback shape */
const NPC_HOSTILE_COLOR = '#ff4444';

/** Colour of friendly contacts (fallback shape and name label) */
const NPC_FRIENDLY_COLOR = '#7fd6ff';

/** Ring around aggressive ships: entering it triggers an attack */
const AGGRO_RING_COLOR = 'rgba(255, 68, 68, 0.35)';

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
 * Renderer for NPC ships: hostile and aggressive ships (attackable) and friendly contacts.
 *
 * Loads images `npc1.png` … `npc4.png` based on the NPC's `picture_id`. The position on the
 * orbit is projected before rendering (see `projectNpcShip`).
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

    /** Draw an NPC ship at its (already projected) position. */
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
        return this.currentNpc?.npcDisposition === 'friendly' ? NPC_FRIENDLY_COLOR : NPC_HOSTILE_COLOR;
    }

    /** The aggro ring stays visible while the ship itself is outside the view. */
    protected override getVisibilityMargin(spaceObject: SpaceObject): number {
        return Math.max(100, aggroRadiusOf(spaceObject) + 10);
    }

    /** Aggressive ships show the range within which they attack. */
    protected override drawPreEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        const aggroRadius = aggroRadiusOf(spaceObject);
        if (aggroRadius <= 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, aggroRadius, 0, Math.PI * 2);
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = AGGRO_RING_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
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
     * Draw the NPC name label below the ship: friendly contacts in their own colour, all other
     * ships coloured by level difference like player ships.
     */
    protected override drawPostEffects(ctx: CanvasRenderingContext2D, spaceObject: SpaceObject): void {
        if (!spaceObject.username) return;

        ctx.save();

        // Counter-rotate so text is drawn horizontally
        ctx.rotate(-spaceObject.angle * (Math.PI / 180));

        const nameColor =
            spaceObject.npcDisposition === 'friendly'
                ? NPC_FRIENDLY_COLOR
                : getShipNameColor(this.playerLevel, spaceObject.level ?? 1);

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

/** Attack range of an aggressive NPC ship, 0 for all other ships. */
function aggroRadiusOf(npc: SpaceObject): number {
    if (npc.npcDisposition !== 'aggressive' || !npc.npcArchetype) return 0;
    return HOSTILE_ARCHETYPES[npc.npcArchetype].aggroRadius;
}
