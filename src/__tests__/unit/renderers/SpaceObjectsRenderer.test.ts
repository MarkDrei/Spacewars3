import { describe, expect, test, beforeEach, vi } from 'vitest';
import { SpaceObjectsRenderer } from '@/lib/client/renderers/SpaceObjectsRenderer';
import type { ViewportInfo } from '@/lib/client/renderers/GameRenderer';
import type { SpaceObject } from '@shared/types';

// Mock all individual renderers so we can verify dispatch without real canvas logic
vi.mock('@/lib/client/renderers/ShipwreckRenderer', () => ({
    ShipwreckRenderer: class { drawShipwreck = vi.fn(); }
}));
vi.mock('@/lib/client/renderers/EscapePodRenderer', () => ({
    EscapePodRenderer: class { drawEscapePod = vi.fn(); }
}));
vi.mock('@/lib/client/renderers/AsteroidRenderer', () => ({
    AsteroidRenderer: class { drawAsteroid = vi.fn(); }
}));
vi.mock('@/lib/client/renderers/OtherShipRenderer', () => ({
    OtherShipRenderer: class { drawOtherShip = vi.fn(); }
}));
vi.mock('@/lib/client/renderers/StarbaseRenderer', () => ({
    StarbaseRenderer: class { drawStarbase = vi.fn(); }
}));

// Helpers to access private fields
const getField = <T>(obj: unknown, field: string): T =>
    (obj as Record<string, T>)[field];

describe('SpaceObjectsRenderer', () => {
    let renderer: SpaceObjectsRenderer;
    let mockCtx: CanvasRenderingContext2D;
    let mockCanvas: HTMLCanvasElement;
    let mockShip: { getX: () => number; getY: () => number };

    const makeSpaceObject = (type: SpaceObject['type']): SpaceObject => ({
        id: 1,
        x: 100,
        y: 100,
        speed: 0,
        angle: 0,
        type,
        picture_id: 1,
        last_position_update_ms: 0,
    });

    // Viewport centred on ship (100, 100), showing 400wu in each direction
    const mockViewport: ViewportInfo = { centerX: 400, centerY: 300, halfW: 400, halfH: 300 };

    beforeEach(() => {
        mockCanvas = { width: 800, height: 600 } as HTMLCanvasElement;
        mockCtx = {} as CanvasRenderingContext2D;
        mockShip = { getX: () => 100, getY: () => 100 };
        renderer = new SpaceObjectsRenderer(mockCtx, mockCanvas);
    });

    describe('constructor', () => {
        test('instantiates StarbaseRenderer alongside other renderers', () => {
            const starbaseRenderer = getField<object>(renderer, 'starbaseRenderer');
            expect(starbaseRenderer).toBeDefined();
            expect(typeof (starbaseRenderer as Record<string, unknown>).drawStarbase).toBe('function');
        });
    });

    describe('renderObject dispatch', () => {
        // Access private renderObject via drawSpaceObjects with a single-item array
        // and a world large enough that no wrapping occurs

        const WORLD = 100_000;

        test('dispatches starbase objects to StarbaseRenderer.drawStarbase', () => {
            const starbase = makeSpaceObject('starbase');
            renderer.drawSpaceObjects(mockShip as never, [starbase], WORLD, WORLD, mockViewport);

            const starbaseRenderer = getField<{ drawStarbase: ReturnType<typeof vi.fn> }>(
                renderer, 'starbaseRenderer'
            );
            expect(starbaseRenderer.drawStarbase).toHaveBeenCalledOnce();
            expect(starbaseRenderer.drawStarbase).toHaveBeenCalledWith(
                mockCtx,
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                starbase
            );
        });

        test('dispatches shipwreck objects to ShipwreckRenderer', () => {
            const shipwreck = makeSpaceObject('shipwreck');
            renderer.drawSpaceObjects(mockShip as never, [shipwreck], WORLD, WORLD, mockViewport);

            const shipwreckRenderer = getField<{ drawShipwreck: ReturnType<typeof vi.fn> }>(
                renderer, 'shipwreckRenderer'
            );
            expect(shipwreckRenderer.drawShipwreck).toHaveBeenCalledOnce();
        });

        test('dispatches escape_pod objects to EscapePodRenderer', () => {
            const escapePod = makeSpaceObject('escape_pod');
            renderer.drawSpaceObjects(mockShip as never, [escapePod], WORLD, WORLD, mockViewport);

            const escapePodRenderer = getField<{ drawEscapePod: ReturnType<typeof vi.fn> }>(
                renderer, 'escapePodRenderer'
            );
            expect(escapePodRenderer.drawEscapePod).toHaveBeenCalledOnce();
        });

        test('dispatches asteroid objects to AsteroidRenderer', () => {
            const asteroid = makeSpaceObject('asteroid');
            renderer.drawSpaceObjects(mockShip as never, [asteroid], WORLD, WORLD, mockViewport);

            const asteroidRenderer = getField<{ drawAsteroid: ReturnType<typeof vi.fn> }>(
                renderer, 'asteroidRenderer'
            );
            expect(asteroidRenderer.drawAsteroid).toHaveBeenCalledOnce();
        });

        test('dispatches player_ship objects to OtherShipRenderer', () => {
            const playerShip = makeSpaceObject('player_ship');
            renderer.drawSpaceObjects(mockShip as never, [playerShip], WORLD, WORLD, mockViewport);

            const shipRenderer = getField<{ drawOtherShip: ReturnType<typeof vi.fn> }>(
                renderer, 'shipRenderer'
            );
            expect(shipRenderer.drawOtherShip).toHaveBeenCalledOnce();
        });

        test('does not call starbaseRenderer for non-starbase objects', () => {
            const asteroid = makeSpaceObject('asteroid');
            renderer.drawSpaceObjects(mockShip as never, [asteroid], WORLD, WORLD, mockViewport);

            const starbaseRenderer = getField<{ drawStarbase: ReturnType<typeof vi.fn> }>(
                renderer, 'starbaseRenderer'
            );
            expect(starbaseRenderer.drawStarbase).not.toHaveBeenCalled();
        });

        test('renders multiple objects of different types, dispatching each correctly', () => {
            const objects: SpaceObject[] = [
                makeSpaceObject('starbase'),
                makeSpaceObject('asteroid'),
                makeSpaceObject('shipwreck'),
            ];
            renderer.drawSpaceObjects(mockShip as never, objects, WORLD, WORLD, mockViewport);

            const starbaseRenderer = getField<{ drawStarbase: ReturnType<typeof vi.fn> }>(renderer, 'starbaseRenderer');
            const asteroidRenderer = getField<{ drawAsteroid: ReturnType<typeof vi.fn> }>(renderer, 'asteroidRenderer');
            const shipwreckRenderer = getField<{ drawShipwreck: ReturnType<typeof vi.fn> }>(renderer, 'shipwreckRenderer');

            expect(starbaseRenderer.drawStarbase).toHaveBeenCalledOnce();
            expect(asteroidRenderer.drawAsteroid).toHaveBeenCalledOnce();
            expect(shipwreckRenderer.drawShipwreck).toHaveBeenCalledOnce();
        });
    });
});
