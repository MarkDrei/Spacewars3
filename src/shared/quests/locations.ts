// ---
// Named places of the world: stations and points of interest.
// Shared by server (visit detection, quest rules) and client (markers, quest log).
// Display names live in the locale files under `quests.locations.<id>`.
// ---

import { STARBASE_DOCK_RANGE, STATION_DEFINITIONS } from '../starbases';

export type LocationId =
  | 'ironstrike_station'
  | 'meridian_observatory'
  | 'bastion_outpost'
  | 'hordes_reach'
  | 'anvil_graveyard'
  | 'azure_drift'
  | 'listening_post_tau'
  | 'drifters_rock';

export type LocationKind = 'station' | 'lair' | 'wreck_field' | 'landmark';

export interface LocationDefinition {
  id: LocationId;
  kind: LocationKind;
  x: number;
  y: number;
  /** A ship within this distance (toroidal) has visited / discovered the location. */
  radius: number;
}

function station(key: (typeof STATION_DEFINITIONS)[number]['key']): LocationDefinition {
  const def = STATION_DEFINITIONS.find((s) => s.key === key)!;
  return { id: key, kind: 'station', x: def.x, y: def.y, radius: STARBASE_DOCK_RANGE };
}

export const LOCATIONS: readonly LocationDefinition[] = [
  station('ironstrike_station'),
  station('meridian_observatory'),
  station('bastion_outpost'),
  // Radius is larger than orbit + aggro radius of the marauders, so the lair can be scouted safely
  { id: 'hordes_reach', kind: 'lair', x: 2900, y: 1300, radius: 800 },
  // Radius is larger than orbit + aggro radius of the sentry drones. The field lies south of the
  // start position of new ships (world centre), which must stay outside of it.
  { id: 'anvil_graveyard', kind: 'wreck_field', x: 2500, y: 3400, radius: 650 },
  { id: 'azure_drift', kind: 'landmark', x: 300, y: 2700, radius: 300 },
  { id: 'listening_post_tau', kind: 'landmark', x: 3500, y: 2300, radius: 300 },
  { id: 'drifters_rock', kind: 'landmark', x: 4500, y: 800, radius: 400 },
];

export function getLocation(id: LocationId): LocationDefinition {
  const location = LOCATIONS.find((l) => l.id === id);
  if (!location) throw new Error(`Unknown location: ${id}`);
  return location;
}

/** XP for discovering a location for the first time. */
export const LOCATION_DISCOVERY_XP = 25;
