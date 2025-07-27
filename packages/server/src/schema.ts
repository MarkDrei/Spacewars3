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
  tech_tree TEXT NOT NULL
)`;

// Add other table schemas here as your app grows
export const CREATE_TABLES = [
  CREATE_USERS_TABLE
  // Add more tables here in the future
];

// Optional: Version management for migrations
export const SCHEMA_VERSION = 1;
