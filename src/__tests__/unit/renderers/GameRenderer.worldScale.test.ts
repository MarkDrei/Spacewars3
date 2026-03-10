import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GameRenderer } from '@/lib/client/renderers/GameRenderer';
import { BASE_VIEWPORT_WORLD_H } from '@shared/viewportConstants';

// ── Mock all renderers that use Image or canvas APIs ────────────────────────

vi.mock('@/lib/client/renderers/PlayerShipRenderer', () => ({
  PlayerShipRenderer: class {
    drawPlayerShip = vi.fn();
  }
}));

vi.mock('@/lib/client/renderers/RadarRenderer', () => ({
  RadarRenderer: class {
    drawRadar = vi.fn();
  }
}));

vi.mock('@/lib/client/renderers/TooltipRenderer', () => ({
  TooltipRenderer: class {
    drawTooltip = vi.fn();
  }
}));

vi.mock('@/lib/client/renderers/SpaceObjectsRenderer', () => ({
  SpaceObjectsRenderer: class {
    drawSpaceObjects = vi.fn();
  }
}));

vi.mock('@/lib/client/renderers/TargetingLineRenderer', () => ({
  TargetingLineRenderer: class {
    drawTargetingLine = vi.fn();
  }
}));

vi.mock('@/lib/client/renderers/InterceptionLineRenderer', () => ({
  InterceptionLineRenderer: class {
    drawInterceptionLines = vi.fn();
  }
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvas(physicalW: number, physicalH: number): HTMLCanvasElement {
  return { width: physicalW, height: physicalH } as HTMLCanvasElement;
}

function makeCtx(): CanvasRenderingContext2D {
  return {} as CanvasRenderingContext2D;
}

const stubWorld = {
  getShip: () => ({ getX: () => 0, getY: () => 0 }),
  getSpaceObjects: () => [],
  getWidth: () => 5000,
  getHeight: () => 5000,
} as never;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GameRenderer.getWorldScale', () => {

  beforeEach(() => {
    // In the node test environment window is undefined; the guard in
    // getWorldScale() falls back to DPR=1.
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true });
  });

  test('getWorldScale_squareReferenceCanvas_returnsOne', () => {
    // A BASE_VIEWPORT_WORLD_H x BASE_VIEWPORT_WORLD_H CSS canvas at zoom=1 => scale=1.0
    const canvas = makeCanvas(BASE_VIEWPORT_WORLD_H, BASE_VIEWPORT_WORLD_H);
    const renderer = new GameRenderer(makeCtx(), canvas, stubWorld);

    expect(renderer.getWorldScale()).toBeCloseTo(1.0, 5);
  });

  test('getWorldScale_largerCanvas_sameVisibleWorldArea', () => {
    // Doubling both dimensions doubles the scale but keeps visible world area constant
    const small = makeCanvas(BASE_VIEWPORT_WORLD_H, BASE_VIEWPORT_WORLD_H);
    const large = makeCanvas(BASE_VIEWPORT_WORLD_H * 2, BASE_VIEWPORT_WORLD_H * 2);

    const rendererSmall = new GameRenderer(makeCtx(), small, stubWorld);
    const rendererLarge = new GameRenderer(makeCtx(), large, stubWorld);

    const scaleSmall = rendererSmall.getWorldScale();
    const scaleLarge = rendererLarge.getWorldScale();

    const visibleAreaSmall =
      (BASE_VIEWPORT_WORLD_H / scaleSmall) * (BASE_VIEWPORT_WORLD_H / scaleSmall);
    const visibleAreaLarge =
      (BASE_VIEWPORT_WORLD_H * 2 / scaleLarge) * (BASE_VIEWPORT_WORLD_H * 2 / scaleLarge);

    expect(visibleAreaSmall).toBeCloseTo(visibleAreaLarge, 0);
  });

  test('getWorldScale_landscapeCanvas_visibleWorldAreaMatchesTarget', () => {
    // For any canvas shape, visible area must equal BASE_VIEWPORT_WORLD_H squared
    const cssW = 1920;
    const cssH = 1080;
    const canvas = makeCanvas(cssW, cssH); // DPR=1 in tests

    const renderer = new GameRenderer(makeCtx(), canvas, stubWorld);
    const scale = renderer.getWorldScale();

    const visibleArea = (cssW / scale) * (cssH / scale);
    const expectedArea = BASE_VIEWPORT_WORLD_H * BASE_VIEWPORT_WORLD_H;
    expect(visibleArea).toBeCloseTo(expectedArea, 0);
  });

  test('getWorldScale_landscapeCanvas_visibleWorldAspectMatchesCanvasAspect', () => {
    // Visible world aspect ratio must equal the CSS canvas aspect ratio (no distortion)
    const cssW = 1920;
    const cssH = 1080;
    const canvas = makeCanvas(cssW, cssH);

    const renderer = new GameRenderer(makeCtx(), canvas, stubWorld);
    const scale = renderer.getWorldScale();

    const visibleW = cssW / scale;
    const visibleH = cssH / scale;

    expect(visibleW / visibleH).toBeCloseTo(cssW / cssH, 5);
  });

  test('getWorldScale_smallAndLargeCanvasSameAspect_showSameWorld', () => {
    // 960x540 and 1920x1080 share the same 16:9 aspect ratio.
    // Both must display identical visible world dimensions.
    const small = makeCanvas(960, 540);
    const large = makeCanvas(1920, 1080);

    const rendererSmall = new GameRenderer(makeCtx(), small, stubWorld);
    const rendererLarge = new GameRenderer(makeCtx(), large, stubWorld);

    const scaleSmall = rendererSmall.getWorldScale();
    const scaleLarge = rendererLarge.getWorldScale();

    expect(960 / scaleSmall).toBeCloseTo(1920 / scaleLarge, 0);
    expect(540 / scaleSmall).toBeCloseTo(1080 / scaleLarge, 0);
  });

  test('getWorldScale_highDpiCanvas_sameVisibleWorldAsCssEquivalent', () => {
    // On a DPR=2 device the resize handler sets canvas.width = CSS_W * 2.
    // getWorldScale() divides by DPR=2 to recover CSS pixels, so it must produce
    // the same scale as a DPR=1 device with a canvas of the CSS pixel dimensions.
    const dpr = 2;
    const cssW = 960;
    const cssH = 540;

    // Simulate DPR=2: physical canvas is twice the CSS pixel size
    Object.defineProperty(globalThis, 'window', {
      value: { devicePixelRatio: dpr },
      writable: true
    });
    const physicalCanvas = makeCanvas(cssW * dpr, cssH * dpr); // 1920x1080
    const rendererHiDpi = new GameRenderer(makeCtx(), physicalCanvas, stubWorld);
    const scaleHiDpi = rendererHiDpi.getWorldScale();

    // DPR=1 reference: canvas size equals CSS size
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true });
    const cssCanvas = makeCanvas(cssW, cssH);                  // 960x540
    const rendererLoDpi = new GameRenderer(makeCtx(), cssCanvas, stubWorld);
    const scaleLoDpi = rendererLoDpi.getWorldScale();

    // Both should compute the same worldScale (based on CSS pixels 960x540)
    expect(scaleHiDpi).toBeCloseTo(scaleLoDpi, 5);
  });

  test('getWorldScale_zoom_scalesWorldScale', () => {
    // zoom=2 halves the worldScale (shows fewer world units => zoomed in)
    const canvas = makeCanvas(BASE_VIEWPORT_WORLD_H, BASE_VIEWPORT_WORLD_H);
    const renderer = new GameRenderer(makeCtx(), canvas, stubWorld);

    renderer.setZoom(2);
    // At a BASE x BASE canvas, zoom=1 gives scale=1.0; zoom=2 gives scale=0.5
    expect(renderer.getWorldScale()).toBeCloseTo(0.5, 5);
  });
});
