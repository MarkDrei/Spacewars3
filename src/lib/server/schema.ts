// ---
// Database schema definitions - Single source of truth (PostgreSQL)
// ---

export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  iron DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  xp INTEGER NOT NULL DEFAULT 0,
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
  hull_current DOUBLE PRECISION NOT NULL DEFAULT 250.0,
  armor_current DOUBLE PRECISION NOT NULL DEFAULT 250.0,
  shield_current DOUBLE PRECISION NOT NULL DEFAULT 250.0,
  defense_last_regen INTEGER NOT NULL DEFAULT 0,

  -- Build queue
  build_queue TEXT DEFAULT NULL,
  build_start_sec INTEGER DEFAULT NULL,

  -- Battle state
  in_battle INTEGER NOT NULL DEFAULT 0,
  current_battle_id INTEGER DEFAULT NULL,

  -- Teleport charges
  teleport_charges DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  teleport_last_regen INTEGER NOT NULL DEFAULT 0,

  -- Score (economic progression metric, awarded from research and builds)
  score INTEGER NOT NULL DEFAULT 0,

  -- Email address and verification state (optional)
  email TEXT DEFAULT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token TEXT DEFAULT NULL,
  email_verification_expires BIGINT DEFAULT NULL,

  -- Password reset (optional, expiry-based single-use)
  password_reset_token TEXT DEFAULT NULL,
  password_reset_expires BIGINT DEFAULT NULL,

  -- Locale preference
  preferred_locale TEXT NOT NULL DEFAULT 'en',
  
  FOREIGN KEY (ship_id) REFERENCES space_objects (id)
)`;

export const CREATE_SPACE_OBJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS space_objects (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'player_ship', 'asteroid', 'shipwreck', 'escape_pod'
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  angle DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  last_position_update_ms DOUBLE PRECISION NOT NULL,
  picture_id INTEGER NOT NULL DEFAULT 1
)`;

export const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL,
  created_at BIGINT NOT NULL, -- Unix timestamp in milliseconds
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES users (id)
)`;

export const CREATE_BATTLES_TABLE = `
CREATE TABLE IF NOT EXISTS battles (
  id SERIAL PRIMARY KEY,
  attacker_id INTEGER NOT NULL,
  attackee_id INTEGER NOT NULL,
  battle_start_time BIGINT NOT NULL,
  battle_end_time BIGINT DEFAULT NULL,
  winner_id INTEGER DEFAULT NULL,
  loser_id INTEGER DEFAULT NULL,
  attacker_start_stats TEXT NOT NULL, -- JSON: { hull, armor, shield, weapons: {...} }
  attackee_start_stats TEXT NOT NULL, -- JSON: { hull, armor, shield, weapons: {...} }
  attacker_end_stats TEXT DEFAULT NULL, -- JSON: final stats when battle ends
  attackee_end_stats TEXT DEFAULT NULL, -- JSON: final stats when battle ends
  attacker_weapon_cooldowns TEXT NOT NULL, -- JSON: { pulse_laser: timestamp, ... }
  attackee_weapon_cooldowns TEXT NOT NULL, -- JSON: { pulse_laser: timestamp, ... }
  battle_log TEXT NOT NULL, -- JSON array of battle events
  attacker_total_damage DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- Total damage dealt by attacker
  attackee_total_damage DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- Total damage dealt by attackee
  FOREIGN KEY (attacker_id) REFERENCES users (id),
  FOREIGN KEY (attackee_id) REFERENCES users (id),
  FOREIGN KEY (winner_id) REFERENCES users (id),
  FOREIGN KEY (loser_id) REFERENCES users (id)
)`;

export const CREATE_INVENTORIES_TABLE = `
CREATE TABLE IF NOT EXISTS inventories (
  user_id INTEGER PRIMARY KEY,
  inventory_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  bridge_data JSONB DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
)`;

export const CREATE_USER_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS user_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events (event_type);
`;

export const CREATE_TABLES = [
  CREATE_SPACE_OBJECTS_TABLE,
  CREATE_USERS_TABLE,
  // Partial unique index on email — cannot be inline in CREATE TABLE for conditional indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL`,
  CREATE_MESSAGES_TABLE,
  CREATE_BATTLES_TABLE,
  CREATE_INVENTORIES_TABLE,
  CREATE_USER_EVENTS_TABLE
];

// Migration to rename column (PostgreSQL syntax)
export const MIGRATE_POSITION_TIMESTAMP = `
ALTER TABLE space_objects RENAME COLUMN last_position_update TO last_position_update_ms;
`;

// Migration to add tech system columns to existing users table (PostgreSQL syntax)
export const MIGRATE_ADD_TECH_COLUMNS = [
  // Weapon columns
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS pulse_laser INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_turret INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS plasma_lance INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS gauss_rifle INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS photon_torpedo INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS rocket_launcher INTEGER NOT NULL DEFAULT 0',
  
  // Defense columns  
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS kinetic_armor INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_shield INTEGER NOT NULL DEFAULT 5',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS missile_jammer INTEGER NOT NULL DEFAULT 0',
  
  // Build queue columns
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS build_queue TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS build_start_sec INTEGER DEFAULT NULL'
];

// Migration to add defense current values for persistence (PostgreSQL syntax)
export const MIGRATE_ADD_DEFENSE_CURRENT = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS hull_current DOUBLE PRECISION NOT NULL DEFAULT 250.0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS armor_current DOUBLE PRECISION NOT NULL DEFAULT 250.0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS shield_current DOUBLE PRECISION NOT NULL DEFAULT 250.0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS defense_last_regen INTEGER NOT NULL DEFAULT 0'
];

// Migration to add battle state columns (PostgreSQL syntax)
export const MIGRATE_ADD_BATTLE_STATE = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS in_battle INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS current_battle_id INTEGER DEFAULT NULL'
];

// Migration to add damage tracking to battles table (PostgreSQL syntax)
export const MIGRATE_ADD_BATTLE_DAMAGE = [
  'ALTER TABLE battles ADD COLUMN IF NOT EXISTS attacker_total_damage DOUBLE PRECISION NOT NULL DEFAULT 0.0',
  'ALTER TABLE battles ADD COLUMN IF NOT EXISTS attackee_total_damage DOUBLE PRECISION NOT NULL DEFAULT 0.0'
];

// Migration to add picture_id to space_objects table (PostgreSQL syntax)
export const MIGRATE_ADD_PICTURE_ID = [
  'ALTER TABLE space_objects ADD COLUMN IF NOT EXISTS picture_id INTEGER NOT NULL DEFAULT 1'
];

// Migration to add teleport charges columns (PostgreSQL syntax)
export const MIGRATE_ADD_TELEPORT_CHARGES = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS teleport_charges DOUBLE PRECISION NOT NULL DEFAULT 0.0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS teleport_last_regen INTEGER NOT NULL DEFAULT 0'
];

// Migration to add score column
export const MIGRATE_ADD_SCORE = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0'
];

// Migration to add user_events table for statistics tracking
export const MIGRATE_ADD_USER_EVENTS = [
  `CREATE TABLE IF NOT EXISTS user_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events (event_type)'
];

// Migration to add email columns (PostgreSQL syntax)
export const MIGRATE_ADD_EMAIL = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires BIGINT DEFAULT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL'
];

// Migration to add password reset token columns
export const MIGRATE_ADD_PASSWORD_RESET = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires BIGINT DEFAULT NULL'
];

// Migration to add preferred_locale column
export const MIGRATE_ADD_PREFERRED_LOCALE = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en'",
];

// Optional: Version management for migrations
export const SCHEMA_VERSION = 17;
