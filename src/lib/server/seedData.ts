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
  tech_counts?: {
    // Weapons
    pulse_laser: number;
    auto_turret: number;
    plasma_lance: number;
    gauss_rifle: number;
    photon_torpedo: number;
    rocket_launcher: number;
    // Defense
    ship_hull: number;
    kinetic_armor: number;
    energy_shield: number;
    missile_jammer: number;
  };
  defense?: {
    hull_current: number;
    armor_current: number;
    shield_current: number;
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
    // tech_counts and defense values will use database defaults
  },
  {
    username: 'dummy',
    password: 'dummy',
    iron: 0,
    tech_tree: { ironHarvesting: 1, shipSpeed: 1, afterburner: 0 },
    ship: {
      x: 350,
      y: 350,
      speed: 0,
      angle: 0
    },
    tech_counts: {
      // Weapons
      pulse_laser: 1,
      auto_turret: 2,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      // Defense - 7 of each (results in max of 700)
      ship_hull: 7,
      kinetic_armor: 7,
      energy_shield: 7,
      missile_jammer: 7
    },
    defense: {
      hull_current: 350,  // Half of max (700 / 2)
      armor_current: 350,
      shield_current: 350
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

        const shipIds: (number | null)[] = [];
        let shipsCreated = 0;

        // Create ships for all users
        for (const user of DEFAULT_USERS) {
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
                shipIds.push(this.lastID);
                console.log(`✅ Created ship ${this.lastID} for user ${user.username}`);
                shipsCreated++;
                
                // Once all ships are created, create collectible objects and users
                if (shipsCreated === DEFAULT_USERS.length) {
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

                  // Create users after ships are created
                  setTimeout(async () => {
                    let usersCreated = 0;

                    for (let i = 0; i < DEFAULT_USERS.length; i++) {
                      const user = DEFAULT_USERS[i];
                      const shipId = shipIds[i];

                      // Hash password with automatic salt generation
                      const passwordHash = await bcrypt.hash(user.password, 10);
                      
                      // Build INSERT statement based on what optional fields are provided
                      const columns = ['username', 'password_hash', 'iron', 'last_updated', 'tech_tree', 'ship_id'];
                      const values = [
                        user.username,
                        passwordHash,
                        user.iron,
                        now / 1000, // Convert to seconds
                        JSON.stringify(user.tech_tree),
                        shipId
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
                      
                      // Add defense values if provided
                      if (user.defense) {
                        columns.push('hull_current', 'armor_current', 'shield_current', 'defense_last_regen');
                        values.push(
                          user.defense.hull_current,
                          user.defense.armor_current,
                          user.defense.shield_current,
                          now / 1000 // defense_last_regen
                        );
                      }
                      
                      const insertSQL = `
                        INSERT INTO users (${columns.join(', ')})
                        VALUES (${columns.map(() => '?').join(', ')})
                      `;

                      const insertUser = db.prepare(insertSQL);
                      
                      insertUser.run(
                        ...values,
                        (userErr: Error | null) => {
                          if (userErr) {
                            console.error(`❌ Error creating user ${user.username}:`, userErr);
                            reject(userErr);
                          } else {
                            const techInfo = user.tech_counts 
                              ? ` (tech_counts: hull=${user.tech_counts.ship_hull}, armor=${user.tech_counts.kinetic_armor}, shield=${user.tech_counts.energy_shield})`
                              : '';
                            const defenseInfo = user.defense 
                              ? ` (defense: ${user.defense.hull_current}/${user.defense.armor_current}/${user.defense.shield_current})`
                              : '';
                            console.log(`✅ Created user: ${user.username} with ship ID ${shipId}${techInfo}${defenseInfo}`);
                            usersCreated++;
                            
                            if (usersCreated === DEFAULT_USERS.length) {
                              insertUser.finalize();
                              console.log(`✅ Seeded ${DEFAULT_USERS.length} users and ${DEFAULT_SPACE_OBJECTS.length + DEFAULT_USERS.length} space objects for 500x500 world`);
                              resolve();
                            }
                          }
                        }
                      );
                      
                      insertUser.finalize();
                    }
                  }, 50); // Small delay to ensure space objects are created
                }
              }
            }
          );
        }

      } catch (error) {
        console.error('❌ Error seeding database:', error);
        reject(error);
      }
    });
  });
}
