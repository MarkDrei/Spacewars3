// ---
// Shared types for game objects used by both client and server
// ---

export interface SpaceObject {
  id: number;
  type: 'player_ship' | 'asteroid' | 'shipwreck' | 'escape_pod';
  x: number;
  y: number;
  velocity: number;
  angle: number;
  last_position_update: number;
}

export interface WorldData {
  worldSize: {
    width: number;
    height: number;
  };
  spaceObjects: SpaceObject[];
}

export interface PlayerShip extends SpaceObject {
  type: 'player_ship';
  userId: number;
}

export interface Collectible extends SpaceObject {
  type: 'asteroid' | 'shipwreck' | 'escape_pod';
  ironValue?: number;
  isCollected?: boolean;
}

export type GameObjectType = SpaceObject['type'];
