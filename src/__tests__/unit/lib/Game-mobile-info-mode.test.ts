import { describe, expect, test, beforeEach, vi } from 'vitest';
import { STARBASE_DOCK_RANGE, STARBASE_ID_OFFSET } from '@/shared/starbases';
import { setShipDirection } from '@/lib/client/services/navigationService';

const mockFindHoveredObject = vi.fn();
const mockGetShip = vi.fn();
const mockGetWidth = vi.fn(() => 5000);
const mockGetHeight = vi.fn(() => 5000);
const mockUpdateHoverStates = vi.fn();
const mockSetHoveredObjectById = vi.fn();

const objectRegistry = new Map<number, ReturnType<typeof makeStarbaseObj>>();

vi.mock('@/lib/client/game/World', () => ({
  World: class {
    static WIDTH = 5000;
    static HEIGHT = 5000;
    findHoveredObject = mockFindHoveredObject;
    getShip = mockGetShip;
    getWidth = mockGetWidth;
    getHeight = mockGetHeight;
    updateHoverStates = mockUpdateHoverStates;
    setHoveredObjectById = mockSetHoveredObjectById;
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

const mockCalculateToroidalDistance = vi.fn((...args: [{ x: number; y: number }, { x: number; y: number }, { width: number; height: number }]) => {
  void args;
  return 100;
});
vi.mock('@shared/physics', () => ({
  calculateToroidalDistance: (...args: [{ x: number; y: number }, { x: number; y: number }, { width: number; height: number }]) => mockCalculateToroidalDistance(...args),
}));

vi.mock('@/lib/client/debug/debugState', () => ({
  debugState: { debugDrawingsEnabled: false, setDebugDrawingsEnabled: vi.fn() },
}));

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
  };
}

function makeStarbaseObj(id = STARBASE_ID_OFFSET + 1, x = 2500, y = 2500) {
  const obj = {
    getType: () => 'starbase' as string,
    getId: () => id,
    getX: () => x,
    getY: () => y,
    getUserId: () => null,
  };
  objectRegistry.set(id, obj);
  return obj;
}

function makeShip(x = 2500, y = 2500) {
  return {
    getX: () => x,
    getY: () => y,
  };
}

const { Game } = await import('@/lib/client/game/Game');

describe('Game mobile info mode', () => {
  let canvas: ReturnType<typeof makeCanvas>;
  let game: InstanceType<typeof Game>;

  beforeEach(() => {
    vi.clearAllMocks();
    objectRegistry.clear();
    canvas = makeCanvas();
    mockGetShip.mockReturnValue(makeShip());
    mockFindHoveredObject.mockReturnValue(null);
    mockSetHoveredObjectById.mockImplementation((objectId?: number) => {
      if (objectId === undefined) {
        return undefined;
      }
      return objectRegistry.get(objectId);
    });
    game = new Game(canvas as unknown as HTMLCanvasElement);
    game.setMobileInteractionMode(true);
    game.setMobileInfoMode(true);
    game.setAttackClickMode(true);
  });

  test('mobileInfoMode_firstTapOnObject_onlySelectsObject', () => {
    const callback = vi.fn();
    const starbase = makeStarbaseObj();

    game.setStarbaseEntryCallback(callback);
    mockFindHoveredObject.mockReturnValue(starbase);
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE - 1);

    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(callback).not.toHaveBeenCalled();
    expect(mockSetHoveredObjectById).toHaveBeenCalledWith(STARBASE_ID_OFFSET + 1);
  });

  test('mobileInfoMode_secondTapOnSameObject_triggersDirectAction', () => {
    const callback = vi.fn();
    const starbase = makeStarbaseObj();

    game.setStarbaseEntryCallback(callback);
    mockFindHoveredObject.mockReturnValue(starbase);
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE - 1);

    canvas._fire('click', { clientX: 400, clientY: 300 });
    canvas._fire('click', { clientX: 400, clientY: 300 });

    expect(callback).toHaveBeenCalledOnce();
    expect(mockSetHoveredObjectById).toHaveBeenLastCalledWith(undefined);
  });

  test('mobileInfoMode_tapDifferentObject_selectsNewObject', () => {
    const callback = vi.fn();
    const firstStarbase = makeStarbaseObj(STARBASE_ID_OFFSET + 1);
    const secondStarbase = makeStarbaseObj(STARBASE_ID_OFFSET + 2);

    game.setStarbaseEntryCallback(callback);
    mockCalculateToroidalDistance.mockReturnValue(STARBASE_DOCK_RANGE - 1);

    mockFindHoveredObject.mockReturnValue(firstStarbase);
    canvas._fire('click', { clientX: 400, clientY: 300 });

    mockFindHoveredObject.mockReturnValue(secondStarbase);
    canvas._fire('click', { clientX: 420, clientY: 320 });

    expect(callback).not.toHaveBeenCalled();
    expect(mockSetHoveredObjectById).toHaveBeenNthCalledWith(2, undefined);
    expect(mockSetHoveredObjectById).toHaveBeenNthCalledWith(3, STARBASE_ID_OFFSET + 2);
  });

  test('mobileInfoMode_tapEmptySpace_clearsSelectionAndChangesDirection', async () => {
    const firstStarbase = makeStarbaseObj(STARBASE_ID_OFFSET + 1);
    vi.mocked(setShipDirection).mockResolvedValue({ angle: 0, speed: 0 } as never);

    mockFindHoveredObject.mockReturnValue(firstStarbase);
    canvas._fire('click', { clientX: 400, clientY: 300 });

    mockFindHoveredObject.mockReturnValue(undefined);
    canvas._fire('click', { clientX: 460, clientY: 300 });

    await Promise.resolve();

    expect(mockSetHoveredObjectById).toHaveBeenNthCalledWith(2, undefined);
    expect(setShipDirection).toHaveBeenCalledTimes(1);
  });
});