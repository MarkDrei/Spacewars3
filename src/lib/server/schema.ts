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
  ship_hull INTEGER NOT NULL DEFAULT 5,
  kinetic_armor INTEGER NOT NULL DEFAULT 5,
  energy_shield INTEGER NOT NULL DEFAULT 5,
  missile_jammer INTEGER NOT NULL DEFAULT 0,

  -- Defense current values (for persistence)
  hull_current REAL NOT NULL DEFAULT 250.0,
  armor_current REAL NOT NULL DEFAULT 250.0,
  shield_current REAL NOT NULL DEFAULT 250.0,
  defense_last_regen INTEGER NOT NULL DEFAULT 0,

  -- Build queue
  build_queue TEXT DEFAULT NULL,
  build_start_sec INTEGER DEFAULT NULL,

  -- Battle state
  in_battle INTEGER NOT NULL DEFAULT 0,
  current_battle_id INTEGER DEFAULT NULL,
  
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

export const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL, -- Unix timestamp in seconds
  is_read BOOLEAN NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES users (id)
)`;

export const CREATE_BATTLES_TABLE = `
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_id INTEGER NOT NULL,
  attackee_id INTEGER NOT NULL,
  battle_start_time INTEGER NOT NULL,
  battle_end_time INTEGER DEFAULT NULL,
  winner_id INTEGER DEFAULT NULL,
  loser_id INTEGER DEFAULT NULL,
  attacker_start_stats TEXT NOT NULL, -- JSON: { hull, armor, shield, weapons: {...} }
  attackee_start_stats TEXT NOT NULL, -- JSON: { hull, armor, shield, weapons: {...} }
  attacker_end_stats TEXT DEFAULT NULL, -- JSON: final stats when battle ends
  attackee_end_stats TEXT DEFAULT NULL, -- JSON: final stats when battle ends
  attacker_weapon_cooldowns TEXT NOT NULL, -- JSON: { pulse_laser: timestamp, ... }
  attackee_weapon_cooldowns TEXT NOT NULL, -- JSON: { pulse_laser: timestamp, ... }
  battle_log TEXT NOT NULL, -- JSON array of battle events
  FOREIGN KEY (attacker_id) REFERENCES users (id),
  FOREIGN KEY (attackee_id) REFERENCES users (id),
  FOREIGN KEY (winner_id) REFERENCES users (id),
  FOREIGN KEY (loser_id) REFERENCES users (id)
)`;

export const CREATE_TABLES = [
  CREATE_SPACE_OBJECTS_TABLE,
  CREATE_USERS_TABLE,
  CREATE_MESSAGES_TABLE,
  CREATE_BATTLES_TABLE
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

// Migration to add defense current values for persistence
export const MIGRATE_ADD_DEFENSE_CURRENT = [
  'ALTER TABLE users ADD COLUMN hull_current REAL NOT NULL DEFAULT 250.0',
  'ALTER TABLE users ADD COLUMN armor_current REAL NOT NULL DEFAULT 250.0',
  'ALTER TABLE users ADD COLUMN shield_current REAL NOT NULL DEFAULT 250.0',
  'ALTER TABLE users ADD COLUMN defense_last_regen INTEGER NOT NULL DEFAULT 0'
];

// Migration to add battle state columns
export const MIGRATE_ADD_BATTLE_STATE = [
  'ALTER TABLE users ADD COLUMN in_battle INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN current_battle_id INTEGER DEFAULT NULL'
];

// Optional: Version management for migrations
export const SCHEMA_VERSION = 9;
