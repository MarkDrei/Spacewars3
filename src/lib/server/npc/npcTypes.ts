/**
 * NPC ship type — in-memory representation of an NPC orbiting a starbase.
 * Not persisted to the database; regenerated on server restart.
 */
export interface NpcShip {
  /** Same as NPC user ID: NPC_USER_ID_OFFSET + ownerId * NPC_IDS_PER_USER + level */
  id: number;
  /** Player who sees this NPC */
  ownerId: number;
  /** Index within the player's NPC set (0–3) */
  npcIndex: number;
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
