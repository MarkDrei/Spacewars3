import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES } from './schema';
import { seedDatabase, DEFAULT_USERS, DEFAULT_SPACE_OBJECTS } from './seedData';
import { applyTechMigrations } from './migrations';

let db: sqlite3.Database | null = null;
let initializationPromise: Promise<sqlite3.Database> | null = null;

// Test database management
let testDb: sqlite3.Database | null = null;
let testDbInitialized = false;

function initializeTestDatabase(): sqlite3.Database {
  if (testDb && testDbInitialized) {
    return testDb;
  }
  
  testDb = new (sqlite3.verbose().Database)(':memory:');
  
  // Initialize synchronously using serialize to ensure order
  testDb.serialize(() => {
    // Create tables
    CREATE_TABLES.forEach((createTableSQL) => {
      testDb!.run(createTableSQL);
    });
    
    // Seed with the same default data as production (synchronous version)
    seedTestDatabase(testDb!);
  });
  
  testDbInitialized = true;
  return testDb;
}

/**
 * Synchronous seeding for test database using the same data as production
 */
function seedTestDatabase(db: sqlite3.Database): void {
  const now = Date.now();
  
  try {
    let shipIdCounter = 0;
    
    // Precomputed password hashes for test consistency (bcrypt with 10 rounds)
    const passwordHashes: Record<string, string> = {
      'a': '$2b$10$0q/od18qjo/fyCB8b.Dn2OZdKs1pKAOPwly98WEZzbsT.yavE6BY.',
      'dummy': '$2b$10$GJ2Bjb5Ruhd1hCnDxzEzxOmDAlgIy9.0ci11khzvsH0ta7q17K4ay',
    };
    
    // Create ships and users for all DEFAULT_USERS
    DEFAULT_USERS.forEach((user) => {
      // Create ship for this user
      db.run(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['player_ship', user.ship.x, user.ship.y, user.ship.speed, user.ship.angle, now]);
      
      shipIdCounter++;
      const shipId = shipIdCounter; // Ships get sequential IDs starting from 1
      
      // Get precomputed hash for this user's password
      const hashedPassword = passwordHashes[user.password] || passwordHashes['a']; // Fallback to 'a' hash
      const techTreeJson = JSON.stringify(user.tech_tree);
      
      // Get defense values from user or use defaults
      const hullCurrent = user.defense?.hull_current ?? 250.0;
      const armorCurrent = user.defense?.armor_current ?? 250.0;
      const shieldCurrent = user.defense?.shield_current ?? 250.0;
      
      // Build INSERT statement based on what optional fields are provided
      const columns = ['username', 'password_hash', 'iron', 'last_updated', 'tech_tree', 'ship_id', 'hull_current', 'armor_current', 'shield_current', 'defense_last_regen'];
      const values: (string | number)[] = [
        user.username,
        hashedPassword,
        user.iron,
        Math.floor(now / 1000),
        techTreeJson,
        shipId,
        hullCurrent,
        armorCurrent,
        shieldCurrent,
        Math.floor(now / 1000)
      ];
      
      // Add tech_counts if provided
      if (user.tech_counts) {
        columns.push(
          'pulse_laser', 'auto_turret', 'plasma_lance', 'gauss_rifle', 
          'photon_torpedo', 'rocket_launcher', 'ship_hull', 'kinetic_armor', 
          'energy_shield', 'missile_jammer'
        );
        values.push(
          user.tech_counts.pulse_laser,
          user.tech_counts.auto_turret,
          user.tech_counts.plasma_lance,
          user.tech_counts.gauss_rifle,
          user.tech_counts.photon_torpedo,
          user.tech_counts.rocket_launcher,
          user.tech_counts.ship_hull,
          user.tech_counts.kinetic_armor,
          user.tech_counts.energy_shield,
          user.tech_counts.missile_jammer
        );
      }
      
      const insertSQL = `
        INSERT INTO users (${columns.join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})
      `;
      
      // Create user
      db.run(insertSQL, values);
    });
    
    // Create other space objects (asteroids, shipwrecks, escape pods)
    DEFAULT_SPACE_OBJECTS.forEach((obj) => {
      db.run(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [obj.type, obj.x, obj.y, obj.speed, obj.angle, now]);
    });
    
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
  }
}

export async function getDatabase(): Promise<sqlite3.Database> {
  // Use in-memory database for tests
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase();
  }

  // If database is already initialized, return it immediately
  if (db) {
    return db;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = new Promise<sqlite3.Database>((resolve, reject) => {
    const dbDir = path.join(process.cwd(), 'database');
    const dbPath = path.join(dbDir, 'users.db');
    
    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      console.log('📁 Creating database directory...');
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const dbExists = fs.existsSync(dbPath);
    
    db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('❌ Error opening database:', err);
        initializationPromise = null;
        db = null;
        reject(err);
        return;
      }
      
      console.log('✅ Connected to SQLite database at:', dbPath);
      
      // Set PRAGMA synchronous = FULL to ensure data is written to disk immediately
      db!.run('PRAGMA synchronous = FULL', (pragmaErr) => {
        if (pragmaErr) {
          console.error('⚠️ Warning: Failed to set PRAGMA synchronous:', pragmaErr);
        } else {
          console.log('💾 Database synchronous mode set to FULL');
        }
      });
      
      try {
        if (!dbExists) {
          console.log('🆕 New database detected, initializing...');
          await initializeDatabase(db!);
        } else {
          console.log('📊 Existing database detected, checking for migrations...');
          await applyTechMigrations(db!);
        }
        

        
        // Don't clear initializationPromise - it's still valid
        resolve(db!);
      } catch (initError) {
        console.error('❌ Database initialization failed:', initError);
        initializationPromise = null;
        db = null;
        reject(initError);
      }
    });
  });

  return initializationPromise;
}

async function initializeDatabase(database: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🏗️ Creating database tables...');
    
    // Run table creation statements
    let completedTables = 0;
    const totalTables = CREATE_TABLES.length;
    
    CREATE_TABLES.forEach((tableSQL, index) => {
      database.run(tableSQL, (err) => {
        if (err) {
          console.error(`❌ Error creating table ${index + 1}:`, err);
          reject(err);
          return;
        }
        
        completedTables++;
        console.log(`✅ Created table ${completedTables}/${totalTables}`);
        
        if (completedTables === totalTables) {
          console.log('🌱 Tables created, seeding initial data...');
          seedDatabase(database)
            .then(() => {
              console.log('✅ Database initialization complete!');
              resolve();
            })
            .catch((seedErr) => {
              console.error('❌ Error seeding database:', seedErr);
              reject(seedErr);
            });
        }
      });
    });
  });
}

export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

/**
 * Closes the test database (for cleanup in tests)
 */
export async function closeTestDatabase(): Promise<void> {
  if (testDb && process.env.NODE_ENV === 'test') {
    return new Promise((resolve, reject) => {
      testDb!.close((err) => {
        if (err) {
          reject(err);
        } else {
          testDb = null;
          resolve();
        }
      });
    });
  }
}

/**
 * Resets the test database to fresh state
 */
export function resetTestDatabase(): void {
  if (process.env.NODE_ENV === 'test') {
    testDb = null;
    testDbInitialized = false;
    // Next call to getDatabase() will create a fresh database
  }
}
