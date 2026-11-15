import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TooltipRenderer } from '@/lib/client/renderers/TooltipRenderer';
import { World } from '@/lib/client/game/World';
import { defaultCanvasStrings } from '@/lib/client/game/canvasStrings';
import { HAIL_RANGE } from '@/shared/quests/npcArchetypes';

const EXPECTED_TOOLTIP_WIDTH = 160;
const EXPECTED_TOOLTIP_HEIGHT = 90;
const EXPECTED_ACCENT_WIDTH = 24;
const EXPECTED_ACCENT_HEIGHT = 1.5;

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
  // Narrow text: the box keeps its minimum width
  measureText: vi.fn(() => ({ width: 10 })),
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
  getServerData: () => ({}),
});

const makeNpcShip = (x: number, serverData: Record<string, unknown>, level?: number) => ({
  isHoveredState: () => true,
  getX: () => x,
  getY: () => 100,
  getAngleDegrees: () => 0,
  getSpeed: () => 3,
  getType: () => 'npc_ship',
  getLevel: () => level,
  getServerData: () => serverData,
});

const makeCanvas = (ctx: ReturnType<typeof makeContext>) =>
  ({ width: 800, height: 400, getContext: () => ctx }) as unknown as HTMLCanvasElement;

const drawnLines = (ctx: ReturnType<typeof makeContext>) => vi.mocked(ctx.fillText).mock.calls.map(call => call[0]);

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
      .mock.calls.filter(([, , width, height]) => width === EXPECTED_TOOLTIP_WIDTH && height === EXPECTED_TOOLTIP_HEIGHT);

    // Each draw uses roundRect three times: background, gradient overlay, border.
    expect(mainBoxCalls).toHaveLength(6);

    const accentLine = vi
      .mocked(ctx.fillRect)
      .mock.calls.find(([, , width, height]) => width === EXPECTED_ACCENT_WIDTH && height === EXPECTED_ACCENT_HEIGHT);
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

    const firstRoundRect = vi.mocked(ctx.roundRect).mock.calls[0];
    expect(firstRoundRect?.[0]).toBe(116);
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
      getServerData: () => ({}),
    };
    const ship = makeShip();

    renderer.drawTooltip([hoveredObject] as never, ship as never, 1);

    const lines = vi.mocked(ctx.fillText).mock.calls.map(call => call[0]);
    expect(lines).toContain('ENEMY SHIP');
    expect(lines).toContain('Level: 7');
    expect(lines).toContain('Speed: 12.3');
    expect(lines).toContain('Distance: 40');
  });

  test('drawTooltip_friendlyContactInHailRange_showsContactNameShipNameAndHailAction', () => {
    const ctx = makeContext();
    const renderer = new TooltipRenderer(makeCanvas(ctx));
    renderer.updateCanvasStrings({ ...defaultCanvasStrings, contactNames: { vess: 'Quartermaster Vess' } });
    const contact = makeNpcShip(100 + HAIL_RANGE, { npcDisposition: 'friendly', contactId: 'vess', username: 'ISV Ledger' });

    renderer.drawTooltip([contact] as never, makeShip() as never, 1);

    const lines = drawnLines(ctx);
    expect(lines).toContain('FRIENDLY CONTACT');
    expect(lines).toContain('Quartermaster Vess');
    expect(lines).toContain('ISV Ledger');
    expect(lines).toContain(defaultCanvasStrings.actionTapToHail);
    expect(lines).not.toContain(defaultCanvasStrings.hailTooFar);
  });

  test('drawTooltip_friendlyContactOutOfHailRange_asksToFlyCloser', () => {
    const ctx = makeContext();
    const renderer = new TooltipRenderer(makeCanvas(ctx));
    const contact = makeNpcShip(100 + HAIL_RANGE + 1, { npcDisposition: 'friendly', contactId: 'vess' });

    renderer.drawTooltip([contact] as never, makeShip() as never, 1);

    const lines = drawnLines(ctx);
    expect(lines).toContain(defaultCanvasStrings.hailTooFar);
    expect(lines).not.toContain(defaultCanvasStrings.actionTapToHail);
  });

  test('drawTooltip_aggressiveNpcShip_showsNameLevelAndWarning', () => {
    const ctx = makeContext();
    const renderer = new TooltipRenderer(makeCanvas(ctx));
    const marauder = makeNpcShip(160, { npcDisposition: 'aggressive', username: 'Horde Marauder Lv.4' }, 4);

    renderer.drawTooltip([marauder] as never, makeShip() as never, 1);

    const lines = drawnLines(ctx);
    expect(lines).toContain('NPC SHIP');
    expect(lines).toContain('Horde Marauder Lv.4');
    expect(lines).toContain('Level: 4');
    expect(lines).toContain(defaultCanvasStrings.aggressiveShip);
  });

  test('drawTooltip_passiveNpcShip_hasNoWarning', () => {
    const ctx = makeContext();
    const renderer = new TooltipRenderer(makeCanvas(ctx));
    const pirate = makeNpcShip(160, { npcDisposition: 'hostile', username: 'Iron Horde Pirate Lv.2' }, 2);

    renderer.drawTooltip([pirate] as never, makeShip() as never, 1);

    expect(drawnLines(ctx)).not.toContain(defaultCanvasStrings.aggressiveShip);
  });
});
