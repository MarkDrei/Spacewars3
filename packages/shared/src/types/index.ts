// Type definitions shared between client and server
export interface User {
  id: number;
  username: string;
  iron: number;
  lastUpdated: number;
}

export interface GameState {
  score: number;
  shipStats: {
    speed: number;
    position: { x: number; y: number };
  };
  inventory: {
    fuel: number;
    weapons: number;
    tech: number;
    generic: number;
  };
}
