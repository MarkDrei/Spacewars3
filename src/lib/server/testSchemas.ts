// ---
// SQLite-compatible schema definitions for testing
// ---

export const CREATE_USERS_TABLE_SQLITE = `
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

export const CREATE_SPACE_OBJECTS_TABLE_SQLITE = `
CREATE TABLE IF NOT EXISTS space_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  speed REAL NOT NULL DEFAULT 0.0,
  angle REAL NOT NULL DEFAULT 0.0,
  last_position_update_ms REAL NOT NULL
)`;

export const CREATE_MESSAGES_TABLE_SQLITE = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES users (id)
)`;

export const CREATE_BATTLES_TABLE_SQLITE = `
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_id INTEGER NOT NULL,
  attackee_id INTEGER NOT NULL,
  battle_start_time INTEGER NOT NULL,
  battle_end_time INTEGER DEFAULT NULL,
  winner_id INTEGER DEFAULT NULL,
  loser_id INTEGER DEFAULT NULL,
  attacker_start_stats TEXT NOT NULL,
  attackee_start_stats TEXT NOT NULL,
  attacker_end_stats TEXT DEFAULT NULL,
  attackee_end_stats TEXT DEFAULT NULL,
  attacker_weapon_cooldowns TEXT NOT NULL,
  attackee_weapon_cooldowns TEXT NOT NULL,
  battle_log TEXT NOT NULL,
  attacker_total_damage REAL NOT NULL DEFAULT 0.0,
  attackee_total_damage REAL NOT NULL DEFAULT 0.0,
  FOREIGN KEY (attacker_id) REFERENCES users (id),
  FOREIGN KEY (attackee_id) REFERENCES users (id),
  FOREIGN KEY (winner_id) REFERENCES users (id),
  FOREIGN KEY (loser_id) REFERENCES users (id)
)`;

export const CREATE_TABLES_SQLITE = [
  CREATE_SPACE_OBJECTS_TABLE_SQLITE,
  CREATE_USERS_TABLE_SQLITE,
  CREATE_MESSAGES_TABLE_SQLITE,
  CREATE_BATTLES_TABLE_SQLITE
];
