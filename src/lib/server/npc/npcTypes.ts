import type { HostileArchetypeId, HostileSpawn } from '@/shared/quests/npcArchetypes';

/**
 * Hostile NPC ship — in-memory representation of an NPC orbiting its home location.
 * Not persisted to the database; regenerated on server restart.
 */
export interface NpcShip {
  /** Same as NPC user ID, see `npcUserId` */
  id: number;
  /** Player who sees this NPC */
  ownerId: number;
  /** Kind of ship: name, behaviour, home, strength, rewards */
  archetype: HostileArchetypeId;
  /** Spawn definition: ID slot, start angle, picture, number of weapon types */
  spawn: HostileSpawn;
  /** NPC combat level */
  level: number;
  /** Current orbit angle in degrees */
  orbitAngleDeg: number;
  /** Whether this NPC has been defeated (hidden from world) */
  defeated: boolean;
  /** Timestamp (ms) when defeated, or null if active */
  defeatTime: number | null;
  /** Whether a DB user row has been created for this NPC */
  npcUserCreated: boolean;
  /** Whether this NPC is currently in a battle */
  inBattle: boolean;
  /** Last position-update timestamp in milliseconds */
  lastUpdateMs: number;
}
