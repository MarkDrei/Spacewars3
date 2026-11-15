// ---
// Shared types for game objects used by both client and server
// ---

import type { ContactId, HostileArchetypeId } from '../../quests/npcArchetypes';

export interface SpaceObject {
  id: number;
  type: 'player_ship' | 'asteroid' | 'shipwreck' | 'escape_pod' | 'starbase' | 'npc_ship';
  x: number;
  y: number;
  speed: number;
  angle: number;
  last_position_update_ms: number;
  picture_id: number;
  username?: string; // Optional: only present for player_ship type
  userId?: number; // Optional: only present for player_ship type
  level?: number; // Optional: only present for player_ship type
  orbitAngleDeg?: number; // Optional: only present for npc_ship type
  angularVelocityDegPerSec?: number; // Optional: only present for npc_ship type
  orbitCenterX?: number; // Optional: only present for npc_ship type
  orbitCenterY?: number; // Optional: only present for npc_ship type
  orbitRadius?: number; // Optional: only present for npc_ship type
  /** npc_ship only: hostile ships can be attacked, aggressive ones also attack (kinds hunted by an active mission), friendly ones give missions. */
  npcDisposition?: NpcDisposition;
  /** Hostile and aggressive npc_ship only. */
  npcArchetype?: HostileArchetypeId;
  /** Friendly npc_ship only: the mission contact aboard. */
  contactId?: ContactId;
}

export type NpcDisposition = 'hostile' | 'aggressive' | 'friendly';

export interface WorldData {
  worldSize: {
    width: number;
    height: number;
  };
  spaceObjects: SpaceObject[];
  currentTime: number; // Server timestamp for synchronization
  /** Changes whenever the player's missions change; tells the client to reload them. */
  questRevision?: number;
  /** Present in the response in which an aggressive NPC ship attacked the player. */
  ambush?: { enemyName: string };
}

export interface PlayerShip extends SpaceObject {
  type: 'player_ship';
  userId: number;
  username: string; // Required for player ships
  level: number; // Required for player ships
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

export interface StarbaseObject extends SpaceObject {
  type: 'starbase';
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

/**
 * Enum of all available research types in the tech tree.
 * Shared between client and server to ensure consistency.
 */
export enum ResearchType {
  IronHarvesting = 'IronHarvesting',
  ShipSpeed = 'shipSpeed',
  Afterburner = 'Afterburner',
  // Projectile Weapons
  ProjectileDamage = 'projectileDamage',
  ProjectileReloadRate = 'projectileReloadRate',
  ProjectileAccuracy = 'projectileAccuracy',
  ProjectileWeaponTier = 'projectileWeaponTier',
  // Energy Weapons
  EnergyDamage = 'energyDamage',
  EnergyRechargeRate = 'energyRechargeRate',
  EnergyAccuracy = 'energyAccuracy',
  EnergyWeaponTier = 'energyWeaponTier',
  // Defense
  HullStrength = 'hullStrength',
  RepairSpeed = 'repairSpeed',
  ArmorEffectiveness = 'armorEffectiveness',
  ShieldEffectiveness = 'shieldEffectiveness',
  ShieldRechargeRate = 'shieldRechargeRate',
  // Ship
  AfterburnerSpeedIncrease = 'afterburnerSpeedIncrease',
  AfterburnerDuration = 'afterburnerDuration',
  AfterburnerCooldown = 'afterburnerCooldown',
  Teleport = 'teleport',
  TeleportRechargeSpeed = 'teleportRechargeSpeed',
  IronCapacity = 'ironCapacity',
  ConstructionSpeed = 'constructionSpeed',
  ArtificialIntelligence = 'artificialIntelligence',
  // Inventory
  InventorySlots = 'inventorySlots',
  // Bridge
  BridgeSlots = 'bridgeSlots',
  // Spies
  SpyChance = 'spyChance',
  SpySpeed = 'spySpeed',
  SpySabotageDamage = 'spySabotageDamage',
  Counterintelligence = 'counterintelligence',
  StealIron = 'stealIron',
}
