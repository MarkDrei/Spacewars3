import { describe, expect, test, beforeEach, vi } from 'vitest';
import { TargetingLineRenderer } from '@/lib/client/renderers/TargetingLineRenderer';
import type { TargetingLine } from '@shared/types/gameTypes';

// Mock World class to provide static WIDTH and HEIGHT
vi.mock('@/lib/client/game/World', () => ({
  World: {
    WIDTH: 1000,
    HEIGHT: 1000
  }
}));

// Helper functions to access private methods safely
const callPrivateMethod = <T>(obj: unknown, methodName: string, ...args: unknown[]): T => {
  return (obj as Record<string, (...args: unknown[]) => T>)[methodName](...args);
};

describe('TargetingLineRenderer', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;
  let renderer: TargetingLineRenderer;

  beforeEach(() => {
    // Create mock canvas and context
    mockCanvas = {
      width: 800,
      height: 800
    } as HTMLCanvasElement;

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      clip: vi.fn(),
      canvas: mockCanvas
    } as unknown as CanvasRenderingContext2D;

    renderer = new TargetingLineRenderer(mockCtx);
  });

  describe('drawTargetingLine', () => {
    test('should render targeting line with correct opacity', () => {
      const targetingLine: TargetingLine = {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: Date.now(),
        duration: 4000
      };

      renderer.drawTargetingLine(targetingLine, 400, 400, 100, 100);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    test('should not render when opacity is zero or negative', () => {
      const expiredTargetingLine: TargetingLine = {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: Date.now() - 5000, // 5 seconds ago, expired
        duration: 4000
      };

      renderer.drawTargetingLine(expiredTargetingLine, 400, 400, 100, 100);

      // Should not call rendering methods when opacity is 0
      expect(mockCtx.save).not.toHaveBeenCalled();
      expect(mockCtx.restore).not.toHaveBeenCalled();
    });

    test('should convert world coordinates to screen coordinates correctly', () => {
      const targetingLine: TargetingLine = {
        startX: 1000, // World coordinate at edge
        startY: 1000, // World coordinate at edge
        targetX: 0,   // World coordinate at opposite edge
        targetY: 0,   // World coordinate at opposite edge
        createdAt: Date.now(),
        duration: 4000
      };

      renderer.drawTargetingLine(targetingLine, 400, 400, 100, 100);

      // Check that moveTo and lineTo were called with screen coordinates
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });
  });

  describe('opacity calculation', () => {
    test('should calculate correct opacity for new targeting line', () => {
      const newTargetingLine: TargetingLine = {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: Date.now(),
        duration: 4000
      };

      // Access private method for testing
      const opacity = callPrivateMethod<number>(renderer, 'calculateOpacity', newTargetingLine);
      expect(opacity).toBe(1.0); // Should be full opacity for new line
    });

    test('should calculate correct opacity for half-expired targeting line', () => {
      const halfExpiredTargetingLine: TargetingLine = {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: Date.now() - 2000, // 2 seconds ago (half of 4 second duration)
        duration: 4000
      };

      const opacity = callPrivateMethod<number>(renderer, 'calculateOpacity', halfExpiredTargetingLine);
      expect(opacity).toBe(0.5); // Should be half opacity
    });

    test('should return zero opacity for fully expired targeting line', () => {
      const expiredTargetingLine: TargetingLine = {
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 200,
        createdAt: Date.now() - 5000, // 5 seconds ago (past 4 second duration)
        duration: 4000
      };

      const opacity = callPrivateMethod<number>(renderer, 'calculateOpacity', expiredTargetingLine);
      expect(opacity).toBe(0); // Should be zero opacity
    });
  });

  describe('visibility check', () => {
    test('should detect visible positions correctly', () => {
      const isVisible = callPrivateMethod<boolean>(renderer, 'isPositionVisible', 100, 100);
      expect(isVisible).toBe(true);
    });

    test('should detect invisible positions correctly', () => {
      const isVisible = callPrivateMethod<boolean>(renderer, 'isPositionVisible', -100, -100);
      expect(isVisible).toBe(false);
    });

    test('should include margin in visibility check', () => {
      // Position just outside canvas but within margin should be visible
      const isVisible = callPrivateMethod<boolean>(renderer, 'isPositionVisible', -25, -25);
      expect(isVisible).toBe(true);
    });
  });

  describe('target indicator', () => {
    test('should draw crosshair at target position', () => {
      callPrivateMethod(renderer, 'drawTargetIndicator', 100, 100, 0.8);

      // Should call moveTo and lineTo for drawing crosshair lines
      expect(mockCtx.moveTo).toHaveBeenCalledTimes(2); // Two lines (horizontal and vertical)
      expect(mockCtx.lineTo).toHaveBeenCalledTimes(2); // Two lines (horizontal and vertical)
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });
});