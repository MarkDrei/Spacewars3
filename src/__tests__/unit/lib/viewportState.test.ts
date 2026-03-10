import { describe, it, expect, beforeEach } from 'vitest';
import { viewportState, TARGET_WORLD_AREA } from '@/lib/client/game/viewportState';

// Helper to create a mock canvas with explicit dimensions
function makeCanvas(width: number, height: number): HTMLCanvasElement {
    return { width, height } as HTMLCanvasElement;
}

describe('viewportState', () => {
    // Reset to a known state before each test
    beforeEach(() => {
        viewportState.updateFromCanvas(makeCanvas(800, 800));
    });

    describe('TARGET_WORLD_AREA', () => {
        it('TARGET_WORLD_AREA_isDefined_isPositive', () => {
            expect(TARGET_WORLD_AREA).toBeGreaterThan(0);
        });
    });

    describe('updateFromCanvas', () => {
        it('updateFromCanvas_squareCanvas_scaleMatchesFormula', () => {
            viewportState.updateFromCanvas(makeCanvas(400, 400));
            const expected = Math.sqrt((400 * 400) / TARGET_WORLD_AREA);
            expect(viewportState.scale).toBeCloseTo(expected, 10);
        });

        it('updateFromCanvas_rectangularCanvas_scaleMatchesFormula', () => {
            viewportState.updateFromCanvas(makeCanvas(500, 1000));
            const expected = Math.sqrt((500 * 1000) / TARGET_WORLD_AREA);
            expect(viewportState.scale).toBeCloseTo(expected, 10);
        });

        it('updateFromCanvas_updatesCanvasDimensions', () => {
            viewportState.updateFromCanvas(makeCanvas(640, 480));
            expect(viewportState.canvasWidth).toBe(640);
            expect(viewportState.canvasHeight).toBe(480);
        });
    });

    describe('visibleWorldArea_stableAcrossCanvasSizes', () => {
        it('visibleWorldArea_squareCanvas_matchesTargetArea', () => {
            viewportState.updateFromCanvas(makeCanvas(800, 800));
            const area = viewportState.visibleWorldWidth * viewportState.visibleWorldHeight;
            expect(area).toBeCloseTo(TARGET_WORLD_AREA, 1);
        });

        it('visibleWorldArea_wideCanvas_matchesTargetArea', () => {
            viewportState.updateFromCanvas(makeCanvas(1920, 1080));
            const area = viewportState.visibleWorldWidth * viewportState.visibleWorldHeight;
            expect(area).toBeCloseTo(TARGET_WORLD_AREA, 1);
        });

        it('visibleWorldArea_tallCanvas_matchesTargetArea', () => {
            viewportState.updateFromCanvas(makeCanvas(500, 1000));
            const area = viewportState.visibleWorldWidth * viewportState.visibleWorldHeight;
            expect(area).toBeCloseTo(TARGET_WORLD_AREA, 1);
        });

        it('visibleWorldArea_samePixelCountDifferentShape_maintainsSameArea', () => {
            // 500×1000 and 1000×500 have the same pixel count → same scale and same world area
            viewportState.updateFromCanvas(makeCanvas(500, 1000));
            const area1 = viewportState.visibleWorldWidth * viewportState.visibleWorldHeight;

            viewportState.updateFromCanvas(makeCanvas(1000, 500));
            const area2 = viewportState.visibleWorldWidth * viewportState.visibleWorldHeight;

            expect(area1).toBeCloseTo(area2, 1);
        });

        it('visibleWorldAspectRatio_matchesCanvasAspectRatio', () => {
            viewportState.updateFromCanvas(makeCanvas(1600, 900));
            const canvasRatio = 1600 / 900;
            const worldRatio = viewportState.visibleWorldWidth / viewportState.visibleWorldHeight;
            expect(worldRatio).toBeCloseTo(canvasRatio, 5);
        });
    });

    describe('coordinate conversions', () => {
        it('worldToScreenOffset_zeroOffset_returnsZero', () => {
            expect(viewportState.worldToScreenOffset(0)).toBe(0);
        });

        it('screenToWorldOffset_zeroOffset_returnsZero', () => {
            expect(viewportState.screenToWorldOffset(0)).toBe(0);
        });

        it('worldToScreenOffset_roundTrip_recoversOriginalValue', () => {
            const worldDelta = 250;
            const screenDelta = viewportState.worldToScreenOffset(worldDelta);
            const recovered = viewportState.screenToWorldOffset(screenDelta);
            expect(recovered).toBeCloseTo(worldDelta, 10);
        });

        it('screenToWorldOffset_scalesWithViewport', () => {
            // Larger canvas → higher scale → same screen delta maps to smaller world delta
            viewportState.updateFromCanvas(makeCanvas(1600, 1600));
            const scaleLarge = viewportState.scale;

            viewportState.updateFromCanvas(makeCanvas(400, 400));
            const scaleSmall = viewportState.scale;

            expect(scaleLarge).toBeGreaterThan(scaleSmall);

            const screenDelta = 100;
            const worldDeltaLarge = screenDelta / scaleLarge;
            const worldDeltaSmall = screenDelta / scaleSmall;
            expect(worldDeltaLarge).toBeLessThan(worldDeltaSmall);
        });
    });
});
