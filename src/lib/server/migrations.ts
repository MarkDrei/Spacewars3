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
  },
  {
    version: 2,
    name: 'add_tech_system',
    up: [
      'ALTER TABLE users ADD COLUMN pulse_laser INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN auto_turret INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN plasma_lance INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN gauss_rifle INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN photon_torpedo INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN rocket_launcher INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN kinetic_armor INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN energy_shield INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN missile_jammer INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN build_queue TEXT DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN build_start_sec INTEGER DEFAULT NULL'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN pulse_laser',
      'ALTER TABLE users DROP COLUMN auto_turret',
      'ALTER TABLE users DROP COLUMN plasma_lance',
      'ALTER TABLE users DROP COLUMN gauss_rifle',
      'ALTER TABLE users DROP COLUMN photon_torpedo',
      'ALTER TABLE users DROP COLUMN rocket_launcher',
      'ALTER TABLE users DROP COLUMN kinetic_armor',
      'ALTER TABLE users DROP COLUMN energy_shield',
      'ALTER TABLE users DROP COLUMN missile_jammer',
      'ALTER TABLE users DROP COLUMN build_queue',
      'ALTER TABLE users DROP COLUMN build_start_sec'
    ]
  },
  {
    version: 3,
    name: 'add_messages_table',
    up: [
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT 0,
        message TEXT NOT NULL,
        FOREIGN KEY (recipient_id) REFERENCES users (id)
      )`
    ],
    down: [
      'DROP TABLE IF EXISTS messages'
    ]
  }
  // Future migrations go here
  // {
  //   version: 3,
  //   name: 'add_user_settings',
  //   up: ['ALTER TABLE users ADD COLUMN settings TEXT DEFAULT "{}"'],
  //   down: ['ALTER TABLE users DROP COLUMN settings']
  // }
];

export function getCurrentVersion(): number {
  return Math.max(...migrations.map(m => m.version));
}

/**
 * Check if a column exists in a table
 */
function columnExists(db: import('sqlite3').Database, tableName: string, columnName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err: Error | null, rows: { name: string }[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      const exists = rows.some(row => row.name === columnName);
      resolve(exists);
    });
  });
}

/**
 * Run a migration statement safely (ignore errors if column already exists)
 */
function runMigrationStatement(db: import('sqlite3').Database, sql: string): Promise<void> {
  return new Promise((resolve) => {
    db.run(sql, (err: Error | null) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.warn(`⚠️ Migration warning: ${err.message}`);
      }
      // Always resolve - we don't want to fail if column already exists
      resolve();
    });
  });
}

/**
 * Apply tech system migrations to the database
 */
export async function applyTechMigrations(db: import('sqlite3').Database): Promise<void> {
  console.log('🔄 Checking for tech system migrations...');
  
  // Check if any tech columns are missing
  const techColumns = [
    'pulse_laser', 'auto_turret', 'plasma_lance', 'gauss_rifle', 
    'photon_torpedo', 'rocket_launcher', 'kinetic_armor', 
    'energy_shield', 'missile_jammer', 'build_queue', 'build_start_sec'
  ];
  
  let needsMigration = false;
  for (const column of techColumns) {
    try {
      const exists = await columnExists(db, 'users', column);
      if (!exists) {
        needsMigration = true;
        break;
      }
    } catch {
      // If we can't check, assume we need migration
      needsMigration = true;
      break;
    }
  }
  
  if (!needsMigration) {
    console.log('✅ Tech system columns already exist');
  } else {
    console.log('🚀 Applying tech system migrations...');
    
    // Get tech system migration
    const techMigration = migrations.find(m => m.name === 'add_tech_system');
    if (!techMigration) {
      console.error('❌ Tech system migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of techMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ Tech system migrations completed');
  }
  
  // Apply messages table migration
  await applyMessagesMigrations(db);
}

/**
 * Check if a table exists in the database
 */
function tableExists(db: import('sqlite3').Database, tableName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err: Error | null, rows: { name: string }[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      resolve(rows.length > 0);
    });
  });
}

/**
 * Apply messages table migrations to the database
 */
export async function applyMessagesMigrations(db: import('sqlite3').Database): Promise<void> {
  console.log('🔄 Checking for messages table migration...');
  
  try {
    const exists = await tableExists(db, 'messages');
    if (exists) {
      console.log('✅ Messages table already exists');
      return;
    }
    
    console.log('🚀 Creating messages table...');
    
    // Get messages migration
    const messagesMigration = migrations.find(m => m.name === 'add_messages_table');
    if (!messagesMigration) {
      console.error('❌ Messages migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of messagesMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ Messages table migration completed');
  } catch (error) {
    console.error('❌ Error applying messages migration:', error);
  }
}
