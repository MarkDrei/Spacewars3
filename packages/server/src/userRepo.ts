// ---
// Handles loading and saving User objects to the database.
// ---

import sqlite3 from 'sqlite3';
import { User, SaveUserCallback } from './user';
import { createInitialTechTree } from './techtree';

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

export function getUserById(db: sqlite3.Database, id: number, saveCallback: SaveUserCallback): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(userFromRow(row as UserRow, saveCallback));
    });
  });
}

export function getUserByUsername(db: sqlite3.Database, username: string, saveCallback: SaveUserCallback): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(userFromRow(row as UserRow, saveCallback));
    });
  });
}

export function createUser(db: sqlite3.Database, username: string, password_hash: string, saveCallback: SaveUserCallback): Promise<User> {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const techTree = createInitialTechTree();
    db.run('INSERT INTO users (username, password_hash, iron, last_updated, tech_tree) VALUES (?, ?, ?, ?, ?)', [username, password_hash, 0.0, now, JSON.stringify(techTree)], function (err) {
      if (err) return reject(err);
      const id = this.lastID;
      resolve(new User(id, username, password_hash, 0.0, now, techTree, saveCallback));
    });
  });
}

export function saveUserToDb(db: sqlite3.Database): SaveUserCallback {
  return async (user) => {
    return new Promise((resolve, reject) => {
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
