// Entry point for the server package
import { createApp } from './createApp';
import sqlite3 from 'sqlite3';
import path from 'path';

const PORT = Number(process.env.PORT) || 5174;

// Use in-memory database for free tier deployment (no persistent storage)
// For local development, use the correct path relative to project root
const DB_PATH = process.env.NODE_ENV === 'production' 
  ? ':memory:' 
  : path.join(__dirname, '../../db/users.db');  // Updated path for compiled JS

// Initialize SQLite DB
const db = new (sqlite3.verbose().Database)(DB_PATH, (err: Error | null) => {
  if (err) throw err;
  console.log(`Connected to the SQLite database (${DB_PATH === ':memory:' ? 'in-memory' : 'file'})`);
});

// Initialize database schema for in-memory database
if (process.env.NODE_ENV === 'production') {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      iron INTEGER DEFAULT 0,
      tech_levels TEXT DEFAULT '{}',
      research_progress TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

const app = createApp(db);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
