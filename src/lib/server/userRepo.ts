// ---
// Handles loading and saving User objects via in-memory cache with database persistence.
// ---

import sqlite3 from 'sqlite3';
import { User, SaveUserCallback } from './user';
import { createInitialTechTree } from './techtree';
import { getTypedCacheManager } from './typedCacheManager';
import { createEmptyContext } from './typedLocks';
import { sendMessageToUser } from './messagesRepo';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  iron: number;
  last_updated: number;
  tech_tree: string;
  ship_id?: number;
}

function userFromRow(row: UserRow, saveCallback: SaveUserCallback): User {
  // Parse techTree from JSON, fallback to initial if missing or invalid
  let techTree;
  try {
    techTree = row.tech_tree ? JSON.parse(row.tech_tree) : createInitialTechTree();
  } catch {
    techTree = createInitialTechTree();
  }
  return new User(
    row.id,
    row.username,
    row.password_hash,
    row.iron,
    row.last_updated,
    techTree,
    saveCallback,
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
export async function getUserById(db: sqlite3.Database, id: number, _saveCallback: SaveUserCallback): Promise<User | null> {
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

export async function getUserByUsername(db: sqlite3.Database, username: string, saveCallback: SaveUserCallback): Promise<User | null> {
  // Note: Username lookup still requires database access since we don't cache by username
  // This could be optimized in the future with a username -> userId mapping cache
  return getUserByUsernameFromDb(db, username, saveCallback);
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
          
          // Then create the user with the ship_id
          db.run('INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [username, password_hash, 0.0, now, JSON.stringify(techTree), shipId], 
            async function (userErr) {
              if (userErr) return reject(userErr);
              
              const userId = this.lastID;
              console.log(`✅ Created user ${username} (ID: ${userId}) with ship ID ${shipId}`);
              
              // Create the user object
              const user = new User(userId, username, password_hash, 0.0, now, techTree, saveCallback, shipId);
              
              // Send welcome message to new user
              sendMessageToUser(userId, `Welcome to Spacewars, ${username}! Your journey among the stars begins now. Navigate wisely and collect resources to upgrade your ship.`);
              
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
      // Create user without ship (for testing)
      db.run('INSERT INTO users (username, password_hash, iron, last_updated, tech_tree) VALUES (?, ?, ?, ?, ?)', 
        [username, password_hash, 0.0, now, JSON.stringify(techTree)], 
        async function (err) {
          if (err) return reject(err);
          const id = this.lastID;
          
          // Create the user object and cache it
          const user = new User(id, username, password_hash, 0.0, now, techTree, saveCallback);
          
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
        'UPDATE users SET iron = ?, last_updated = ?, tech_tree = ?, ship_id = ? WHERE id = ?',
        [user.iron, user.last_updated, JSON.stringify(user.techTree), user.ship_id, user.id],
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
