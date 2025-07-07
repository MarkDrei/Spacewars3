// ---
// Handles loading and saving User objects to the database.
// ---

import sqlite3 from 'sqlite3';
import { User } from './user';
import type { SaveUserCallback } from './user';
import { createInitialTechTree } from './techtree';

function userFromRow(row: any, saveCallback: SaveUserCallback): User {
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
    row.iron || 0,
    row.last_updated || Math.floor(Date.now() / 1000),
    techTree,
    saveCallback
  );
}

export function getUserById(db: sqlite3.Database, id: number): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      
      const saveCallback = saveUserToDb(db);
      resolve(userFromRow(row, saveCallback));
    });
  });
}

export function getUserByUsername(db: sqlite3.Database, username: string): Promise<User | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      
      const saveCallback = saveUserToDb(db);
      resolve(userFromRow(row, saveCallback));
    });
  });
}

export function createUser(db: sqlite3.Database, username: string, passwordHash: string): Promise<User> {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    const techTree = JSON.stringify(createInitialTechTree());
    
    db.run(
      'INSERT INTO users (username, password_hash, iron, last_updated, tech_tree) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, 0, now, techTree],
      function(err) {
        if (err) return reject(err);
        
        const id = this.lastID;
        const saveCallback = saveUserToDb(db);
        
        resolve(new User(id, username, passwordHash, 0, now, createInitialTechTree(), saveCallback));
      }
    );
  });
}

export function saveUserToDb(db: sqlite3.Database): SaveUserCallback {
  return async (user: User) => {
    return new Promise((resolve, reject) => {
      const techTreeJson = JSON.stringify(user.techTree);
      
      db.run(
        'UPDATE users SET iron = ?, last_updated = ?, tech_tree = ? WHERE id = ?',
        [user.iron, user.last_updated, techTreeJson, user.id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  };
}
