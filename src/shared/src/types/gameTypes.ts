// ---
// Shared types for game objects used by both client and server
// ---

export interface SpaceObject {
  id: number;
  type: 'player_ship' | 'asteroid' | 'shipwreck' | 'escape_pod';
  x: number;
  y: number;
  speed: number;
  angle: number;
  last_position_update_ms: number;
}

export interface WorldData {
  worldSize: {
    width: number;
    height: number;
  };
  spaceObjects: SpaceObject[];
  currentTime: number; // Server timestamp for synchronization
}

export interface PlayerShip extends SpaceObject {
  type: 'player_ship';
  userId: number;
}

export interface Asteroid extends SpaceObject {
  type: 'asteroid';
  value: number;
}

export interface Shipwreck extends SpaceObject {
  type: 'shipwreck';
  value: number;
}

export interface EscapePod extends SpaceObject {
  type: 'escape_pod';
  value: number;
  survivors: number;
}

export interface Collectible extends SpaceObject {
  type: 'asteroid' | 'shipwreck' | 'escape_pod';
  value: number;
}

export type GameObjectType = SpaceObject['type'];
