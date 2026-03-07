// Image asset: /assets/images/station1.png

import { SpaceObject } from '@shared/types';
import { SpaceObjectRendererBase } from './SpaceObjectRendererBase';

const BASE_OBJECT_SIZE = 50;

/**
 * Renderer for Starbases (space stations)
 * Uses the base SpaceObjectRenderer for positioning, wrapping, and hover detection
 */
export class StarbaseRenderer extends SpaceObjectRendererBase {
    private stationImage: HTMLImageElement;
    private imageLoaded: boolean = false;

    constructor() {
        super();
        this.stationImage = new Image();
        this.stationImage.onload = () => {
            this.imageLoaded = true;
        };
        this.stationImage.src = '/assets/images/station1.png';
    }

    /**
     * Draw a starbase at the correct position relative to the player
     */
    public drawStarbase(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        shipX: number,
        shipY: number,
        obj: SpaceObject
    ): void {
        this.drawSpaceObject(ctx, centerX, centerY, shipX, shipY, obj);
    }

    /**
     * Get the station image (lazy-loaded)
     */
    protected getObjectImage(): HTMLImageElement | null {
        if (this.imageLoaded) {
            return this.stationImage;
        }
        return null;
    }

    /**
     * Get the size to render the starbase at (5× the standard object size)
     */
    protected getObjectSize(): number {
        return 5 * BASE_OBJECT_SIZE;
    }

    /**
     * Get the color for the fallback shape
     */
    protected getFallbackColor(): string {
        return '#4488ff';
    }

    /**
     * No rotation offset needed for a station
     */
    protected override getImageRotationOffset(): number {
        return 0;
    }
}
