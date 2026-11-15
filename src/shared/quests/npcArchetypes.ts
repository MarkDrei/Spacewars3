// ---
// NPC ship archetypes: hostile ships (per player, attackable) and friendly contacts (global).
// Shared by server (NPCManager, quest rules) and client (labels, quest log).
// ---

import type { LocationId } from './locations';
import { getLocation } from './locations';

// ---------------------------------------------------------------------------
// Hostile ships
// ---------------------------------------------------------------------------

export type HostileArchetypeId = 'pirate' | 'marauder' | 'drone' | 'warlord';

export interface OrbitDefinition {
  centerX: number;
  centerY: number;
  radius: number;
}

export interface HostileSpawn {
  /** ID slot (0–9), part of the NPC user id. Spawns that share a slot must have distinct levels. */
  slot: number;
  /** NPC level = max(1, player level + levelOffset) */
  levelOffset: number;
  startAngleDeg: number;
  /** Ship picture (npc<N>.png) */
  pictureId: number;
  /** Number of different weapon types the ship carries */
  weaponTypes: number;
}

export interface HostileArchetype {
  id: HostileArchetypeId;
  /** English name, used as user name of the NPC (battle log, battle status). */
  displayName: string;
  /**
   * Aggressive ships attack a player who comes within `aggroRadius`, but only while the current
   * step of an active mission of that player targets their kind (`getWantedArchetypes`).
   */
  aggressive: boolean;
  aggroRadius: number;
  home: LocationId;
  orbitRadius: number;
  /** Degrees per second before the time multiplier; negative = clockwise. */
  angularVelocityDegPerSec: number;
  /** Multiplier on weapon and defense counts. */
  strength: number;
  /** Iron for defeating the ship = ironPerLevel × NPC level. */
  ironPerLevel: number;
  /** Minutes until a defeated ship returns; null = at the next midnight (UTC). */
  respawnMinutes: number | null;
  /** Quest-bound ships exist only while an active quest stage asks to defeat them. */
  questBound: boolean;
  spawns: readonly HostileSpawn[];
}

export const HOSTILE_ARCHETYPES: Readonly<Record<HostileArchetypeId, HostileArchetype>> = {
  pirate: {
    id: 'pirate',
    displayName: 'Iron Horde Pirate',
    aggressive: false,
    aggroRadius: 0,
    home: 'ironstrike_station',
    orbitRadius: 750,
    angularVelocityDegPerSec: 2.5,
    strength: 1,
    ironPerLevel: 5000,
    respawnMinutes: null,
    questBound: false,
    spawns: [
      { slot: 0, levelOffset: 0, startAngleDeg: 0, pictureId: 1, weaponTypes: 1 },
      { slot: 0, levelOffset: 1, startAngleDeg: 90, pictureId: 2, weaponTypes: 2 },
      { slot: 0, levelOffset: 2, startAngleDeg: 180, pictureId: 3, weaponTypes: 3 },
      { slot: 0, levelOffset: 3, startAngleDeg: 270, pictureId: 4, weaponTypes: 4 },
    ],
  },
  marauder: {
    id: 'marauder',
    displayName: 'Iron Horde Marauder',
    aggressive: true,
    aggroRadius: 300,
    home: 'hordes_reach',
    orbitRadius: 450,
    angularVelocityDegPerSec: -1.5,
    strength: 1,
    ironPerLevel: 6000,
    respawnMinutes: 20,
    questBound: false,
    spawns: [
      { slot: 1, levelOffset: -1, startAngleDeg: 30, pictureId: 3, weaponTypes: 2 },
      { slot: 2, levelOffset: 0, startAngleDeg: 150, pictureId: 3, weaponTypes: 2 },
      { slot: 3, levelOffset: 1, startAngleDeg: 270, pictureId: 4, weaponTypes: 3 },
    ],
  },
  drone: {
    id: 'drone',
    displayName: 'Rogue Sentry Drone',
    aggressive: true,
    aggroRadius: 220,
    home: 'anvil_graveyard',
    orbitRadius: 380,
    angularVelocityDegPerSec: 3.5,
    strength: 0.7,
    ironPerLevel: 3000,
    respawnMinutes: 15,
    questBound: false,
    spawns: [
      { slot: 4, levelOffset: -1, startAngleDeg: 60, pictureId: 1, weaponTypes: 1 },
      { slot: 5, levelOffset: 0, startAngleDeg: 240, pictureId: 1, weaponTypes: 1 },
    ],
  },
  warlord: {
    id: 'warlord',
    displayName: 'Warlord Krag',
    aggressive: false,
    aggroRadius: 0,
    home: 'hordes_reach',
    orbitRadius: 150,
    angularVelocityDegPerSec: 1,
    strength: 1.5,
    ironPerLevel: 10000,
    respawnMinutes: 10,
    questBound: true,
    spawns: [{ slot: 6, levelOffset: 2, startAngleDeg: 0, pictureId: 4, weaponTypes: 5 }],
  },
};

