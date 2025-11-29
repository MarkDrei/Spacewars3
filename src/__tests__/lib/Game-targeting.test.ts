import { describe, expect, test, beforeEach, vi } from 'vitest';
import { Game } from '@/lib/client/game/Game';
import type { World } from '@/lib/client/game/World';
import type { GameRenderer } from '@/lib/client/renderers/GameRenderer';

// Mock World class
const mockWorld = {
  getShip: vi.fn().mockReturnValue({
    getX: () => 100,
    getY: () => 100
  }),
  getSpaceObjects: vi.fn().mockReturnValue([]),
  setShipAngle: vi.fn(),
  updateFromServerData: vi.fn()
} as unknown as World;

// Mock GameRenderer
const mockRenderer = {
  drawWorld: vi.fn()
} as unknown as GameRenderer;

// Define mocks with factory functions (Vitest 4.x style)
vi.mock('@/lib/client/game/World', () => {
  return {
    World: class {
      constructor() {
        Object.assign(this, mockWorld);
      }
    }
  };
});

vi.mock('@/lib/client/renderers/GameRenderer', () => {
  return {
    GameRenderer: class {
      constructor() {
        Object.assign(this, mockRenderer);
      }
    }
  };
});

vi.mock('@/lib/client/services/navigationService');

// Mock canvas and context
const mockCanvas = {
  getContext: vi.fn().mockReturnValue({
    canvas: { width: 800, height: 800 }
  }),
  addEventListener: vi.fn(),
  width: 800,
  height: 800,
  getBoundingClientRect: vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 800
  })
} as unknown as HTMLCanvasElement;

// Helper functions to access private methods and properties safely
const callPrivateMethod = <T>(obj: unknown, methodName: string, ...args: unknown[]): T => {
  return (obj as Record<string, (...args: unknown[]) => T>)[methodName](...args);
};

const setPrivateProperty = (obj: unknown, propertyName: string, value: unknown): void => {
  (obj as Record<string, unknown>)[propertyName] = value;
};

describe('Game Class - Targeting Line Functionality', () => {
  let game: Game;

  beforeEach(async () => {
    vi.clearAllMocks();
    game = new Game(mockCanvas);
  });

  describe('getTargetingLine', () => {
    test('should return null when no targeting line exists', () => {
      const targetingLine = game.getTargetingLine();
      expect(targetingLine).toBeNull();
    });

    test('should clean up expired targeting lines', () => {
      // Create a targeting line manually by calling the private method
      const pastTime = Date.now() - 5000; // 5 seconds ago
      setPrivateProperty(game, 'targetingLine', {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: pastTime,
        duration: 4000
      });

      const targetingLine = game.getTargetingLine();
      expect(targetingLine).toBeNull(); // Should be cleaned up
    });

    test('should return valid targeting line when not expired', () => {
      const currentTime = Date.now();
      setPrivateProperty(game, 'targetingLine', {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: currentTime,
        duration: 4000
      });

      const targetingLine = game.getTargetingLine();
      expect(targetingLine).not.toBeNull();
      expect(targetingLine?.startX).toBe(100);
      expect(targetingLine?.targetX).toBe(200);
    });
  });

  describe('createTargetingLine', () => {
    test('should create targeting line with correct coordinates', () => {
      const targetX = 250;
      const targetY = 350;
      
      callPrivateMethod(game, 'createTargetingLine', targetX, targetY);
      
      const targetingLine = game.getTargetingLine();
      expect(targetingLine).not.toBeNull();
      expect(targetingLine?.startX).toBe(100); // Ship X position
      expect(targetingLine?.startY).toBe(100); // Ship Y position
      expect(targetingLine?.targetX).toBe(targetX);
      expect(targetingLine?.targetY).toBe(targetY);
      expect(targetingLine?.duration).toBe(4000);
    });

    test('should overwrite existing targeting line', () => {
      // Create first targeting line
      callPrivateMethod(game, 'createTargetingLine', 200, 200);
      const firstLine = game.getTargetingLine();

      // Create second targeting line immediately
      callPrivateMethod(game, 'createTargetingLine', 300, 300);
      const secondLine = game.getTargetingLine();
      
      // Verify the targeting line was overwritten with new coordinates
      expect(secondLine?.targetX).toBe(300);
      expect(secondLine?.targetY).toBe(300);
      expect(secondLine?.startX).toBe(100); // Ship position
      expect(secondLine?.startY).toBe(100); // Ship position
      
      // Verify it's the same object reference (overwritten, not just updated)
      expect(firstLine?.targetX).not.toBe(secondLine?.targetX);
    });
  });

  describe('clearTargetingLine', () => {
    test('should clear existing targeting line', () => {
      // Create a targeting line first
      callPrivateMethod(game, 'createTargetingLine', 200, 200);
      expect(game.getTargetingLine()).not.toBeNull();

      // Clear it
      callPrivateMethod(game, 'clearTargetingLine');
      expect(game.getTargetingLine()).toBeNull();
    });
  });

  describe('stop method', () => {
    test('should clear targeting line when game stops', () => {
      // Create a targeting line first
      callPrivateMethod(game, 'createTargetingLine', 200, 200);
      expect(game.getTargetingLine()).not.toBeNull();

      // Stop the game
      game.stop();
      expect(game.getTargetingLine()).toBeNull();
    });
  });

  describe('handleDirectionChange integration', () => {
    test('should create targeting line when target coordinates are provided', async () => {
      const { setShipDirection } = await import('@/lib/client/services/navigationService');
      vi.mocked(setShipDirection).mockResolvedValue({
        success: true,
        speed: 5,
        angle: 45,
        maxSpeed: 5
      });

      const angleDegrees = 45;
      const targetX = 200;
      const targetY = 200;

      await callPrivateMethod(game, 'handleDirectionChange', angleDegrees, targetX, targetY);

      const targetingLine = game.getTargetingLine();
      expect(targetingLine).not.toBeNull();
      expect(targetingLine?.targetX).toBe(targetX);
      expect(targetingLine?.targetY).toBe(targetY);
      expect(setShipDirection).toHaveBeenCalledWith(angleDegrees);
    });

    test('should not create targeting line when target coordinates are not provided', async () => {
      const { setShipDirection } = await import('@/lib/client/services/navigationService');
      vi.mocked(setShipDirection).mockResolvedValue({
        success: true,
        speed: 5,
        angle: 45,
        maxSpeed: 5
      });

      const angleDegrees = 45;

      await callPrivateMethod(game, 'handleDirectionChange', angleDegrees);

      const targetingLine = game.getTargetingLine();
      expect(targetingLine).toBeNull();
      expect(setShipDirection).toHaveBeenCalledWith(angleDegrees);
    });
  });
});