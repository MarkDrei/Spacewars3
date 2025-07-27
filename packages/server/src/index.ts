// Entry point for the server package
import { createApp } from './createApp';
import { CREATE_TABLES } from './schema';
import sqlite3 from 'sqlite3';
import path from 'path';

const PORT = Number(process.env.PORT) || 5174;

// Use in-memory database for free tier deployment (no persistent storage)
// For local development, determine correct path based on whether we're running from src or dist
const isProduction = process.env.NODE_ENV === 'production';
const isCompiledJS = __filename.includes('dist');

let DB_PATH: string;
if (isProduction) {
  DB_PATH = ':memory:';
} else if (isCompiledJS) {
  // Running compiled JS: dist/src/index.js -> go up to packages/server/db/users.db
  DB_PATH = path.join(__dirname, '../../db/users.db');
} else {
  // Running with ts-node: src/index.ts -> go up to packages/server/db/users.db  
  DB_PATH = path.join(__dirname, '../db/users.db');
}

// Initialize SQLite DB
const db = new (sqlite3.verbose().Database)(DB_PATH, (err: Error | null) => {
  if (err) {
    console.error('Database connection error:', err);
    throw err;
  }
  console.log(`Connected to the SQLite database (${DB_PATH === ':memory:' ? 'in-memory' : 'file'})`);
  console.log('Database path:', DB_PATH);
  
  // Initialize database schema for in-memory database
  if (process.env.NODE_ENV === 'production') {
    db.serialize(() => {
      CREATE_TABLES.forEach((createTableSQL, index) => {
        db.run(createTableSQL, (err) => {
          if (err) {
            console.error(`Error creating table ${index + 1}:`, err);
          } else {
            console.log(`Table ${index + 1} created successfully`);
          }
        });
      });
      console.log('Database schema initialization completed');
    });
  }
  
  // Start the server only after database is ready
  const app = createApp(db);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
});
