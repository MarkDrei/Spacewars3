import { Pool, PoolClient, QueryResult } from 'pg';
import { CREATE_TABLES_PG } from './schema-pg';
import { seedDatabase, DEFAULT_USERS, DEFAULT_SPACE_OBJECTS } from './seedData';
import { applyTechMigrations } from './migrations-pg';

let pool: Pool | null = null;
let initializationPromise: Promise<Pool> | null = null;

// Test database management
let testPool: Pool | null = null;
let testPoolInitialized = false;

/**
 * Initialize test database (in-memory equivalent for PostgreSQL is a separate test DB)
 */
async function initializeTestDatabase(): Promise<Pool> {
  if (testPool && testPoolInitialized) {
    return testPool;
  }
  
  // For tests, use a separate test database or in-memory simulation
  // For now, we'll use the same connection but with different schema
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/spacewars_test',
    max: 5,
  });
  
  // Create tables
  for (const createTableSQL of CREATE_TABLES_PG) {
    await testPool.query(createTableSQL);
  }
  
  // Seed with the same default data as production
  await seedTestDatabase(testPool);
  
  testPoolInitialized = true;
  return testPool;
}

/**
 * Synchronous seeding for test database using the same data as production
 */
async function seedTestDatabase(pool: Pool): Promise<void> {
  const now = Date.now();
  
  try {
    // Precomputed password hashes for test consistency (bcrypt with 10 rounds)
    const passwordHashes: Record<string, string> = {
      'a': '$2b$10$0q/od18qjo/fyCB8b.Dn2OZdKs1pKAOPwly98WEZzbsT.yavE6BY.',
      'dummy': '$2b$10$GJ2Bjb5Ruhd1hCnDxzEzxOmDAlgIy9.0ci11khzvsH0ta7q17K4ay',
    };
    
    // Create ships and users for all DEFAULT_USERS
    for (const user of DEFAULT_USERS) {
      // Create ship for this user
      const shipResult = await pool.query(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, ['player_ship', user.ship.x, user.ship.y, user.ship.speed, user.ship.angle, now]);
      
      const shipId = shipResult.rows[0].id;
      
      // Get precomputed hash for this user's password
      const hashedPassword = passwordHashes[user.password] || passwordHashes['a'];
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
      
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const insertSQL = `
        INSERT INTO users (${columns.join(', ')})
        VALUES (${placeholders})
      `;
      
      // Create user
      await pool.query(insertSQL, values);
    }
    
    // Create other space objects (asteroids, shipwrecks, escape pods)
    for (const obj of DEFAULT_SPACE_OBJECTS) {
      await pool.query(`
        INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [obj.type, obj.x, obj.y, obj.speed, obj.angle, now]);
    }
    
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<Pool> {
  // Use test database for tests
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase();
  }

  // If database is already initialized, return it immediately
  if (pool) {
    return pool;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/spacewars';
    
    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    console.log('✅ Connected to PostgreSQL database');
    
    try {
      // Check if tables exist
      const tableCheckResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      
      const dbExists = tableCheckResult.rows.length > 0;
      
      if (!dbExists) {
        console.log('🆕 New database detected, initializing...');
        await initializeDatabase(pool);
      } else {
        console.log('📊 Existing database detected, checking for migrations...');
        await applyTechMigrations(pool);
      }
      
      return pool;
    } catch (initError) {
      console.error('❌ Database initialization failed:', initError);
      initializationPromise = null;
      pool = null;
      throw initError;
    }
  })();

  return initializationPromise;
}

async function initializeDatabase(pool: Pool): Promise<void> {
  console.log('🏗️ Creating database tables...');
  
  // Run table creation statements
  for (let i = 0; i < CREATE_TABLES_PG.length; i++) {
    const tableSQL = CREATE_TABLES_PG[i];
    try {
      await pool.query(tableSQL);
      console.log(`✅ Created table ${i + 1}/${CREATE_TABLES_PG.length}`);
    } catch (err) {
      console.error(`❌ Error creating table ${i + 1}:`, err);
      throw err;
    }
  }
  
  console.log('🌱 Tables created, seeding initial data...');
  await seedDatabase(pool);
  console.log('✅ Database initialization complete!');
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Closes the test database (for cleanup in tests)
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool && process.env.NODE_ENV === 'test') {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Resets the test database to fresh state
 */
export async function resetTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    if (testPool) {
      // Drop all tables in reverse order (respecting foreign keys)
      try {
        await testPool.query('DROP TABLE IF EXISTS battles CASCADE');
        await testPool.query('DROP TABLE IF EXISTS messages CASCADE');
        await testPool.query('DROP TABLE IF EXISTS users CASCADE');
        await testPool.query('DROP TABLE IF EXISTS space_objects CASCADE');
      } catch (error) {
        console.error('Error dropping tables:', error);
      }
    }
    testPool = null;
    testPoolInitialized = false;
    // Next call to getDatabase() will create a fresh database
  }
}

/**
 * PostgreSQL-compatible database interface that mimics sqlite3 API
 * This allows existing code to work with minimal changes
 */
export interface PgDatabase {
  get(sql: string, params: any[], callback: (err: Error | null, row?: any) => void): void;
  all(sql: string, params: any[], callback: (err: Error | null, rows?: any[]) => void): void;
  run(sql: string, params: any[], callback?: (this: { lastID?: number, changes?: number }, err: Error | null) => void): void;
  exec(sql: string, callback: (err: Error | null) => void): void;
}

/**
 * Create a PostgreSQL database wrapper that mimics sqlite3 API
 */
export async function getPgDatabaseWrapper(): Promise<PgDatabase> {
  const pool = await getDatabase();
  
  return {
    get(sql: string, params: any[], callback: (err: Error | null, row?: any) => void): void {
      // Convert ? placeholders to $1, $2, etc.
      const pgSql = convertPlaceholders(sql);
      pool.query(pgSql, params)
        .then((result: QueryResult) => {
          callback(null, result.rows[0]);
        })
        .catch((err: Error) => {
          callback(err);
        });
    },
    
    all(sql: string, params: any[], callback: (err: Error | null, rows?: any[]) => void): void {
      // Convert ? placeholders to $1, $2, etc.
      const pgSql = convertPlaceholders(sql);
      pool.query(pgSql, params)
        .then((result: QueryResult) => {
          callback(null, result.rows);
        })
        .catch((err: Error) => {
          callback(err);
        });
    },
    
    run(sql: string, params: any[], callback?: (this: { lastID?: number, changes?: number }, err: Error | null) => void): void {
      // Convert ? placeholders to $1, $2, etc.
      const pgSql = convertPlaceholders(sql);
      
      // Check if this is an INSERT that needs RETURNING id
      const needsReturning = /^\s*INSERT\s+INTO/i.test(sql) && !/RETURNING/i.test(sql);
      const finalSql = needsReturning ? `${pgSql} RETURNING id` : pgSql;
      
      pool.query(finalSql, params)
        .then((result: QueryResult) => {
          if (callback) {
            const context = {
              lastID: needsReturning && result.rows[0] ? result.rows[0].id : undefined,
              changes: result.rowCount || 0
            };
            callback.call(context, null);
          }
        })
        .catch((err: Error) => {
          if (callback) {
            callback.call({ lastID: undefined, changes: 0 }, err);
          }
        });
    },
    
    exec(sql: string, callback: (err: Error | null) => void): void {
      pool.query(sql)
        .then(() => {
          callback(null);
        })
        .catch((err: Error) => {
          callback(err);
        });
    }
  };
}

/**
 * Convert ? placeholders to $1, $2, $3, etc. for PostgreSQL
 */
function convertPlaceholders(sql: string): string {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}
