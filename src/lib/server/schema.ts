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
  
  -- Tech counts (weapons)
  pulse_laser INTEGER NOT NULL DEFAULT 5,
  auto_turret INTEGER NOT NULL DEFAULT 5,
  plasma_lance INTEGER NOT NULL DEFAULT 0,
  gauss_rifle INTEGER NOT NULL DEFAULT 0,
  photon_torpedo INTEGER NOT NULL DEFAULT 0,
  rocket_launcher INTEGER NOT NULL DEFAULT 0,

  -- Tech counts (defense)
  kinetic_armor INTEGER NOT NULL DEFAULT 5,
  energy_shield INTEGER NOT NULL DEFAULT 5,
  missile_jammer INTEGER NOT NULL DEFAULT 0,

  -- Build queue
  build_queue TEXT DEFAULT NULL,
  build_start_sec INTEGER DEFAULT NULL,
  
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

// Migration to add tech system columns to existing users table
export const MIGRATE_ADD_TECH_COLUMNS = [
  // Weapon columns
  'ALTER TABLE users ADD COLUMN pulse_laser INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN auto_turret INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN plasma_lance INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN gauss_rifle INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN photon_torpedo INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN rocket_launcher INTEGER NOT NULL DEFAULT 0',
  
  // Defense columns  
  'ALTER TABLE users ADD COLUMN kinetic_armor INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN energy_shield INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN missile_jammer INTEGER NOT NULL DEFAULT 0',
  
  // Build queue columns
  'ALTER TABLE users ADD COLUMN build_queue TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN build_start_sec INTEGER DEFAULT NULL'
];

// Optional: Version management for migrations
export const SCHEMA_VERSION = 6;
