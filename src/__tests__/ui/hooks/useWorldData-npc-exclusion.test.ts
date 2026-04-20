/**
 * Tests that NPC ships are excluded from the physics-based optimistic position
 * updates in useWorldData. NPCs use renderer-side orbit interpolation instead.
 *
 * If NPCs were passed through updateAllObjectPositions, their
 * last_position_update_ms would be reset to Date.now() every frame, causing
 * NPCShipRenderer to always see ~0ms elapsed time and render them as stationary.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as physics from '@shared/physics';
import { worldDataService } from '@/lib/client/services/worldDataService';
import { renderHook, act } from '@testing-library/react';
import { useWorldData } from '@/lib/client/hooks/useWorldData';

vi.mock('@/lib/client/services/worldDataService');
vi.mock('@/lib/client/timeMultiplier', () => ({ getTimeMultiplier: () => 1 }));

const mockWorldDataService = worldDataService as typeof worldDataService & {
  getWorldData: ReturnType<typeof vi.fn>;
};

function makeSpaceObject(type: string, id: number) {
  return { id, type, x: 1000, y: 1000, speed: 10, angle: 0, last_position_update_ms: Date.now(), picture_id: 1 };
}

describe('useWorldData NPC exclusion from physics updates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('npcShip_onFetch_notPassedToTimeCorrection', async () => {
    const npcObj = makeSpaceObject('npc_ship', 1_000_001);
    const asteroidObj = makeSpaceObject('asteroid', 1);

    const serverData = {
      success: true,
      data: {
        data: {
          worldSize: { width: 5000, height: 5000 },
          spaceObjects: [npcObj, asteroidObj],
        },
        responseReceivedAt: Date.now(),
        roundTripTime: 0,
      },
    };

    mockWorldDataService.getWorldData = vi.fn().mockResolvedValue(serverData);

    // Spy: capture what objects are passed to time-correction on initial fetch
    const passedObjects: unknown[] = [];
    vi.spyOn(physics, 'updateAllObjectPositionsWithTimeCorrection').mockImplementation((objects) => {
      passedObjects.push(...objects);
      return objects as ReturnType<typeof physics.updateAllObjectPositionsWithTimeCorrection>;
    });

    const { unmount } = renderHook(() => useWorldData(60_000));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    unmount();

    // The time-correction spy must have been called (initial fetch happened)
    expect(passedObjects.length).toBeGreaterThan(0);

    // NPC ships must NOT have been passed to the time-correction physics function
    const hasNpc = (passedObjects as { type: string }[]).some(o => o.type === 'npc_ship');
    expect(hasNpc).toBe(false);

    // Non-NPC objects (e.g. asteroids) must have been passed
    const hasAsteroid = (passedObjects as { type: string }[]).some(o => o.type === 'asteroid');
    expect(hasAsteroid).toBe(true);
  });
});
