import type { StarbaseObject } from '@shared/types/gameTypes';

export const STARBASE_ID_OFFSET = 2_000_000_000;
export const STARBASE_DOCK_RANGE = 500;

/** Stations of the world. `key` is the location id used for names (locale files) and quests. */
export const STATION_DEFINITIONS = [
  { key: 'ironstrike_station', id: STARBASE_ID_OFFSET + 1, x: 4000, y: 4000 },
  { key: 'meridian_observatory', id: STARBASE_ID_OFFSET + 2, x: 900, y: 1100 },
  { key: 'bastion_outpost', id: STARBASE_ID_OFFSET + 3, x: 1200, y: 3900 },
] as const;

export type StationKey = (typeof STATION_DEFINITIONS)[number]['key'];

// All stations share one picture until the additional station images are added to the repo.
export const STARBASES: StarbaseObject[] = STATION_DEFINITIONS.map((station) => ({
  id: station.id,
  type: 'starbase',
  x: station.x,
  y: station.y,
  speed: 0,
  angle: 0,
  last_position_update_ms: 0,
  picture_id: 1,
}));

/** Location key of a station object id, or null when the id is not a station. */
export function stationKeyForId(id: number): StationKey | null {
  return STATION_DEFINITIONS.find((station) => station.id === id)?.key ?? null;
}
