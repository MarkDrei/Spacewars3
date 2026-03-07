import type { StarbaseObject } from '@shared/types/gameTypes';

export const STARBASE_ID_OFFSET = 9000;
export const STARBASE_DOCK_RANGE = 500;

export const STARBASES: StarbaseObject[] = [
  {
    id: STARBASE_ID_OFFSET + 1,
    type: 'starbase',
    x: 2500,
    y: 2500,
    speed: 0,
    angle: 0,
    last_position_update_ms: 0,
    picture_id: 1,
  },
];
