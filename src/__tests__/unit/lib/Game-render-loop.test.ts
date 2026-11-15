import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// ── Mock all heavy dependencies before importing Game ─────────────────────────

const mockFindHoveredObject = vi.fn();
const mockGetShip = vi.fn();
const mockGetWidth = vi.fn(() => 5000);
const mockGetHeight = vi.fn(() => 5000);
const mockUpdateHoverStates = vi.fn();
const mockDrawWorld = vi.fn();
const mockUpdateFromServerData = vi.fn();

vi.mock('@/lib/client/game/World', () => ({
  World: class {
    static WIDTH = 5000;
    static HEIGHT = 5000;
    findHoveredObject = mockFindHoveredObject;
    getShip = mockGetShip;
    getWidth = mockGetWidth;
    getHeight = mockGetHeight;
    updateHoverStates = mockUpdateHoverStates;
    getSpaceObjects = vi.fn(() => [{}]);
    updateFromServerData = mockUpdateFromServerData;
    setShipAngle = vi.fn();
  },
}));

vi.mock('@/lib/client/renderers/GameRenderer', () => ({
  GameRenderer: class {
    drawWorld = mockDrawWorld;
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

const mockCalculateToroidalDistance = vi.fn(() => 100);
vi.mock('@shared/physics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/physics')>()),
  calculateToroidalDistance: () => mockCalculateToroidalDistance(),
}));

vi.mock('@/lib/client/timeMultiplier', () => ({ getTimeMultiplier: () => 1 }));

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

// ── Controllable animation frames ─────────────────────────────────────────────

let pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

/** Runs all callbacks requested so far (one "frame"). */
const runFrame = () => {
  const frames = [...pendingFrames.values()];
  pendingFrames = new Map();
  frames.forEach(callback => callback(performance.now()));
};

const { Game } = await import('@/lib/client/game/Game');

describe('Game – render loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingFrames = new Map();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      pendingFrames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      pendingFrames.delete(id);
    });
    mockGetShip.mockReturnValue({ getX: () => 0, getY: () => 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('gameLoop_running_drawsOncePerFrame', () => {
    const game = new Game(makeCanvas() as unknown as HTMLCanvasElement);
    game.start();

    runFrame();
    runFrame();

    expect(mockDrawWorld).toHaveBeenCalledTimes(2);
    game.stop();
  });

  test('gameLoop_stopThenStartWithinOneFrame_runsSingleLoop', () => {
    const game = new Game(makeCanvas() as unknown as HTMLCanvasElement);
    game.start();
    game.stop();
    game.start(); // e.g. re-initialisation before the pending frame ran

    runFrame();
    runFrame();

    expect(mockDrawWorld).toHaveBeenCalledTimes(2);
    game.stop();
  });

  test('gameLoop_stopped_drawsNothing', () => {
    const game = new Game(makeCanvas() as unknown as HTMLCanvasElement);
    game.start();
    game.stop();

    runFrame();

    expect(mockDrawWorld).not.toHaveBeenCalled();
  });

  test('gameLoop_betweenServerUpdates_projectsSnapshotToCurrentTime', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = 1_800_000_000_000;
    vi.setSystemTime(t0);
    const game = new Game(makeCanvas() as unknown as HTMLCanvasElement);
    const snapshot = {
      worldSize: { width: 5000, height: 5000 },
      currentTime: t0,
      spaceObjects: [{ id: 7, type: 'asteroid' as const, x: 100, y: 100, speed: 60, angle: 0, last_position_update_ms: t0, picture_id: 1 }],
    };
    game.updateWorldData(snapshot, 1);
    game.start();

    vi.setSystemTime(t0 + 1000);
    runFrame();

    const projected = mockUpdateFromServerData.mock.calls.at(-1)![0];
    expect(projected.spaceObjects[0].x).toBeCloseTo(150); // 50 units/s along angle 0
    expect(snapshot.spaceObjects[0].x).toBe(100); // snapshot itself untouched
    game.stop();
    vi.useRealTimers();
  });
});
