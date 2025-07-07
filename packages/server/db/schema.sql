-- Database schema for Spacewars Ironcore

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  iron REAL NOT NULL DEFAULT 0.0,
  last_updated INTEGER NOT NULL
);

-- Game stats table
CREATE TABLE IF NOT EXISTS game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  fuel INTEGER NOT NULL DEFAULT 0,
  weapons INTEGER NOT NULL DEFAULT 0,
  tech INTEGER NOT NULL DEFAULT 0,
  generic INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add some initial data for testing
INSERT OR IGNORE INTO users (username, password_hash, iron, last_updated)
VALUES ('test', '$2b$10$tYLp9ixR1UKtxDL3bFJjXO.yUl5S1l1wR.Qw9nNGJc0uzWLz1uO5C', 100.0, unixepoch());
