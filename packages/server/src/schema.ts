// ---
// Database schema definitions - Single source of truth
// ---

export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  iron REAL NOT NULL DEFAULT 0.0,
  last_updated INTEGER NOT NULL,
  tech_tree TEXT NOT NULL,
  ship_id INTEGER,
  FOREIGN KEY (ship_id) REFERENCES space_objects (id)
)`;

export const CREATE_SPACE_OBJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS space_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'player_ship', 'asteroid', 'shipwreck', 'escape_pod'
  x REAL NOT NULL,
  y REAL NOT NULL,
  velocity REAL NOT NULL DEFAULT 0.0,
  angle REAL NOT NULL DEFAULT 0.0,
  last_position_update REAL NOT NULL
)`;

export const CREATE_TABLES = [
  CREATE_SPACE_OBJECTS_TABLE,
  CREATE_USERS_TABLE
];

// Optional: Version management for migrations
export const SCHEMA_VERSION = 4;
