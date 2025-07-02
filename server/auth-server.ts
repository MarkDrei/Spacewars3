// ---
// File responsibilities:
// Boots up the backend server, connects to the production database, and exposes the API endpoints for authentication and user stats.
// ---

import { createApp } from './createApp';
import sqlite3 from 'sqlite3';
import path from 'path';

const PORT = process.env.PORT || 5174;
const DB_PATH = path.join(__dirname, 'users.db');

// Initialize SQLite DB
const db = new (sqlite3.verbose().Database)(DB_PATH, (err: Error | null) => {
  if (err) throw err;
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    iron REAL NOT NULL DEFAULT 0.0,
    last_updated INTEGER NOT NULL
  )`);
});

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});

export default app;
