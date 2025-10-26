// ---
// Handles loading and saving User objects via in-memory cache with database persistence.
// ---

import sqlite3 from 'sqlite3';
import { User, SaveUserCallback } from './user';
import { createInitialTechTree } from './techtree';
import { getTypedCacheManager } from './typedCacheManager';
import { createEmptyContext } from './typedLocks';
import { sendMessageToUserCached } from './typedCacheManager';
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
  // Ship appearance
  ship_image_index: number;
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
  
  // Extract ship image index, with fallback to 1 for migration
  const shipImageIndex = row.ship_image_index !== undefined ? row.ship_image_index : 1;
  
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
    shipImageIndex,
    row.ship_id
  );
}

// Direct database access functions (used internally by cache manager)
export function getUserByIdFromDb(db: sqlite3.Database, id: number, saveCallback: SaveUserCallback): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(userFromRow(row as UserRow, saveCallback));
    });
  });
}

export function getUserByUsernameFromDb(db: sqlite3.Database, username: string, saveCallback: SaveUserCallback): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(userFromRow(row as UserRow, saveCallback));
    });
  });
}

// Cache-aware public functions
export async function getUserById(db: sqlite3.Database, id: number): Promise<User | null> {
  // Use typed cache manager for cache-aware access
  const cacheManager = getTypedCacheManager();
  await cacheManager.initialize();
  
  const emptyCtx = createEmptyContext();
  
  // Use user lock to ensure consistent access
  return await cacheManager.withUserLock(emptyCtx, async (userCtx) => {
    // Try to get from cache first
    let user = cacheManager.getUserUnsafe(id, userCtx);
    
    if (!user) {
      // Load from database if not in cache
      return await cacheManager.withDatabaseRead(userCtx, async (dbCtx) => {
        user = await cacheManager.loadUserFromDbUnsafe(id, dbCtx);
        if (user) {
          // Cache the loaded user
          cacheManager.setUserUnsafe(user, userCtx);
        }
        return user;
      });
    }
    
    return user;
  });
}

export async function getUserByUsername(db: sqlite3.Database, username: string): Promise<User | null> {
  // Use typed cache manager for cache-aware username lookup
  const cacheManager = getTypedCacheManager();
  await cacheManager.initialize();
  
  return await cacheManager.getUserByUsername(username);
}

export function createUser(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, true);
}

export function createUserWithoutShip(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return createUserWithShip(db, username, password_hash, saveCallback, false);
}

async function createUserWithShip(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback, createShip: boolean): Promise<User> {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const techTree = createInitialTechTree();
    
    if (createShip) {
      // Create user with ship (production behavior)
      const nowMs = Date.now();
      
      // First create a player ship
      db.run('INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms) VALUES (?, ?, ?, ?, ?, ?)', 
        ['player_ship', 250, 250, 0, 0, nowMs], // Start at center of 500x500 world
        function (shipErr) {
          if (shipErr) return reject(shipErr);
          
          const shipId = this.lastID;
          
          // Then create the user with the ship_id (with default defense values)
          db.run('INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id, hull_current, armor_current, shield_current, defense_last_regen, ship_image_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            [username, password_hash, 0.0, now, JSON.stringify(techTree), shipId, 250.0, 250.0, 250.0, now, 1], 
            async function (userErr) {
              if (userErr) return reject(userErr);
              
              const userId = this.lastID;
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
              const user = new User(userId, username, password_hash, 0.0, now, techTree, saveCallback, defaultTechCounts, 250.0, 250.0, 250.0, now, 1, shipId);
              
              // Send welcome message to new user
              await sendMessageToUserCached(userId, `Welcome to Spacewars, ${username}! Your journey among the stars begins now. Navigate wisely and collect resources to upgrade your ship.`);
              
              try {
                // Note: User creation doesn't need immediate caching since
                // the API endpoints will load and cache users as needed
                resolve(user);
              } catch (cacheErr) {
                console.error('Note: User created successfully but caching skipped:', cacheErr);
                // Still resolve with user since creation succeeded
                resolve(user);
              }
            }
          );
        }
      );
    } else {
      // Create user without ship (for testing, with default defense values)
      db.run('INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, hull_current, armor_current, shield_current, defense_last_regen, ship_image_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [username, password_hash, 0.0, now, JSON.stringify(techTree), 250.0, 250.0, 250.0, now, 1], 
        async function (err) {
          if (err) return reject(err);
          const id = this.lastID;
          
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
          const user = new User(id, username, password_hash, 0.0, now, techTree, saveCallback, defaultTechCounts, 250.0, 250.0, 250.0, now, 1);
          
          try {
            // Note: User creation doesn't need immediate caching since
            // the API endpoints will load and cache users as needed
            resolve(user);
          } catch (cacheErr) {
            console.error('Note: User created successfully but caching skipped:', cacheErr);
            // Still resolve with user since creation succeeded
            resolve(user);
          }
        }
      );
    }
  });
}

export function saveUserToDb(db: sqlite3.Database): SaveUserCallback {
  return async (user: User) => {
    return new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE users SET 
          iron = ?, 
          last_updated = ?, 
          tech_tree = ?, 
          ship_id = ?,
          pulse_laser = ?,
          auto_turret = ?,
          plasma_lance = ?,
          gauss_rifle = ?,
          photon_torpedo = ?,
          rocket_launcher = ?,
          ship_hull = ?,
          kinetic_armor = ?,
          energy_shield = ?,
          missile_jammer = ?,
          hull_current = ?,
          armor_current = ?,
          shield_current = ?,
          defense_last_regen = ?
        WHERE id = ?`,
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
          user.id
        ],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  };
}

// Add 'export' at the top to make this file a module
export {};
