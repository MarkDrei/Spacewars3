import { LOCATIONS, type LocationDefinition, type LocationKind } from '@/shared/quests/locations';
import { World } from '../game/World';
import type { ViewportInfo } from './GameRenderer';

/** Outline and label colour per kind of location. */
const KIND_COLORS: Record<LocationKind, string> = {
    station: '#8fb4ff',
    lair: '#ff7a6b',
    wreck_field: '#ffd54f',
    landmark: '#7fd6ff',
};

const LABEL_FONT = '600 14px Arial';
const LABEL_BG_COLOR = 'rgba(0, 0, 0, 0.6)';
const LABEL_PADDING = 4;
const LABEL_TEXT_HEIGHT = 16;

/** Distance of the station name below the station centre (station image is 250 units wide). */
const STATION_LABEL_OFFSET = 140;

/**
 * Marks the named places of the world (see `LOCATIONS`): the area of points of interest as a
 * dashed circle with the name, stations with their name. Drawn below the space objects in the
 * world-scaled context, so all sizes are world units.
 */
export class LocationMarkerRenderer {
    draw(
        ctx: CanvasRenderingContext2D,
        viewport: ViewportInfo,
        shipX: number,
        shipY: number,
        locationNames: Readonly<Record<string, string>>,
    ): void {
        for (const location of LOCATIONS) {
            // Nearest copy of the location in the wrapping world
            const dx = closestOffset(location.x - shipX, World.WIDTH);
            const dy = closestOffset(location.y - shipY, World.HEIGHT);
            const reach = location.radius + LABEL_TEXT_HEIGHT;
            if (Math.abs(dx) > viewport.halfW + reach || Math.abs(dy) > viewport.halfH + reach) continue;

            this.drawLocation(ctx, viewport.centerX + dx, viewport.centerY + dy, location, locationNames[location.id]);
        }
    }

    private drawLocation(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        location: LocationDefinition,
        name: string | undefined,
    ): void {
        const color = KIND_COLORS[location.kind];
        ctx.save();

        if (location.kind === 'station') {
            if (name) this.drawLabel(ctx, name, x, y + STATION_LABEL_OFFSET, color);
            ctx.restore();
            return;
        }

        ctx.beginPath();
        ctx.arc(x, y, location.radius, 0, Math.PI * 2);
        ctx.setLineDash([14, 10]);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Centre cross
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x, y + 8);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (name) this.drawLabel(ctx, name, x, y + 14, color);
        ctx.restore();
    }

    private drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const width = ctx.measureText(text).width;

        ctx.fillStyle = LABEL_BG_COLOR;
        ctx.fillRect(x - width / 2 - LABEL_PADDING, y - LABEL_PADDING, width + LABEL_PADDING * 2, LABEL_TEXT_HEIGHT + LABEL_PADDING * 2);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }
}

function closestOffset(delta: number, worldSize: number): number {
    if (delta > worldSize / 2) return delta - worldSize;
    if (delta < -worldSize / 2) return delta + worldSize;
    return delta;
}
