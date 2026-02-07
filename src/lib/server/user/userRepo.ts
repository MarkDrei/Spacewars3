// ---
// Handles loading and saving User objects via in-memory cache with database persistence.
// ---

import { DatabaseConnection } from '../database';
import { User, SaveUserCallback } from './user';
import { createInitialTechTree } from '../techs/techtree';
import { sendMessageToUser } from '../messages/MessageCache';
import { TechCounts, BuildQueueItem } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { DEFAULT_SHIP_START_X, DEFAULT_SHIP_START_Y, DEFAULT_SHIP_START_SPEED, DEFAULT_SHIP_START_ANGLE } from '../constants';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  iron: number;
  xp: number;
  last_updated: number;
  tech_tree: string;
  ship_id?: number;
  // Tech counts (weapons)
  pulse_laser: number;
  auto_turret: number;
  plasma_lance: number;
  gauss_rifle: number;
  photon_torpedo: number;
  rocket_launcher: number;
  // Tech counts (defense)
  ship_hull: number;
  kinetic_armor: number;
  energy_shield: number;
  missile_jammer: number;
  // Defense current values
  hull_current: number;
  armor_current: number;
  shield_current: number;
  defense_last_regen: number;
  // Battle state
  in_battle?: number; // PostgreSQL stores boolean as 0/1 for compatibility
  current_battle_id?: number | null;
  // Build queue
  build_queue?: string;
  build_start_sec?: number | null;
}

function userFromRow(row: UserRow, saveCallback: SaveUserCallback): User {
  // Parse techTree from JSON, fallback to initial if missing or invalid
  let techTree;
  try {
    const parsedTree = row.tech_tree ? JSON.parse(row.tech_tree) : createInitialTechTree();
    // Merge with initial tree to ensure all new fields have default values
    const initialTree = createInitialTechTree();
    techTree = { ...initialTree, ...parsedTree };
  } catch {
    techTree = createInitialTechTree();
  }

  // Extract tech counts from row
  const techCounts: TechCounts = {
    pulse_laser: row.pulse_laser || 0,
    auto_turret: row.auto_turret || 0,
    plasma_lance: row.plasma_lance || 0,
    gauss_rifle: row.gauss_rifle || 0,
    photon_torpedo: row.photon_torpedo || 0,
    rocket_launcher: row.rocket_launcher || 0,
    ship_hull: row.ship_hull || 0,
    kinetic_armor: row.kinetic_armor || 0,
    energy_shield: row.energy_shield || 0,
    missile_jammer: row.missile_jammer || 0
  };

  // Extract defense current values, with fallback to max/2 for migration
  // Extract defense current values, with fallback to max/2 for migration
  const maxStats = TechService.calculateMaxDefense(techCounts, techTree);
  const hullCurrent = row.hull_current !== undefined ? row.hull_current : maxStats.hull / 2;
  const armorCurrent = row.armor_current !== undefined ? row.armor_current : maxStats.armor / 2;
  const shieldCurrent = row.shield_current !== undefined ? row.shield_current : maxStats.shield / 2;
  const defenseLastRegen = row.defense_last_regen || row.last_updated;

  // Extract battle state, with fallback for migration
  const inBattle = row.in_battle ? row.in_battle === 1 : false;
  const currentBattleId = row.current_battle_id || null;

  // Extract build queue
  let buildQueue: BuildQueueItem[] = [];
  try {
    if (row.build_queue) {
      buildQueue = JSON.parse(row.build_queue);
    }
  } catch {
    buildQueue = [];
  }
  const buildStartSec = row.build_start_sec || null;

  // Extract XP with fallback to 0 for migration compatibility
  const xp = row.xp || 0;

  return new User(
    row.id,
    row.username,
    row.password_hash,
    row.iron,
    xp,
    row.last_updated,
    techTree,
    saveCallback,
    techCounts,
    hullCurrent,
    armorCurrent,
    shieldCurrent,
    defenseLastRegen,
    inBattle,
    currentBattleId,
    buildQueue,
    buildStartSec,
    row.ship_id
  );
}

// Direct database access functions (used internally by cache manager)
export async function getUserByIdFromDb(db: DatabaseConnection, id: number, saveCallback: SaveUserCallback): Promise<User | null> {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return userFromRow(result.rows[0] as UserRow, saveCallback);
}

export async function getUserByUsernameFromDb(db: DatabaseConnection, username: string, saveCallback: SaveUserCallback): Promise<User | null> {
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) return null;
  return userFromRow(result.rows[0] as UserRow, saveCallback);
}

export function createUser(db: DatabaseConnection, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, true);
}

