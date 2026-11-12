import { describe, expect, it } from 'vitest';
import { generateTeleportPosition } from '@/lib/server/battle/battleService';
import { calculateToroidalDistance } from '@shared/physics';

const WORLD = { width: 5000, height: 5000 };

/** Deterministic random source returning the given values in order (as fractions of the world). */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('generateTeleportPosition', () => {
  it('generateTeleportPosition_candidateCloseAcrossWorldEdge_isRejected', () => {
    // First candidate (4990, 4990) is ~14 units from (5, 5) across the wrap; second is far away
    const pos = generateTeleportPosition({ x: 5, y: 5 }, 1000, WORLD, sequence(0.998, 0.998, 0.5, 0.5));

    expect(pos).toEqual({ x: 2500, y: 2500 });
  });

  it('generateTeleportPosition_noCandidateFarEnough_fallsBackToFarthestPoint', () => {
    const from = { x: 4800, y: 100 };
    const pos = generateTeleportPosition(from, 1000, WORLD, () => 0.96);

    expect(pos).toEqual({ x: 2300, y: 2600 });
    expect(calculateToroidalDistance(from, pos, WORLD)).toBeCloseTo(Math.hypot(2500, 2500));
  });

  it('generateTeleportPosition_randomPositions_alwaysRespectMinimumDistance', () => {
    for (let i = 0; i < 200; i++) {
      const from = { x: Math.random() * WORLD.width, y: Math.random() * WORLD.height };
      const pos = generateTeleportPosition(from, 1000, WORLD);
      expect(calculateToroidalDistance(from, pos, WORLD)).toBeGreaterThanOrEqual(1000);
    }
  });
});
