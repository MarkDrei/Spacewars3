// Entry point for the server package
import { createApp } from './createApp';
import sqlite3 from 'sqlite3';
import path from 'path';

const PORT = process.env.PORT || 5174;
const DB_PATH = path.join(__dirname, '../db/users.db');

// Initialize SQLite DB
const db = new (sqlite3.verbose().Database)(DB_PATH, (err: Error | null) => {
  if (err) throw err;
  console.log('Connected to the SQLite database');
});

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