export function createUserWithoutShip(db: DatabaseConnection, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, false);
}

async function createUserWithShip(db: DatabaseConnection, username: string, password_hash: string, saveCallback: SaveUserCallback, createShip: boolean): Promise<User> {
  const now = Math.floor(Date.now() / 1000);
  const techTree = createInitialTechTree();

  if (createShip) {
    // Create user with ship (production behavior)
    const nowMs = Date.now();

    // First create a player ship
    const shipResult = await db.query(
      'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['player_ship', DEFAULT_SHIP_START_X, DEFAULT_SHIP_START_Y, DEFAULT_SHIP_START_SPEED, DEFAULT_SHIP_START_ANGLE, nowMs]
    );

    const shipId = shipResult.rows[0].id;

    // Then create the user with the ship_id (with default defense values)
    const userResult = await db.query(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id, hull_current, armor_current, shield_current, defense_last_regen, build_queue, build_start_sec) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
      [username, password_hash, 0.0, now, JSON.stringify(techTree), shipId, 250.0, 250.0, 250.0, now, JSON.stringify([]), null]
    );

    const userId = userResult.rows[0].id;
    console.log(`✅ Created user ${username} (ID: ${userId}) with ship ID ${shipId}`);

    // Create the user object with default tech counts
    const defaultTechCounts: TechCounts = {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0
    };

    // Calculate initial defense values based on default tech counts
    const initialMaxStats = TechService.calculateMaxDefense(defaultTechCounts, techTree);

    const user = new User(userId, username, password_hash, 0.0, 0, now, techTree, saveCallback, defaultTechCounts, initialMaxStats.hull, initialMaxStats.armor, initialMaxStats.shield, now, false, null, [], null, shipId);

    // Send welcome message to new user
    const ctx = createLockContext();
    await sendMessageToUser(ctx, userId, `Welcome to Spacewars, ${username}! Your journey among the stars begins now. Navigate wisely and collect resources to upgrade your ship.`);

    return user;
  } else {
    // Create user without ship (for testing, with default defense values)
    const userResult = await db.query(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, hull_current, armor_current, shield_current, defense_last_regen, build_queue, build_start_sec) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
      [username, password_hash, 0.0, now, JSON.stringify(techTree), 250.0, 250.0, 250.0, now, JSON.stringify([]), null]
    );

    const id = userResult.rows[0].id;

    // Create the user object with default tech counts and defense values
    const defaultTechCounts: TechCounts = {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0
    };

    // Calculate initial defense values based on default tech counts
    const initialMaxStats = TechService.calculateMaxDefense(defaultTechCounts, techTree);

    const user = new User(id, username, password_hash, 0.0, 0, now, techTree, saveCallback, defaultTechCounts, initialMaxStats.hull, initialMaxStats.armor, initialMaxStats.shield, now, false, null, [], null);

    return user;
  }
}

export function saveUserToDb(db: DatabaseConnection): SaveUserCallback {
  return async (user: User) => {
    await db.query(
      `UPDATE users SET 
        iron = $1, 
        xp = $2,
        last_updated = $3, 
        tech_tree = $4, 
        ship_id = $5,
        pulse_laser = $6,
        auto_turret = $7,
        plasma_lance = $8,
        gauss_rifle = $9,
        photon_torpedo = $10,
        rocket_launcher = $11,
        ship_hull = $12,
        kinetic_armor = $13,
        energy_shield = $14,
        missile_jammer = $15,
        hull_current = $16,
        armor_current = $17,
        shield_current = $18,
        defense_last_regen = $19,
        in_battle = $20,
        current_battle_id = $21,
        build_queue = $22,
        build_start_sec = $23
      WHERE id = $24`,
      [
        user.iron,
        user.xp,
        user.last_updated,
        JSON.stringify(user.techTree),
        user.ship_id,
        user.techCounts.pulse_laser,
        user.techCounts.auto_turret,
        user.techCounts.plasma_lance,
        user.techCounts.gauss_rifle,
        user.techCounts.photon_torpedo,
        user.techCounts.rocket_launcher,
        user.techCounts.ship_hull,
        user.techCounts.kinetic_armor,
        user.techCounts.energy_shield,
        user.techCounts.missile_jammer,
        user.hullCurrent,
        user.armorCurrent,
        user.shieldCurrent,
        user.defenseLastRegen,
        user.inBattle ? 1 : 0,
        user.currentBattleId,
        JSON.stringify(user.buildQueue),
        user.buildStartSec,
        user.id
      ]
    );
  };
}

// Add 'export' at the top to make this file a module
export { };
