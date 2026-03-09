import { describe, expect, test, beforeEach, vi } from 'vitest';
import { STARBASE_DOCK_RANGE } from '@/shared/starbases';

// ── Mock all heavy dependencies before importing Game ─────────────────────────

const mockFindHoveredObject = vi.fn();
const mockGetShip = vi.fn();
const mockGetWidth = vi.fn(() => 5000);
const mockGetHeight = vi.fn(() => 5000);
const mockUpdateHoverStates = vi.fn();

vi.mock('@/lib/client/game/World', () => ({
  World: class {
    static WIDTH = 5000;
    static HEIGHT = 5000;
    findHoveredObject = mockFindHoveredObject;
    getShip = mockGetShip;
    getWidth = mockGetWidth;
    getHeight = mockGetHeight;
    updateHoverStates = mockUpdateHoverStates;
    getSpaceObjects = vi.fn(() => []);
    updateFromServerData = vi.fn();
    setShipAngle = vi.fn();
  },
}));

vi.mock('@/lib/client/renderers/GameRenderer', () => ({
  GameRenderer: class {
    drawWorld = vi.fn();
    getWorldScale = vi.fn(() => 1);
    setZoom = vi.fn();
  },
}));

vi.mock('@/lib/client/renderers/InterceptionLineRenderer', () => ({
  InterceptionLineRenderer: class {
    drawInterceptionLines = vi.fn();
  },
}));

vi.mock('@/lib/client/services/navigationService', () => ({
  setShipDirection: vi.fn(),
  interceptTarget: vi.fn(),
}));

vi.mock('@/lib/client/services/shipStatsService', () => ({
  getShipStats: vi.fn(),
}));

vi.mock('@/lib/client/game/InterceptCalculator', () => ({
  InterceptCalculator: {
    calculateInterceptAngle: vi.fn(() => ({
      angle: 0,
      globalCoordinates: { shipX: 0, shipY: 0, targetX: 100, targetY: 100, interceptX: 50, interceptY: 50 },
      timeToIntercept: 5,
    })),
  },
}));

vi.mock('@/lib/client/services/collectionService', () => ({
  collectionService: { collectObject: vi.fn() },
}));

const mockCalculateToroidalDistance = vi.fn((_pos1: { x: number; y: number }, _pos2: { x: number; y: number }, _bounds: { width: number; height: number }) => 100);
vi.mock('@shared/physics', () => ({
  calculateToroidalDistance: (...args: [{ x: number; y: number }, { x: number; y: number }, { width: number; height: number }]) => mockCalculateToroidalDistance(...args),
}));

vi.mock('@/lib/client/debug/debugState', () => ({
  debugState: { debugDrawingsEnabled: false, setDebugDrawingsEnabled: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal HTMLCanvasElement fake that captures event listeners */
function makeCanvas() {
  const listeners: Record<string, EventListener[]> = {};
  return {
    width: 800,
    height: 600,
    getContext: () => ({
      canvas: { width: 800, height: 600 },
    }),
    addEventListener(type: string, fn: EventListener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    _fire(type: string, event: Partial<MouseEvent>) {
      (listeners[type] ?? []).forEach(fn => fn(event as MouseEvent));
    },
    _listeners: listeners,
  };
}

/** Build a fake SpaceObjectOld for a starbase */
function makeStarbaseObj(id = 9001, x = 2500, y = 2500) {
  return {
    getType: () => 'starbase' as string,
    getId: () => id,
    getX: () => x,
    getY: () => y,
    getUserId: () => null,
  };
}

/** Build a fake ship */
function makeShip(x = 2500, y = 2500) {
  return {
    getX: () => x,
    getY: () => y,
  };
}

// ── Import Game after mocks are in place ──────────────────────────────────────

const { Game } = await import('@/lib/client/game/Game');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Game – starbase entry callback', () => {
  let canvas: ReturnType<typeof makeCanvas>;
  let game: InstanceType<typeof Game>;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = makeCanvas();
    mockGetShip.mockReturnValue(makeShip());
    mockFindHoveredObject.mockReturnValue(null);
    game = new Game(canvas as unknown as HTMLCanvasElement);
    game.setAttackClickMode(true);
  });

  test('setStarbaseEntryCallback_registersCallback_storesRef', () => {
    const cb = vi.fn();
    game.setStarbaseEntryCallback(cb);
    // Access private field via casting to verify storage
    const stored = (game as unknown as Record<string, unknown>)['onStarbaseEntryCallback'];
    expect(stored).toBe(cb);
  });

  test('starbaseClick_withinDockRange_firesCallback', () => {
    const cb = vi.fn();
    game.setStarbaseEntryCallback(cb);

    // Starbase hovered; distance returned is within range
    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9001));
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE - 1);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(9001);
  });

  test('starbaseClick_exactlyAtDockRange_firesCallback', () => {
    const cb = vi.fn();
    game.setStarbaseEntryCallback(cb);

    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9001));
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(9001);
  });

  test('starbaseClick_outsideDockRange_doesNotFireCallback', () => {
    const cb = vi.fn();
    game.setStarbaseEntryCallback(cb);

    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9001));
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE + 1);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(cb).not.toHaveBeenCalled();
  });

  test('starbaseClick_outsideDockRange_triggersInterception', async () => {
    const { interceptTarget } = await import('@/lib/client/services/navigationService');
    const { getShipStats } = await import('@/lib/client/services/shipStatsService');
    vi.mocked(getShipStats).mockResolvedValue({ maxSpeed: 10 } as never);

    game.setStarbaseEntryCallback(vi.fn());
    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9001));
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE + 100);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    // Give async handleInterception a tick to proceed
    await new Promise(r => setTimeout(r, 0));
    expect(interceptTarget).toHaveBeenCalled();
  });

  test('starbaseClick_attackModeOff_doesNotFireCallback', () => {
    const cb = vi.fn();
    game.setStarbaseEntryCallback(cb);
    game.setAttackClickMode(false);

    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9001));
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE - 1);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(cb).not.toHaveBeenCalled();
  });

  test('starbaseClick_noCallbackSet_doesNotThrow', () => {
    // No callback registered — clicking within range should silently no-op
    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9001));
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE - 1);

    expect(() => canvas._fire('click', { clientX: 400, clientY: 300 })).not.toThrow();
  });

  test('starbaseClick_correctIdPassedToCallback', () => {
    const cb = vi.fn();
    game.setStarbaseEntryCallback(cb);

    mockFindHoveredObject.mockReturnValue(makeStarbaseObj(9002));
    mockCalculateToroidalDistance.mockReturnValue(1);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(cb).toHaveBeenCalledWith(9002);
  });
});
