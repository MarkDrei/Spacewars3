// ---
// Handles loading and saving User objects via in-memory cache with database persistence.
// ---

import { Pool } from 'pg';
import { User, SaveUserCallback } from './user';
import { createInitialTechTree } from '../techs/techtree';
import { getMessageCache } from '../messages/MessageCache';
import { TechCounts, BuildQueueItem } from '../techs/TechFactory';
import { TechService } from '../techs/TechService';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  iron: number;
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
  in_battle?: boolean; // PostgreSQL stores as proper boolean
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
  const inBattle = row.in_battle ? row.in_battle : false;
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

  return new User(
    row.id,
    row.username,
    row.password_hash,
    row.iron,
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
export async function getUserByIdFromDb(db: Pool, id: number, saveCallback: SaveUserCallback): Promise<User | null> {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  return userFromRow(row as UserRow, saveCallback);
}

export async function getUserByUsernameFromDb(db: Pool, username: string, saveCallback: SaveUserCallback): Promise<User | null> {
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const row = result.rows[0];
  if (!row) return null;
  return userFromRow(row as UserRow, saveCallback);
}

export function createUser(db: Pool, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, true);
}

export function createUserWithoutShip(db: Pool, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, false);
}

async function createUserWithShip(db: Pool, username: string, password_hash: string, saveCallback: SaveUserCallback, createShip: boolean): Promise<User> {
  const now = Math.floor(Date.now() / 1000);
  const techTree = createInitialTechTree();

  if (createShip) {
    // Create user with ship (production behavior)
    const nowMs = Date.now();

    // First create a player ship
    const shipResult = await db.query(
      'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      ['player_ship', 250, 250, 0, 0, nowMs]
    );
    const shipId = shipResult.rows[0].id;

    // Then create the user with the ship_id (with default defense values)
    const userResult = await db.query(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id, hull_current, armor_current, shield_current, defense_last_regen) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [username, password_hash, 0.0, now, JSON.stringify(techTree), shipId, 250.0, 250.0, 250.0, now]
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

    const user = new User(userId, username, password_hash, 0.0, now, techTree, saveCallback, defaultTechCounts, initialMaxStats.hull, initialMaxStats.armor, initialMaxStats.shield, now, false, null, [], null, shipId);

    // Send welcome message to new user
    await getMessageCache().createMessage(userId, `Welcome to Spacewars, ${username}! Your journey among the stars begins now. Navigate wisely and collect resources to upgrade your ship.`);

    try {
      // Note: User creation doesn't need immediate caching since
      // the API endpoints will load and cache users as needed
      return user;
    } catch (cacheErr) {
      console.error('Note: User created successfully but caching skipped:', cacheErr);
      // Still return user since creation succeeded
      return user;
    }
  } else {
    // Create user without ship (for testing, with default defense values)
    const userResult = await db.query(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, hull_current, armor_current, shield_current, defense_last_regen) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [username, password_hash, 0.0, now, JSON.stringify(techTree), 250.0, 250.0, 250.0, now]
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

    const user = new User(id, username, password_hash, 0.0, now, techTree, saveCallback, defaultTechCounts, initialMaxStats.hull, initialMaxStats.armor, initialMaxStats.shield, now, false, null, [], null);

    try {
      // Note: User creation doesn't need immediate caching since
      // the API endpoints will load and cache users as needed
      return user;
    } catch (cacheErr) {
      console.error('Note: User created successfully but caching skipped:', cacheErr);
      // Still return user since creation succeeded
      return user;
    }
  }
}

export function saveUserToDb(db: Pool): SaveUserCallback {
  return async (user: User) => {
    await db.query(
      `UPDATE users SET 
        iron = $1, 
        last_updated = $2, 
        tech_tree = $3, 
        ship_id = $4,
        pulse_laser = $5,
        auto_turret = $6,
        plasma_lance = $7,
        gauss_rifle = $8,
        photon_torpedo = $9,
        rocket_launcher = $10,
        ship_hull = $11,
        kinetic_armor = $12,
        energy_shield = $13,
        missile_jammer = $14,
        hull_current = $15,
        armor_current = $16,
        shield_current = $17,
        defense_last_regen = $18,
        in_battle = $19,
        current_battle_id = $20,
        build_queue = $21,
        build_start_sec = $22
      WHERE id = $23`,
      [
        user.iron,
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
