// ---
// NPC Combat: Handles creation of NPC users for battle and stat management.
// NPC users are created lazily on first attack and reused on respawn.
// ---

import { DatabaseConnection } from '../database';
import { User, SaveUserCallback } from '../user/user';
import { createInitialTechTree, TechTree } from '../techs/techtree';
import { TechCounts } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import type { NpcShip } from './npcTypes';
import { calculateNpcPosition } from './npcTypes';
import { NPCManager } from './NPCManager';

/**
 * Weapon types available for NPCs
 */
const NPC_WEAPON_TYPES: (keyof TechCounts)[] = [
  'pulse_laser',
  'auto_turret',
  'plasma_lance',
  'gauss_rifle',
  'photon_torpedo',
  'rocket_launcher',
];

/**
 * Calculate NPC stats based on level.
 * Defense: 100 * 5^(level-1) for hull, armor, and shield
 * Weapons: 10 * 5^(level-1) of one random weapon type
 */
export function calculateNpcStats(level: number): {
  defenseValue: number;
  weaponCount: number;
} {
  const scaleFactor = Math.pow(5, level - 1);
  return {
    defenseValue: 100 * scaleFactor,
    weaponCount: 10 * scaleFactor,
  };
}

/**
 * Calculate iron reward for defeating an NPC
 * Formula: 5000 * 5^(level-1)
 */
export function calculateNpcIronReward(level: number): number {
  return 5000 * Math.pow(5, level - 1);
}

/**
 * Generate NPC username from owner ID and NPC index
 */
export function getNpcUsername(ownerId: number, npcIndex: number): string {
  return `npc_${ownerId}_${npcIndex}`;
}

/**
 * Build TechCounts for an NPC at a given level
 * Assigns weaponCount of a random weapon type
 */
export function buildNpcTechCounts(level: number, weaponType?: keyof TechCounts): TechCounts {
  const { defenseValue, weaponCount } = calculateNpcStats(level);
  // Each defense unit provides 100 HP, so defenseValue/100 = count
  const defenseCount = defenseValue / 100;

  const selectedWeapon = weaponType ?? NPC_WEAPON_TYPES[Math.floor(Math.random() * NPC_WEAPON_TYPES.length)];

  const techCounts: TechCounts = {
    pulse_laser: 0,
    auto_turret: 0,
    plasma_lance: 0,
    gauss_rifle: 0,
    photon_torpedo: 0,
    rocket_launcher: 0,
    ship_hull: defenseCount,
    kinetic_armor: defenseCount,
    energy_shield: defenseCount,
    missile_jammer: 0,
  };

  // Assign weapons
  techCounts[selectedWeapon] = weaponCount;

  return techCounts;
}

/**
 * Build a TechTree for an NPC with all research set to the given level
 */
export function buildNpcTechTree(level: number): TechTree {
  const tree = createInitialTechTree();
  // Set all research to the NPC's level
  for (const key of Object.keys(tree) as (keyof TechTree)[]) {
    if (key === 'activeResearch') continue;
    if (typeof tree[key] === 'number') {
      (tree as unknown as Record<string, number>)[key as string] = level;
    }
  }
  return tree;
}

/**
 * Get or create the database user for an NPC.
 * On first attack, creates a real user row.
 * On subsequent attacks, returns the existing user from cache.
 */
