import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

export interface SeedUser {
  username: string;
  password: string; // Plain text, will be hashed
  iron: number;
  tech_tree: Record<string, number>;
  ship: {
    x: number;
    y: number;
    speed: number;
    angle: number;
  };
}

export interface SeedSpaceObject {
  type: 'asteroid' | 'shipwreck' | 'escape_pod';
  x: number;
  y: number;
  speed: number;
  angle: number;
}

export const DEFAULT_USERS: SeedUser[] = [
  {
    username: 'a',
    password: 'a',
    iron: 1000,
    tech_tree: { ironHarvesting: 1, shipSpeed: 1, afterburner: 0 },
    ship: {
      x: 250, // Center of 500x500 world
      y: 250,
      speed: 0,
      angle: 0
    }
  }
];

export const DEFAULT_SPACE_OBJECTS: SeedSpaceObject[] = [
  // Asteroids - scattered around the 500x500 world
  { type: 'asteroid', x: 100, y: 150, speed: 10, angle: 0 },
  { type: 'asteroid', x: 400, y: 300, speed: 15, angle: 45 },
  { type: 'asteroid', x: 350, y: 100, speed: 20, angle: 77 },
  { type: 'asteroid', x: 150, y: 400, speed: 10, angle: 173 },
  { type: 'asteroid', x: 450, y: 450, speed: 13, angle: 283 },
  
  // Shipwrecks - fewer, more valuable
  { type: 'shipwreck', x: 200, y: 350, speed: 8, angle: 123 },
  { type: 'shipwreck', x: 350, y: 200, speed: 23, angle: 211 },
  
  // Escape pods - rare, high value
  { type: 'escape_pod', x: 100, y: 300, speed: 30, angle: 115 },
  { type: 'escape_pod', x: 400, y: 150, speed: 45, angle: 95 }
];

export async function seedDatabase(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if database already has data
    db.get('SELECT COUNT(*) as count FROM users', async (err, row: { count: number } | undefined) => {
      if (err) {
        reject(err);
        return;
      }
      
      const userCount = row?.count || 0;
      if (userCount > 0) {
        console.log('📊 Database already has users, skipping seed');
        resolve();
        return;
      }

      console.log('🌱 Seeding default data...');

      try {
        const now = Date.now();
        
        // First, seed space objects (including player ships)
        const insertSpaceObject = db.prepare(`
          INSERT INTO space_objects (type, x, y, speed, angle, last_position_update_ms)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        let shipId: number | null = null;

        // Create ship for user
        const user = DEFAULT_USERS[0];
        insertSpaceObject.run(
          'player_ship',
          user.ship.x,
          user.ship.y,
          user.ship.speed,
          user.ship.angle,
          now,
          function(this: sqlite3.RunResult, err: Error | null) {
            if (err) {
              console.error(`❌ Error creating ship for user ${user.username}:`, err);
              reject(err);
            } else {
              shipId = this.lastID;
              console.log(`✅ Created ship ${this.lastID} for user ${user.username}`);
              
              // Create collectible objects
              for (const obj of DEFAULT_SPACE_OBJECTS) {
                insertSpaceObject.run(
                  obj.type,
                  obj.x,
                  obj.y,
                  obj.speed,
                  obj.angle,
                  now,
                  (objectErr: Error | null) => {
                    if (objectErr) {
                      console.error(`❌ Error creating space object ${obj.type}:`, objectErr);
                    } else {
                      console.log(`✅ Created ${obj.type} at (${obj.x}, ${obj.y})`);
                    }
                  }
                );
              }

              insertSpaceObject.finalize();

              // Create user after ship is created
              setTimeout(async () => {
                const insertUser = db.prepare(`
                  INSERT INTO users (username, password_hash, iron, last_updated, tech_tree, ship_id)
                  VALUES (?, ?, ?, ?, ?, ?)
                `);

                // Hash password with automatic salt generation
                const passwordHash = await bcrypt.hash(user.password, 10);
                
                insertUser.run(
                  user.username,
                  passwordHash,
                  user.iron,
                  now / 1000, // Convert to seconds
                  JSON.stringify(user.tech_tree),
                  shipId,
                  (userErr: Error | null) => {
                    if (userErr) {
                      console.error(`❌ Error creating user ${user.username}:`, userErr);
                      reject(userErr);
                    } else {
                      console.log(`✅ Created user: ${user.username} with ship ID ${shipId}`);
                      insertUser.finalize();
                      console.log(`✅ Seeded 1 user and ${DEFAULT_SPACE_OBJECTS.length + 1} space objects for 500x500 world`);
                      resolve();
                    }
                  }
                );
              }, 50); // Small delay to ensure space objects are created
            }
          }
        );

      } catch (error) {
        console.error('❌ Error seeding database:', error);
        reject(error);
      }
    });
  });
}
