import { describe, it, expect } from 'vitest';
import { Starbase } from '@/lib/client/game/Starbase';
import type { StarbaseObject } from '@shared/types/gameTypes';

function makeStarbaseData(x = 2500, y = 2500): StarbaseObject {
  return {
    id: 9001,
    type: 'starbase',
    x,
    y,
    speed: 0,
    angle: 0,
    last_position_update_ms: 0,
    picture_id: 1,
  };
}

describe('Starbase client class', () => {
  it('getHoverRadius_returnsStarbaseHoverRadius', () => {
    const s = new Starbase(makeStarbaseData());
    expect(s.getHoverRadius()).toBe(Starbase.STARBASE_HOVER_RADIUS);
  });

  it('isPointInHoverRadius_withinRadius_returnsTrue', () => {
    const s = new Starbase(makeStarbaseData(0, 0));
    // A point exactly at the edge of the hover radius
    expect(s.isPointInHoverRadius(Starbase.STARBASE_HOVER_RADIUS - 1, 0)).toBe(true);
  });

  it('isPointInHoverRadius_outsideRadius_returnsFalse', () => {
    const s = new Starbase(makeStarbaseData(0, 0));
    expect(s.isPointInHoverRadius(Starbase.STARBASE_HOVER_RADIUS + 1, 0)).toBe(false);
  });

  it('getType_returnsStarbase', () => {
    const s = new Starbase(makeStarbaseData());
    expect(s.getType()).toBe('starbase');
  });
});
