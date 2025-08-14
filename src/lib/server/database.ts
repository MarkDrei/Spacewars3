import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES } from './schema';
import { seedDatabase } from './seedData';

let db: sqlite3.Database | null = null;
let isInitializing = false;

export function getDatabase(): sqlite3.Database {
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
