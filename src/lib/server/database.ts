import { Pool, PoolClient } from 'pg';
import { CREATE_TABLES } from './schema';
import { seedDatabase, DEFAULT_USERS, DEFAULT_SPACE_OBJECTS } from './seedData';
import { applyTechMigrations } from './migrations';

// Database connection pool
let pool: Pool | null = null;
let initializationPromise: Promise<Pool> | null = null;

// Test database management
let testPool: Pool | null = null;
let testDbInitialized = false;

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
 * Initialize the test database with tables and seed data
 */
async function initializeTestDatabase(): Promise<Pool> {
  if (testPool && testDbInitialized) {
    return testPool;
  }
  
  const config = getDatabaseConfig();
  testPool = new Pool(config);
  
  const client = await testPool.connect();
  try {
    // Clean up any existing data
    await client.query('DROP TABLE IF EXISTS battles CASCADE');
    await client.query('DROP TABLE IF EXISTS messages CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS space_objects CASCADE');
    
    // Create tables
    for (const createTableSQL of CREATE_TABLES) {
      await client.query(createTableSQL);
    }
    
    // Seed with the same default data as production
    await seedTestDatabase(client);
    
    testDbInitialized = true;
  } finally {
    client.release();
  }
  
  return testPool;
}

/**
 * Seeding for test database using the same data as production
 */
async function seedTestDatabase(client: PoolClient): Promise<void> {
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
      const shipResult = await client.query(
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
      
      await client.query(insertSQL, values);
    }
    
    // Create other space objects (asteroids, shipwrecks, escape pods)
    for (const obj of DEFAULT_SPACE_OBJECTS) {
      await client.query(
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
    const config = getDatabaseConfig();
    pool = new Pool(config);
    
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
export function resetTestDatabase(): void {
  if (process.env.NODE_ENV === 'test') {
    testPool = null;
    testDbInitialized = false;
    // Next call to getDatabase() will create a fresh database
  }
}
