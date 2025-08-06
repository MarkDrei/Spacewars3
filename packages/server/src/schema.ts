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
  speed REAL NOT NULL DEFAULT 0.0,
  angle REAL NOT NULL DEFAULT 0.0,
  last_position_update_ms REAL NOT NULL
)`;

export const CREATE_TABLES = [
  CREATE_SPACE_OBJECTS_TABLE,
  CREATE_USERS_TABLE
];

// Migration to rename column
export const MIGRATE_POSITION_TIMESTAMP = `
ALTER TABLE space_objects RENAME COLUMN last_position_update TO last_position_update_ms;
`;

// Optional: Version management for migrations
export const SCHEMA_VERSION = 5;
