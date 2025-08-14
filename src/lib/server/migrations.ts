// ---
// Database migration system (future enhancement)
// ---

export interface Migration {
  version: number;
  name: string;
  up: string[];
  down: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        iron REAL NOT NULL DEFAULT 0.0,
        last_updated INTEGER NOT NULL,
        tech_tree TEXT NOT NULL
      )`
    ],
    down: ['DROP TABLE IF EXISTS users']
  }
  // Future migrations go here
  // {
  //   version: 2,
  //   name: 'add_user_settings',
  //   up: ['ALTER TABLE users ADD COLUMN settings TEXT DEFAULT "{}"'],
  //   down: ['ALTER TABLE users DROP COLUMN settings']
  // }
];

export function getCurrentVersion(): number {
  return Math.max(...migrations.map(m => m.version));
}
