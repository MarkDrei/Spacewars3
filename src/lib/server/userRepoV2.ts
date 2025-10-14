// ---
// Handles loading and saving User objects via in-memory cache with database persistence.
// Phase 4: Migrated to IronGuard V2
// ---

import sqlite3 from 'sqlite3';
import { User, SaveUserCallback } from './user';
import { createInitialTechTree } from './techtree';
import { getTypedCacheManagerV2 } from './typedCacheManagerV2';
import { createLockContext, type LockLevel } from './ironGuardV2';
import type { ValidUserLockContext } from './ironGuardTypesV2';
import { withUserLock } from './lockHelpers';
import { TechCounts } from './TechFactory';

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
  in_battle?: number; // SQLite stores boolean as 0/1
  current_battle_id?: number | null;
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
  const hullCurrent = row.hull_current !== undefined ? row.hull_current : (techCounts.ship_hull * 100) / 2;
  const armorCurrent = row.armor_current !== undefined ? row.armor_current : (techCounts.kinetic_armor * 100) / 2;
  const shieldCurrent = row.shield_current !== undefined ? row.shield_current : (techCounts.energy_shield * 100) / 2;
  const defenseLastRegen = row.defense_last_regen || row.last_updated;
  
  // Extract battle state, with fallback for migration
  const inBattle = row.in_battle ? row.in_battle === 1 : false;
  const currentBattleId = row.current_battle_id || null;
  
  return new User(
    row.id,
    row.username,
    row.password_hash,
    row.iron,
    row.last_updated,
    techTree,
    saveCallback,
    row.ship_id,
    techCounts,
    hullCurrent,
    armorCurrent,
    shieldCurrent,
    defenseLastRegen,
    inBattle,
    currentBattleId
  );
}

/**
 * Load user by ID from database (internal function used by cache manager)
 * This function is NOT migrated as it's called internally
 */
export function getUserByIdFromDb(db: sqlite3.Database, id: number, saveCallback: SaveUserCallback): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(userFromRow(row as UserRow, saveCallback));
    });
  });
}

/**
 * Load user by username from database (internal function used by cache manager)
 * This function is NOT migrated as it's called internally
 */
export function getUserByUsernameFromDb(db: sqlite3.Database, username: string, saveCallback: SaveUserCallback): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(userFromRow(row as UserRow, saveCallback));
    });
  });
}

/**
 * Get user by ID (cached)
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 * Creates own context and acquires necessary locks
 */
export async function getUserById(id: number): Promise<User | null> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // Use cache manager's loadUserIfNeeded which handles locks internally
  return await cacheManager.loadUserIfNeeded(id);
}

/**
 * Get user by username (cached)
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 * Creates own context and acquires necessary locks
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // Use cache manager's getUserByUsername which handles locks internally
  return await cacheManager.getUserByUsername(username);
}

/**
 * Get user with an existing lock context
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 * Accepts context that already has appropriate locks
 */
export async function getUserWithContext<THeld extends readonly LockLevel[]>(
  userId: number,
  context: ValidUserLockContext<THeld>
): Promise<User | null> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  // If context already has USER lock, use it directly
  // Type assertion: ValidUserLockContext ensures this is safe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cacheManager.getUserUnsafe(userId, context as any);
}

/**
 * Update user in cache
 * 
 * MIGRATED: Uses IronGuard V2 lock system
 */
export async function updateUser(user: User): Promise<void> {
  const cacheManager = getTypedCacheManagerV2();
  await cacheManager.initialize();
  
  const ctx = createLockContext();
  
  return withUserLock(ctx, async (userCtx) => {
    cacheManager.updateUserUnsafe(user, userCtx);
  });
}

/**
 * Create user (public API)
 * 
 * This is a wrapper that maintains the old signature
 * The actual creation logic is in createUserWithShip
 */
export function createUser(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, true);
}

/**
 * Create user without ship (public API)
 */
export function createUserWithoutShip(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, false);
}

/**
 * Internal function to create user with or without ship
 * NOT MIGRATED: This is a database-level function that doesn't need lock migration
 */
async function createUserWithShip(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback, createShip: boolean): Promise<User> {
  const initialTechTree = createInitialTechTree();
  const techTreeJson = JSON.stringify(initialTechTree);
  const now = Date.now();
  
  // Default tech counts for new users
  const defaultTechCounts = {
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

  return new Promise((resolve, reject) => {
    // First, create the user in database
    db.run(
      `INSERT INTO users (
        username, password_hash, iron, last_updated, tech_tree,
        pulse_laser, auto_turret, plasma_lance, gauss_rifle, photon_torpedo, rocket_launcher,
        ship_hull, kinetic_armor, energy_shield, missile_jammer,
        hull_current, armor_current, shield_current, defense_last_regen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        password_hash,
        0, // iron
        now,
        techTreeJson,
        defaultTechCounts.pulse_laser,
        defaultTechCounts.auto_turret,
        defaultTechCounts.plasma_lance,
        defaultTechCounts.gauss_rifle,
        defaultTechCounts.photon_torpedo,
        defaultTechCounts.rocket_launcher,
        defaultTechCounts.ship_hull,
        defaultTechCounts.kinetic_armor,
        defaultTechCounts.energy_shield,
        defaultTechCounts.missile_jammer,
        defaultTechCounts.ship_hull * 100 / 2, // hull_current
        defaultTechCounts.kinetic_armor * 100 / 2, // armor_current
        defaultTechCounts.energy_shield * 100 / 2, // shield_current
        now // defense_last_regen
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }

        const userId = this.lastID;

        if (!createShip) {
          // Create user object without ship
          const user = new User(
            userId,
            username,
            password_hash,
            0,
            now,
            initialTechTree,
            saveCallback,
            undefined,
            defaultTechCounts,
            defaultTechCounts.ship_hull * 100 / 2,
            defaultTechCounts.kinetic_armor * 100 / 2,
            defaultTechCounts.energy_shield * 100 / 2,
            now,
            false,
            null
          );
          resolve(user);
          return;
        }

        // Create ship in space_objects table
        const shipX = Math.random() * 500;
        const shipY = Math.random() * 500;
        const shipAngle = Math.random() * 360;

        db.run(
          'INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES (?, ?, ?, ?, ?, ?)',
          ['player_ship', shipX, shipY, 0, shipAngle, now],
          function (shipErr) {
            if (shipErr) {
              reject(shipErr);
              return;
            }

            const shipId = this.lastID;

            // Update user with ship_id
            db.run(
              'UPDATE users SET ship_id = ? WHERE id = ?',
              [shipId, userId],
              (updateErr) => {
                if (updateErr) {
                  reject(updateErr);
                  return;
                }

                // Create user object with ship
                const user = new User(
                  userId,
                  username,
                  password_hash,
                  0,
                  now,
                  initialTechTree,
                  saveCallback,
                  shipId,
                  defaultTechCounts,
                  defaultTechCounts.ship_hull * 100 / 2,
                  defaultTechCounts.kinetic_armor * 100 / 2,
                  defaultTechCounts.energy_shield * 100 / 2,
                  now,
                  false,
                  null
                );

                console.log(`✅ Created user ${username} (ID: ${userId}) with ship ID ${shipId}`);
                resolve(user);
              }
            );
          }
        );
      }
    );
  });
}
