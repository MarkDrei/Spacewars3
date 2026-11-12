import { describe, expect, it } from 'vitest';
import { projectWorldData } from '@/lib/client/game/worldProjection';
import type { WorldData, SpaceObject } from '@shared/types/gameTypes';

const T0 = 1_800_000_000_000;

const object = (overrides: Partial<SpaceObject>): SpaceObject => ({
  id: 1, type: 'asteroid', x: 100, y: 100, speed: 60, angle: 0, last_position_update_ms: T0, picture_id: 1,
  ...overrides,
});

const snapshot = (...objects: SpaceObject[]): WorldData => ({
  worldSize: { width: 5000, height: 5000 },
  spaceObjects: objects,
  currentTime: T0,
});

describe('projectWorldData', () => {
  it('projectWorldData_movingObject_advancesAlongHeading', () => {
    // 60 units/minute * factor 50 = 50 units per second along angle 0 (positive x)
    const projected = projectWorldData(snapshot(object({})), T0 + 1000, 1);

    expect(projected.spaceObjects[0].x).toBeCloseTo(150);
    expect(projected.spaceObjects[0].y).toBeCloseTo(100);
  });

  it('projectWorldData_crossesWorldEdge_wraps', () => {
    const projected = projectWorldData(snapshot(object({ x: 4990 })), T0 + 1000, 1);
    expect(projected.spaceObjects[0].x).toBeCloseTo(40);
  });

  it('projectWorldData_timeMultiplier_scalesMovement', () => {
    const projected = projectWorldData(snapshot(object({})), T0 + 1000, 10);
    expect(projected.spaceObjects[0].x).toBeCloseTo(600);
  });

  it('projectWorldData_npcShip_keepsSnapshotTimestampForOrbitInterpolation', () => {
    const npc = object({ id: 2, type: 'npc_ship' });
    const projected = projectWorldData(snapshot(npc), T0 + 5000, 1);
    expect(projected.spaceObjects[0]).toEqual(npc);
  });

  it('projectWorldData_projectedEveryFrame_matchesSingleProjectionAndKeepsSnapshot', () => {
    const base = snapshot(object({ angle: 30 }));
    let frame: WorldData = base;
    for (let t = 16; t <= 3000; t += 16) {
      frame = projectWorldData(base, T0 + t, 1);
    }

    const single = projectWorldData(base, T0 + 2992, 1);
    expect(frame.spaceObjects[0].x).toBeCloseTo(single.spaceObjects[0].x, 9);
    expect(base.spaceObjects[0].x).toBe(100);
    expect(base.spaceObjects[0].last_position_update_ms).toBe(T0);
  });
});
