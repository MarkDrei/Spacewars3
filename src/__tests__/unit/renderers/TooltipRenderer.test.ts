import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TooltipRenderer } from '@/lib/client/renderers/TooltipRenderer';
import { World } from '@/lib/client/game/World';

const makeContext = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  shadowColor: '',
  shadowBlur: 0,
});

const makeShip = (x = 100, y = 100) => ({
  getX: () => x,
  getY: () => y,
});

const makeHoveredObject = (x = 50, y = 100, speed = 5.4321, angle = 45.67) => ({
  isHoveredState: () => true,
  getX: () => x,
  getY: () => y,
  getAngleDegrees: () => angle,
  getSpeed: () => speed,
  getType: () => 'asteroid',
  getLevel: () => undefined,
});

describe('TooltipRenderer', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    World.WIDTH = 5000;
    World.HEIGHT = 5000;
  });

  test('drawTooltip_keepsBoxSizeConstantAcrossZoomLevels', () => {
    const ctx = makeContext();
    const canvas = {
      width: 800,
      height: 400,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const renderer = new TooltipRenderer(canvas);
    const hoveredObject = makeHoveredObject();
    const ship = makeShip();

    renderer.drawTooltip([hoveredObject] as never, ship as never, 1);
    renderer.drawTooltip([hoveredObject] as never, ship as never, 2.5);

    expect(ctx.scale).toHaveBeenNthCalledWith(1, 2, 2);
    expect(ctx.scale).toHaveBeenNthCalledWith(2, 2, 2);

    const mainBoxCalls = vi
      .mocked(ctx.roundRect)
      .mock.calls.filter(([, , width, height]) => width === 160 && height === 90);

    expect(mainBoxCalls).toHaveLength(6);

    const accentLine = vi.mocked(ctx.fillRect).mock.calls.find(([, , width, height]) => width === 24 && height === 1.5);
    expect(accentLine).toBeDefined();
  });

  test('drawTooltip_usesToroidalIncarnationClosestToShip', () => {
    const ctx = makeContext();
    const canvas = {
      width: 800,
      height: 400,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const renderer = new TooltipRenderer(canvas);
    const hoveredObject = makeHoveredObject(4950, 100, 5, 45);
    const ship = makeShip(50, 100);

    renderer.drawTooltip([hoveredObject] as never, ship as never, 1);

    const firstMainRect = vi.mocked(ctx.roundRect).mock.calls[0];
    expect(firstMainRect?.[0]).toBe(116);
  });

  test('drawTooltip_formatsNumbersWithSharedFormatter', () => {
    const ctx = makeContext();
    const canvas = {
      width: 800,
      height: 400,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const renderer = new TooltipRenderer(canvas);
    const hoveredObject = makeHoveredObject(50, 100, 5.4321, 45.67);
    const ship = makeShip();

    renderer.drawTooltip([hoveredObject] as never, ship as never, 1);

    const lines = vi.mocked(ctx.fillText).mock.calls.map(call => call[0]);
    expect(lines).toContain('ASTEROID');
    expect(lines).toContain('Speed: 5.43');
    expect(lines).toContain('Angle: 45.7°');
    expect(lines).toContain('Distance: 50');
  });

  test('drawTooltip_labelsEnemyShipsAndShowsLevelWhenAvailable', () => {
    const ctx = makeContext();
    const canvas = {
      width: 800,
      height: 400,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    const renderer = new TooltipRenderer(canvas);
    const hoveredObject = {
      isHoveredState: () => true,
      getX: () => 140,
      getY: () => 100,
      getAngleDegrees: () => 90,
      getSpeed: () => 12.34,
      getType: () => 'player_ship',
      getLevel: () => 7,
    };
    const ship = makeShip();

    renderer.drawTooltip([hoveredObject] as never, ship as never, 1);

    const lines = vi.mocked(ctx.fillText).mock.calls.map(call => call[0]);
    expect(lines).toContain('ENEMY SHIP');
    expect(lines).toContain('Level: 7');
    expect(lines).toContain('Speed: 12.3');
    expect(lines).toContain('Distance: 40');
  });
});
