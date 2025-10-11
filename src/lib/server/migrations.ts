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
  },
  {
    version: 4,
    name: 'add_ship_hull_defense',
    up: [
      'ALTER TABLE users ADD COLUMN ship_hull INTEGER NOT NULL DEFAULT 5'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN ship_hull'
    ]
  },
  {
    version: 5,
    name: 'add_defense_current_values',
    up: [
      'ALTER TABLE users ADD COLUMN hull_current REAL NOT NULL DEFAULT 250.0',
      'ALTER TABLE users ADD COLUMN armor_current REAL NOT NULL DEFAULT 250.0',
      'ALTER TABLE users ADD COLUMN shield_current REAL NOT NULL DEFAULT 250.0',
      'ALTER TABLE users ADD COLUMN defense_last_regen INTEGER NOT NULL DEFAULT 0'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN hull_current',
      'ALTER TABLE users DROP COLUMN armor_current',
      'ALTER TABLE users DROP COLUMN shield_current',
      'ALTER TABLE users DROP COLUMN defense_last_regen'
    ]
  },
  {
    version: 6,
    name: 'add_battle_state',
    up: [
      'ALTER TABLE users ADD COLUMN in_battle INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN current_battle_id INTEGER DEFAULT NULL'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN in_battle',
      'ALTER TABLE users DROP COLUMN current_battle_id'
    ]
  },
  {
    version: 7,
    name: 'add_battle_end_stats',
    up: [
      'ALTER TABLE battles ADD COLUMN attacker_end_stats TEXT DEFAULT NULL',
      'ALTER TABLE battles ADD COLUMN attackee_end_stats TEXT DEFAULT NULL'
    ],
    down: [
      'ALTER TABLE battles DROP COLUMN attacker_end_stats',
      'ALTER TABLE battles DROP COLUMN attackee_end_stats'
    ]
  }
  // Future migrations go here
  // {
  //   version: 6,
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
    'photon_torpedo', 'rocket_launcher', 'ship_hull', 'kinetic_armor', 
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
  
  // Apply ship_hull migration
  await applyShipHullMigration(db);
  
  // Apply defense current values migration
  await applyDefenseCurrentValuesMigration(db);
  
  // Apply battle state migration
  await applyBattleStateMigration(db);
  
  // Apply battle end stats migration
  await applyBattleEndStatsMigration(db);
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

/**
 * Apply ship_hull column migration to the database
 */
export async function applyShipHullMigration(db: import('sqlite3').Database): Promise<void> {
  console.log('🔄 Checking for ship_hull column migration...');
  
  try {
    const exists = await columnExists(db, 'users', 'ship_hull');
    if (exists) {
      console.log('✅ Ship hull column already exists');
      return;
    }
    
    console.log('🚀 Adding ship_hull column...');
    
    // Get ship_hull migration
    const shipHullMigration = migrations.find(m => m.name === 'add_ship_hull_defense');
    if (!shipHullMigration) {
      console.error('❌ Ship hull migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of shipHullMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ Ship hull migration completed');
  } catch (error) {
    console.error('❌ Error applying ship hull migration:', error);
  }
}

/**
 * Apply defense current values migration to the database
 */
export async function applyDefenseCurrentValuesMigration(db: import('sqlite3').Database): Promise<void> {
  console.log('🔄 Checking for defense current values migration...');
  
  try {
    const exists = await columnExists(db, 'users', 'hull_current');
    if (exists) {
      console.log('✅ Defense current value columns already exist');
      return;
    }
    
    console.log('🚀 Adding defense current value columns...');
    
    // Get defense current values migration
    const defenseCurrentMigration = migrations.find(m => m.name === 'add_defense_current_values');
    if (!defenseCurrentMigration) {
      console.error('❌ Defense current values migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of defenseCurrentMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    // After adding columns with defaults, update existing users to have current = max/2
    console.log('🔄 Updating existing users defense values to max/2...');
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE users 
         SET 
           hull_current = ship_hull * 50.0,
           armor_current = kinetic_armor * 50.0,
           shield_current = energy_shield * 50.0,
           defense_last_regen = last_updated
         WHERE hull_current = 250.0`, // Only update rows that still have the default value
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log('✅ Defense current values migration completed');
  } catch (error) {
    console.error('❌ Error applying defense current values migration:', error);
  }
}

/**
 * Apply battle state migration to the database
 */
export async function applyBattleStateMigration(db: import('sqlite3').Database): Promise<void> {
  console.log('🔄 Checking for battle state migration...');
  
  try {
    const exists = await columnExists(db, 'users', 'in_battle');
    if (exists) {
      console.log('✅ Battle state columns already exist');
      return;
    }
    
    console.log('🚀 Adding battle state columns...');
    
    // Get battle state migration
    const battleStateMigration = migrations.find(m => m.name === 'add_battle_state');
    if (!battleStateMigration) {
      console.error('❌ Battle state migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of battleStateMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ Battle state migration completed');
  } catch (error) {
    console.error('❌ Error applying battle state migration:', error);
  }
}

/**
 * Apply battle end stats migration to the database
 */
export async function applyBattleEndStatsMigration(db: import('sqlite3').Database): Promise<void> {
  console.log('🔄 Checking for battle end stats migration...');
  
  try {
    const exists = await columnExists(db, 'battles', 'attacker_end_stats');
    if (exists) {
      console.log('✅ Battle end stats columns already exist');
      return;
    }
    
    console.log('🚀 Adding battle end stats columns...');
    
    // Get battle end stats migration
    const battleEndStatsMigration = migrations.find(m => m.name === 'add_battle_end_stats');
    if (!battleEndStatsMigration) {
      console.error('❌ Battle end stats migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of battleEndStatsMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ Battle end stats migration completed');
  } catch (error) {
    console.error('❌ Error applying battle end stats migration:', error);
  }
}