/** Time without ambushes after a battle against an NPC ship, so the player can get away from a lair. */
export const AMBUSH_GRACE_MS = 90_000;

export const HOSTILE_ARCHETYPE_IDS = Object.keys(HOSTILE_ARCHETYPES) as HostileArchetypeId[];

export function hostileOrbit(archetype: HostileArchetype): OrbitDefinition {
  const home = getLocation(archetype.home);
  return { centerX: home.x, centerY: home.y, radius: archetype.orbitRadius };
}

/** Level of a spawned hostile ship for a player of the given level. */
export function hostileLevel(playerLevel: number, spawn: HostileSpawn): number {
  return Math.max(1, playerLevel + spawn.levelOffset);
}

export function hostileDisplayName(archetypeId: HostileArchetypeId, level: number): string {
  return `${HOSTILE_ARCHETYPES[archetypeId].displayName} Lv.${level}`;
}

// ---------------------------------------------------------------------------
// Friendly contacts (mission givers)
// ---------------------------------------------------------------------------

export type ContactId = 'vess' | 'quill' | 'halden' | 'tam';

export interface ContactDefinition {
  id: ContactId;
  /** Space object id of the contact's ship (above the starbase ids). */
  objectId: number;
  /** English name of the ship, shown on the map. */
  shipName: string;
  home: LocationId;
  orbitRadius: number;
  angularVelocityDegPerSec: number;
  startAngleDeg: number;
  pictureId: number;
}

export const CONTACT_ID_OFFSET = 2_100_000_000;

/** A contact can be hailed (accept / report missions) within this distance. */
export const HAIL_RANGE = 500;

export const CONTACTS: readonly ContactDefinition[] = [
  {
    id: 'vess',
    objectId: CONTACT_ID_OFFSET + 1,
    shipName: 'ISV Ledger',
    home: 'ironstrike_station',
    orbitRadius: 320,
    angularVelocityDegPerSec: 0.8,
    startAngleDeg: 0,
    pictureId: 2,
  },
  {
    id: 'quill',
    objectId: CONTACT_ID_OFFSET + 2,
    shipName: 'RV Meridian Lantern',
    home: 'meridian_observatory',
    orbitRadius: 300,
    angularVelocityDegPerSec: -0.6,
    startAngleDeg: 120,
    pictureId: 1,
  },
  {
    id: 'halden',
    objectId: CONTACT_ID_OFFSET + 3,
    shipName: 'PC Bastion Vigil',
    home: 'bastion_outpost',
    orbitRadius: 340,
    angularVelocityDegPerSec: 1,
    startAngleDeg: 240,
    pictureId: 2,
  },
  {
    id: 'tam',
    objectId: CONTACT_ID_OFFSET + 4,
    shipName: 'Rustbucket',
    home: 'drifters_rock',
    orbitRadius: 150,
    angularVelocityDegPerSec: -0.4,
    startAngleDeg: 300,
    pictureId: 1,
  },
];

export function getContact(id: ContactId): ContactDefinition {
  const contact = CONTACTS.find((c) => c.id === id);
  if (!contact) throw new Error(`Unknown contact: ${id}`);
  return contact;
}

export function isContactId(value: unknown): value is ContactId {
  return typeof value === 'string' && CONTACTS.some((c) => c.id === value);
}

export function contactOrbit(contact: ContactDefinition): OrbitDefinition {
  const home = getLocation(contact.home);
  return { centerX: home.x, centerY: home.y, radius: contact.orbitRadius };
}

/**
 * Orbit angle of a contact ship. Contacts are the same for all players and are not stored:
 * the angle is a function of the wall clock.
 */
export function contactAngleDeg(contact: ContactDefinition, nowMs: number, timeMultiplier: number): number {
  const angle = contact.startAngleDeg + contact.angularVelocityDegPerSec * timeMultiplier * (nowMs / 1000);
  return ((angle % 360) + 360) % 360;
}

export function positionOnOrbit(orbit: OrbitDefinition, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: orbit.centerX + orbit.radius * Math.cos(rad),
    y: orbit.centerY + orbit.radius * Math.sin(rad),
  };
}

export function contactPosition(
  contact: ContactDefinition,
  nowMs: number,
  timeMultiplier: number
): { x: number; y: number } {
  return positionOnOrbit(contactOrbit(contact), contactAngleDeg(contact, nowMs, timeMultiplier));
}
