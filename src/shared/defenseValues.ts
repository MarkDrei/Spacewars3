// Shared types for defense values used across client and server

export interface DefenseValue {
  name: string;
  current: number;
  max: number;
  regenRate: number; // per second
}

export interface DefenseValues {
  hull: DefenseValue;
  armor: DefenseValue;
  shield: DefenseValue;
}
