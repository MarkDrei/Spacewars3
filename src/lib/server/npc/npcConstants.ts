/**
 * Constants and utility functions for the NPC ID scheme.
 *
 * ID layout:
 *   Regular space objects / users: 1 … 999 999
 *   NPC user IDs:                  1 000 000 … 1 999 999 999
 *   Starbase IDs:                  2 000 000 000+
 *   Contact ship IDs:              2 100 000 000+ (see CONTACT_ID_OFFSET)
 *
 * NPC user ID = NPC_USER_ID_OFFSET + ownerId × 1000 + slot × 100 + level
 *   slot 0   = Iron Horde Pirates (several levels share the slot)
 *   slot 1–9 = one spawn each (see HOSTILE_ARCHETYPES)
 */

/** Base offset for NPC user IDs */
export const NPC_USER_ID_OFFSET = 1_000_000;

/** Number of NPC IDs reserved per player */
export const NPC_IDS_PER_USER = 1_000;

/** Number of NPC IDs (levels) per slot */
export const NPC_IDS_PER_SLOT = 100;

/** Highest NPC level that fits into a slot */
export const NPC_MAX_LEVEL = NPC_IDS_PER_SLOT - 1;

/**
 * Compute the deterministic NPC user ID from owner, NPC level and spawn slot.
 * Using level (not an index) means the same NPC level always maps to the
 * same user-ID row, so battle history names stay correct after level-ups.
 */
export function npcUserId(ownerId: number, level: number, slot: number = 0): number {
  return NPC_USER_ID_OFFSET + ownerId * NPC_IDS_PER_USER + slot * NPC_IDS_PER_SLOT + level;
}

/** Return true when `id` falls within the NPC user-ID range. */
export function isNpcId(id: number): boolean {
  return id >= NPC_USER_ID_OFFSET && id < 2_000_000_000;
}

/** Decompose an NPC user ID into ownerId, slot and npcLevel, or null if not an NPC ID. */
export function parseNpcId(id: number): { ownerId: number; slot: number; npcLevel: number } | null {
  if (!isNpcId(id)) return null;
  const offset = id - NPC_USER_ID_OFFSET;
  const ownerId = Math.floor(offset / NPC_IDS_PER_USER);
  const withinOwner = offset % NPC_IDS_PER_USER;
  return {
    ownerId,
    slot: Math.floor(withinOwner / NPC_IDS_PER_SLOT),
    npcLevel: withinOwner % NPC_IDS_PER_SLOT,
  };
}
