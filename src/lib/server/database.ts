import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES } from './schema';
import { seedDatabase, DEFAULT_USERS, DEFAULT_SPACE_OBJECTS } from './seedData';
import bcrypt from 'bcrypt';

let db: sqlite3.Database | null = null;
let isInitializing = false;

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
    // Create space objects first (including player ship)
    let shipId: number | null = null;
    
    // Create ship for the default user
    const user = DEFAULT_USERS[0];
    const shipResult = db.run(`
      INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['player_ship', user.ship.x, user.ship.y, user.ship.speed, user.ship.angle, now]);
    
    // Get the ship ID (approximation for test - in real sync we'd need different approach)
    shipId = 1; // First inserted object gets ID 1
    
    // Create other space objects
    DEFAULT_SPACE_OBJECTS.forEach((obj) => {
      db.run(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [obj.type, obj.x, obj.y, obj.speed, obj.angle, now]);
    });
    
    // Create the default user with hashed password (sync version)
    const hashedPassword = '$2b$10$example.hash'; // Use fixed hash for tests
    const techTreeJson = JSON.stringify(user.tech_tree);
    
    db.run(`
      INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user.username, hashedPassword, user.iron, Math.floor(now / 1000), techTreeJson, shipId]);
    
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
  }
}

export function getDatabase(): sqlite3.Database {
  // Use in-memory database for tests
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase();
  }

  // Production database logic (unchanged)
  if (!db && !isInitializing) {
    isInitializing = true;
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
        isInitializing = false;
        throw err;
      } else {
        console.log('✅ Connected to SQLite database at:', dbPath);
        
        if (!dbExists) {
          console.log('🆕 New database detected, initializing...');
          await initializeDatabase(db!);
        }
        
        isInitializing = false;
      }
    });
  }
  
  // Wait for initialization to complete if it's happening
  if (isInitializing) {
    // Return a promise that resolves when initialization is done
    // For now, we'll return the db reference which will be ready shortly
    return db!;
  }
  
  return db!;
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
