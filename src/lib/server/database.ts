import { Pool, PoolClient } from 'pg';
import { CREATE_TABLES } from './schema';
import { CREATE_TABLES_SQLITE } from './testSchemas';
import { seedDatabase, DEFAULT_USERS, DEFAULT_SPACE_OBJECTS } from './seedData';
import { applyTechMigrations } from './migrations';
import { DatabaseAdapter, PostgreSQLAdapter, SQLiteAdapter, QueryResult } from './databaseAdapter';

// Database connection pool (for production PostgreSQL)
let pool: Pool | null = null;
let initializationPromise: Promise<Pool> | null = null;

// Test database management (SQLite in-memory)
let testAdapter: SQLiteAdapter | null = null;
let testDbInitialized = false;

// Cached adapter for production
let productionAdapter: PostgreSQLAdapter | null = null;

/**
 * Type for the database - compatible interface for both PostgreSQL Pool and SQLite adapter
 * This allows any code using db.query() to work with both backends
 */
export interface DatabaseConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/**
 * Get database connection configuration from environment
 */
function getDatabaseConfig() {
  const isTest = process.env.NODE_ENV === 'test';
  
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: isTest 
      ? (process.env.POSTGRES_TEST_DB || 'spacewars_test')
      : (process.env.POSTGRES_DB || 'spacewars'),
    user: process.env.POSTGRES_USER || 'spacewars',
    password: process.env.POSTGRES_PASSWORD || 'spacewars',
    max: isTest ? 5 : 20, // Fewer connections for tests
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

/**
 * Initialize the test database with SQLite in-memory
 */
async function initializeTestDatabase(): Promise<DatabaseConnection> {
  if (testAdapter && testDbInitialized) {
    // Return existing adapter
    return testAdapter;
  }
  
  // Dynamic import of better-sqlite3 for tests only
  const BetterSqlite3 = (await import('better-sqlite3')).default;
  const db = new BetterSqlite3(':memory:');
  testAdapter = new SQLiteAdapter(db);
  
  // Create tables using SQLite-compatible schema
  for (const createTableSQL of CREATE_TABLES_SQLITE) {
    await testAdapter.query(createTableSQL);
  }
  
  // Seed with the same default data as production
  await seedTestDatabaseSQLite(testAdapter);
  
  testDbInitialized = true;
  
  return testAdapter;
}

/**
 * Seeding for test database (SQLite)
 */
async function seedTestDatabaseSQLite(adapter: SQLiteAdapter): Promise<void> {
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
      const shipResult = await adapter.query<{ id: number }>(
        `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        ['player_ship', user.ship.x, user.ship.y, user.ship.speed, user.ship.angle, now]
      );
      
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
      
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const insertSQL = `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders})`;
      
      await adapter.query(insertSQL, values);
    }
    
    // Create other space objects (asteroids, shipwrecks, escape pods)
    for (const obj of DEFAULT_SPACE_OBJECTS) {
      await adapter.query(
        `INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [obj.type, obj.x, obj.y, obj.speed, obj.angle, now]
      );
    }
    
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<DatabaseConnection> {
  // Use test database for tests - return SQLite adapter
  if (process.env.NODE_ENV === 'test') {
    return await initializeTestDatabase();
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
    const config = getDatabaseConfig();
    pool = new Pool(config);
    productionAdapter = new PostgreSQLAdapter(pool);
    
    console.log(`✅ Connected to PostgreSQL database: ${config.database}@${config.host}:${config.port}`);
    
    const client = await pool.connect();
    try {
      // Check if tables exist
      const tablesExist = await checkTablesExist(client);
      
      if (!tablesExist) {
        console.log('🆕 New database detected, initializing...');
        await initializeDatabase(client, pool);
      } else {
        console.log('📊 Existing database detected, checking for migrations...');
        await applyTechMigrations(pool);
      }
      
      return pool;
    } finally {
      client.release();
    }
  })();

  return initializationPromise;
}

async function checkTablesExist(client: PoolClient): Promise<boolean> {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    )
  `);
  return result.rows[0].exists;
}

async function initializeDatabase(client: PoolClient, pool: Pool): Promise<void> {
  console.log('🏗️ Creating database tables...');
  
  for (let i = 0; i < CREATE_TABLES.length; i++) {
    const tableSQL = CREATE_TABLES[i];
    await client.query(tableSQL);
    console.log(`✅ Created table ${i + 1}/${CREATE_TABLES.length}`);
  }
  
  console.log('🌱 Tables created, seeding initial data...');
  await seedDatabase(pool);
  console.log('✅ Database initialization complete!');
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    initializationPromise = null;
    productionAdapter = null;
  }
}

/**
 * Closes the test database (for cleanup in tests)
 */
export async function closeTestDatabase(): Promise<void> {
  if (testAdapter && process.env.NODE_ENV === 'test') {
    await testAdapter.close();
    testAdapter = null;
  }
}

/**
 * Resets the test database to fresh state
 */
export function resetTestDatabase(): void {
  if (process.env.NODE_ENV === 'test') {
    // Close existing connection if any
    if (testAdapter) {
      testAdapter.close().catch(() => {});
    }
    testAdapter = null;
    testDbInitialized = false;
    // Next call to getDatabase() will create a fresh database
  }
}

// Export the adapter interface for type usage
export type { DatabaseAdapter };
