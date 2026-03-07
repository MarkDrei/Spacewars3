import { SpaceObjectOld } from './SpaceObject';
import { StarbaseObject } from '@shared/types/gameTypes';

/**
 * Client-side representation of a Starbase.
 * Starbases are large stationary space stations that players can dock with.
 * They have a much larger hover radius than regular collectibles because of their size.
 */
export class Starbase extends SpaceObjectOld {
    /**
     * Hover radius in world units.
     * Matches the rendered size: StarbaseRenderer uses getObjectSize() = 5 * 50 = 250px,
     * so the visible radius is 125 world units.
     */
    public static readonly STARBASE_HOVER_RADIUS = 125;

    constructor(serverData: StarbaseObject) {
        super(serverData);
    }

    isPointInHoverRadius(pointX: number, pointY: number): boolean {
        const dx = pointX - this.getX();
        const dy = pointY - this.getY();
        return (dx * dx + dy * dy) <= (Starbase.STARBASE_HOVER_RADIUS * Starbase.STARBASE_HOVER_RADIUS);
    }

    getHoverRadius(): number {
        return Starbase.STARBASE_HOVER_RADIUS;
    }
}