export async function getOrCreateNpcUser(
  db: DatabaseConnection,
  npc: NpcShip,
  saveCallback: SaveUserCallback
): Promise<User> {
  const npcManager = NPCManager.getInstance();
  const existingUserId = npcManager.getNpcUserId(npc.id);

  if (existingUserId !== null) {
    // User already exists - look it up from DB
    const result = await db.query('SELECT * FROM users WHERE id = $1', [existingUserId]);
    if (result.rows.length > 0) {
      // Reset stats for battle (full HP)
      await resetNpcUserStats(db, existingUserId, npc.level);
      const updated = await db.query('SELECT * FROM users WHERE id = $1', [existingUserId]);
      if (updated.rows.length > 0) {
        return userFromNpcRow(updated.rows[0], saveCallback);
      }
    }
  }

  // Create new NPC user
  const username = getNpcUsername(npc.ownerId, npc.index);
  const passwordHash = `npc_no_login_${Date.now()}_${Math.random()}`;
  const techTree = buildNpcTechTree(npc.level);
  const techCounts = buildNpcTechCounts(npc.level);

  const { defenseValue } = calculateNpcStats(npc.level);

  // Create ship at NPC's current position
  const pos = calculateNpcPosition(npc.orbitAngleDeg);
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);

  const shipResult = await db.query(
    'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    ['player_ship', pos.x, pos.y, 0, 0, nowMs]
  );
  const shipId = shipResult.rows[0].id;

  // Create user with full defense
  const userResult = await db.query(
    `INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id,
      pulse_laser, auto_turret, plasma_lance, gauss_rifle, photon_torpedo, rocket_launcher,
      ship_hull, kinetic_armor, energy_shield, missile_jammer,
      hull_current, armor_current, shield_current, defense_last_regen,
      in_battle, build_queue, build_start_sec)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING id`,
    [
      username, passwordHash, 0, now, JSON.stringify(techTree), shipId,
      techCounts.pulse_laser, techCounts.auto_turret, techCounts.plasma_lance,
      techCounts.gauss_rifle, techCounts.photon_torpedo, techCounts.rocket_launcher,
      techCounts.ship_hull, techCounts.kinetic_armor, techCounts.energy_shield, techCounts.missile_jammer,
      defenseValue, defenseValue, defenseValue, now,
      1, JSON.stringify([]), null,
    ]
  );

  const userId = userResult.rows[0].id;
  npcManager.setNpcUserId(npc.id, userId);

  console.log(`🤖 Created NPC user: ${username} (ID: ${userId}, Level: ${npc.level})`);

  // Build User object
  const user = User.create(
    userId, username, passwordHash, 0, 0, now,
    techTree, saveCallback, techCounts,
    defenseValue, defenseValue, defenseValue, now,
    true, null, [], null, 0, 0, shipId
  );

  return user;
}

/**
 * Reset NPC user stats for a new battle (full defense, weapons refreshed)
 */
export async function resetNpcUserStats(
  db: DatabaseConnection,
  userId: number,
  level: number
): Promise<void> {
  const techCounts = buildNpcTechCounts(level);
  const techTree = buildNpcTechTree(level);
  const { defenseValue } = calculateNpcStats(level);
  const now = Math.floor(Date.now() / 1000);

  await db.query(
    `UPDATE users SET
      tech_tree = $1,
      pulse_laser = $2, auto_turret = $3, plasma_lance = $4,
      gauss_rifle = $5, photon_torpedo = $6, rocket_launcher = $7,
      ship_hull = $8, kinetic_armor = $9, energy_shield = $10, missile_jammer = $11,
      hull_current = $12, armor_current = $13, shield_current = $14,
      defense_last_regen = $15, in_battle = $16
    WHERE id = $17`,
    [
      JSON.stringify(techTree),
      techCounts.pulse_laser, techCounts.auto_turret, techCounts.plasma_lance,
      techCounts.gauss_rifle, techCounts.photon_torpedo, techCounts.rocket_launcher,
      techCounts.ship_hull, techCounts.kinetic_armor, techCounts.energy_shield, techCounts.missile_jammer,
      defenseValue, defenseValue, defenseValue,
      now, 1,
      userId,
    ]
  );
}

/**
 * Helper to create User from a raw DB row (simplified for NPC users)
 */
function userFromNpcRow(row: Record<string, unknown>, saveCallback: SaveUserCallback): User {
  let techTree: TechTree;
  try {
    techTree = row.tech_tree ? JSON.parse(row.tech_tree as string) : createInitialTechTree();
    const initialTree = createInitialTechTree();
    techTree = { ...initialTree, ...techTree };
  } catch {
    techTree = createInitialTechTree();
  }

  const techCounts: TechCounts = {
    pulse_laser: (row.pulse_laser as number) || 0,
    auto_turret: (row.auto_turret as number) || 0,
    plasma_lance: (row.plasma_lance as number) || 0,
    gauss_rifle: (row.gauss_rifle as number) || 0,
    photon_torpedo: (row.photon_torpedo as number) || 0,
    rocket_launcher: (row.rocket_launcher as number) || 0,
    ship_hull: (row.ship_hull as number) || 0,
    kinetic_armor: (row.kinetic_armor as number) || 0,
    energy_shield: (row.energy_shield as number) || 0,
    missile_jammer: (row.missile_jammer as number) || 0,
  };

  const maxStats = TechService.calculateMaxDefense(techCounts, techTree);

  return User.create(
    row.id as number,
    row.username as string,
    row.password_hash as string,
    (row.iron as number) || 0,
    (row.xp as number) || 0,
    (row.last_updated as number) || 0,
    techTree,
    saveCallback,
    techCounts,
    (row.hull_current as number) ?? maxStats.hull,
    (row.armor_current as number) ?? maxStats.armor,
    (row.shield_current as number) ?? maxStats.shield,
    (row.defense_last_regen as number) || 0,
    row.in_battle === 1,
    (row.current_battle_id as number) || null,
    [],
    null,
    0,
    0,
    row.ship_id as number | undefined
  );
}
