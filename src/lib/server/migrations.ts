// ---
// Database migration system (future enhancement) - PostgreSQL
// ---

import { DatabaseConnection } from './database';
import { MIGRATE_ADD_PICTURE_ID } from './schema';

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
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        iron DOUBLE PRECISION NOT NULL DEFAULT 0.0,
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
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS pulse_laser INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_turret INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS plasma_lance INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS gauss_rifle INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS photon_torpedo INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS rocket_launcher INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS kinetic_armor INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_shield INTEGER NOT NULL DEFAULT 5',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS missile_jammer INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS build_queue TEXT DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS build_start_sec INTEGER DEFAULT NULL'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN IF EXISTS pulse_laser',
      'ALTER TABLE users DROP COLUMN IF EXISTS auto_turret',
      'ALTER TABLE users DROP COLUMN IF EXISTS plasma_lance',
      'ALTER TABLE users DROP COLUMN IF EXISTS gauss_rifle',
      'ALTER TABLE users DROP COLUMN IF EXISTS photon_torpedo',
      'ALTER TABLE users DROP COLUMN IF EXISTS rocket_launcher',
      'ALTER TABLE users DROP COLUMN IF EXISTS kinetic_armor',
      'ALTER TABLE users DROP COLUMN IF EXISTS energy_shield',
      'ALTER TABLE users DROP COLUMN IF EXISTS missile_jammer',
      'ALTER TABLE users DROP COLUMN IF EXISTS build_queue',
      'ALTER TABLE users DROP COLUMN IF EXISTS build_start_sec'
    ]
  },
  {
    version: 3,
    name: 'add_messages_table',
    up: [
      `CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        recipient_id INTEGER NOT NULL,
        created_at BIGINT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
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
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS ship_hull INTEGER NOT NULL DEFAULT 5'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN IF EXISTS ship_hull'
    ]
  },
  {
    version: 5,
    name: 'add_defense_current_values',
    up: [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS hull_current DOUBLE PRECISION NOT NULL DEFAULT 250.0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS armor_current DOUBLE PRECISION NOT NULL DEFAULT 250.0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS shield_current DOUBLE PRECISION NOT NULL DEFAULT 250.0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS defense_last_regen INTEGER NOT NULL DEFAULT 0'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN IF EXISTS hull_current',
      'ALTER TABLE users DROP COLUMN IF EXISTS armor_current',
      'ALTER TABLE users DROP COLUMN IF EXISTS shield_current',
      'ALTER TABLE users DROP COLUMN IF EXISTS defense_last_regen'
    ]
  },
  {
    version: 6,
    name: 'add_battle_state',
    up: [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS in_battle INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS current_battle_id INTEGER DEFAULT NULL'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN IF EXISTS in_battle',
      'ALTER TABLE users DROP COLUMN IF EXISTS current_battle_id'
    ]
  },
  {
    version: 7,
    name: 'add_battle_end_stats',
    up: [
      'ALTER TABLE battles ADD COLUMN IF NOT EXISTS attacker_end_stats TEXT DEFAULT NULL',
      'ALTER TABLE battles ADD COLUMN IF NOT EXISTS attackee_end_stats TEXT DEFAULT NULL'
    ],
    down: [
      'ALTER TABLE battles DROP COLUMN IF EXISTS attacker_end_stats',
      'ALTER TABLE battles DROP COLUMN IF EXISTS attackee_end_stats'
    ]
  },
  {
    version: 8,
    name: 'add_xp_system',
    up: [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0'
    ],
    down: [
      'ALTER TABLE users DROP COLUMN IF EXISTS xp'
    ]
  }
  // Future migrations go here
  ,
  {
    version: 9,
    name: 'add_inventories_table',
    up: [
      `CREATE TABLE IF NOT EXISTS inventories (
        user_id INTEGER PRIMARY KEY,
        inventory_data JSONB NOT NULL DEFAULT '[]'::jsonb,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`
    ],
    down: [
      'DROP TABLE IF EXISTS inventories'
    ]
  }
];

export function getCurrentVersion(): number {
  return Math.max(...migrations.map(m => m.version));
}

/**
 * Check if a column exists in a table (PostgreSQL)
 */
async function columnExists(db: DatabaseConnection, tableName: string, columnName: string): Promise<boolean> {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    )
  `, [tableName, columnName]);
  return result.rows[0].exists;
}

/**
 * Check if a table exists in the database (PostgreSQL)
 */
async function tableExists(db: DatabaseConnection, tableName: string): Promise<boolean> {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `, [tableName]);
  return result.rows[0].exists;
}

/**
 * Run a migration statement safely (PostgreSQL)
 */
async function runMigrationStatement(db: DatabaseConnection, sql: string): Promise<void> {
  try {
    await db.query(sql);
  } catch (err) {
    const errorMessage = (err as Error).message || '';
    // Ignore "column already exists" type errors
    if (!errorMessage.includes('already exists')) {
      console.warn(`⚠️ Migration warning: ${errorMessage}`);
    }
  }
}

/**
 * Apply tech system migrations to the database
 */
export async function applyTechMigrations(db: DatabaseConnection): Promise<void> {
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
  // Apply picture_id migration
  await applyPictureIdMigration(db);
  // Apply XP system migration
  await applyXpSystemMigration(db);
  // Apply inventories table migration
  await applyInventoriesMigration(db);
}

/**
 * Apply picture_id column migration to space_objects table
 */
export async function applyPictureIdMigration(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Checking for picture_id column migration...');
  
  try {
    const exists = await columnExists(db, 'space_objects', 'picture_id');
    if (exists) {
      console.log('✅ picture_id column already exists');
      return;
    }
    
    console.log('🚀 Adding picture_id column to space_objects...');
    
    // Apply each migration statement
    for (const statement of MIGRATE_ADD_PICTURE_ID) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ picture_id migration completed');
  } catch (error) {
    console.error('❌ Error applying picture_id migration:', error);
  }}

/**
 * Apply messages table migrations to the database
 */
export async function applyMessagesMigrations(db: DatabaseConnection): Promise<void> {
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
export async function applyShipHullMigration(db: DatabaseConnection): Promise<void> {
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
export async function applyDefenseCurrentValuesMigration(db: DatabaseConnection): Promise<void> {
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
    await db.query(
      `UPDATE users 
       SET 
         hull_current = ship_hull * 50.0,
         armor_current = kinetic_armor * 50.0,
         shield_current = energy_shield * 50.0,
         defense_last_regen = last_updated
       WHERE hull_current = 250.0`
    );
    
    console.log('✅ Defense current values migration completed');
  } catch (error) {
    console.error('❌ Error applying defense current values migration:', error);
  }
}

/**
 * Apply battle state migration to the database
 */
export async function applyBattleStateMigration(db: DatabaseConnection): Promise<void> {
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
export async function applyBattleEndStatsMigration(db: DatabaseConnection): Promise<void> {
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

/**
 * Apply inventories table migration to the database
 */
export async function applyInventoriesMigration(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Checking for inventories table migration...');

  try {
    const exists = await tableExists(db, 'inventories');
    if (exists) {
      console.log('✅ Inventories table already exists');
      return;
    }

    console.log('🚀 Creating inventories table...');

    const migration = migrations.find(m => m.name === 'add_inventories_table');
    if (!migration) {
      console.error('❌ Inventories migration not found');
      return;
    }

    for (const statement of migration.up) {
      await runMigrationStatement(db, statement);
    }

    console.log('✅ Inventories table migration completed');
  } catch (error) {
    console.error('❌ Error applying inventories migration:', error);
  }
}

/**
 * Apply XP system migration to the database
 */
export async function applyXpSystemMigration(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Checking for XP system migration...');
  
  try {
    const exists = await columnExists(db, 'users', 'xp');
    if (exists) {
      console.log('✅ XP column already exists');
      return;
    }
    
    console.log('🚀 Adding XP column...');
    
    // Get XP system migration
    const xpSystemMigration = migrations.find(m => m.name === 'add_xp_system');
    if (!xpSystemMigration) {
      console.error('❌ XP system migration not found');
      return;
    }
    
    // Apply each migration statement
    for (const statement of xpSystemMigration.up) {
      await runMigrationStatement(db, statement);
    }
    
    console.log('✅ XP system migration completed');
  } catch (error) {
    console.error('❌ Error applying XP system migration:', error);
  }
}
