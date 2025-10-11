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
  username?: string; // Optional: only present for player_ship type
  shipImageIndex?: number; // Optional: only present for player_ship type
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
  username: string; // Required for player ships
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

export interface TargetingLine {
  startX: number;        // Ship position when line was created (world coords)
  startY: number;
  targetX: number;       // Clicked target position (world coords) 
  targetY: number;
  createdAt: number;     // Timestamp when line was created
  duration: number;      // Total duration (4000ms)
}

export interface InterceptionLines {
  shipToInterceptX: number;      // Ship position (global coords)
  shipToInterceptY: number;
  targetToInterceptX: number;    // Target position (global coords - may be outside world bounds)
  targetToInterceptY: number;
  interceptX: number;            // Interception point (global coords - may be outside world bounds)
  interceptY: number;
  timeToIntercept: number;       // Current time to intercept in seconds (updates as time passes)
  originalTimeToIntercept: number; // Original time to intercept (used for calculations)
  createdAt: number;             // Timestamp when lines were created
  duration: number;              // Total duration (4000ms)
}

export type GameObjectType = SpaceObject['type'];
