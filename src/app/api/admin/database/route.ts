import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { getDatabase } from '@/lib/server/database';
import { getUserById } from '@/lib/server/userRepo';

interface UserData {
  id: number;
  username: string;
  iron: number;
  pulse_laser: number;
  auto_turret: number;
  plasma_lance: number;
  gauss_rifle: number;
  photon_torpedo: number;
  rocket_launcher: number;
  ship_hull: number;
  kinetic_armor: number;
  energy_shield: number;
  missile_jammer: number;
  build_queue: string | null;
  build_start_sec: number | null;
  last_updated: number;
  // Tech tree / Research levels - all research data
  researches: Record<string, number>;
}

interface SpaceObject {
  id: number;
  x: number;
  y: number;
  type: string;
  speed: number;
  angle: number;
  last_position_update_ms: number;
}

interface AdminData {
  users: UserData[];
  spaceObjects: SpaceObject[];
  totalUsers: number;
  totalObjects: number;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get user data to check username for admin access
    const db = await getDatabase();
    const userData = await getUserById(db, session.userId!);
    if (!userData) {
      throw new ApiError(404, 'User not found');
    }
    
    // Admin access restricted to developers (users 'a' and 'q')
    if (userData.username !== 'a' && userData.username !== 'q') {
      throw new ApiError(403, 'Admin access restricted to developers');
    }
    
    // CRITICAL: Flush all cache data to database before reading
    // This ensures the admin page shows current values, not stale cached data
    const { getTypedCacheManager } = await import('@/lib/server/typedCacheManager');
    const cacheManager = getTypedCacheManager();
    if (cacheManager.isReady) {
      await cacheManager.flushAllToDatabase();
      console.log('✅ Cache flushed to database for admin query');
    }
    
    // Get all users data
    const users = await new Promise<UserData[]>((resolve, reject) => {
      db.all(`
        SELECT 
          id, username, iron, last_updated,
          build_queue, build_start_sec,
          pulse_laser, auto_turret, plasma_lance, gauss_rifle,
          photon_torpedo, rocket_launcher,
          ship_hull, kinetic_armor, energy_shield, missile_jammer,
          tech_tree
        FROM users 
        ORDER BY id
      `, [], (err, rows) => {
        if (err) return reject(err);
        
        const userData = (rows as Array<{
          id: number;
          username: string;
          iron: number;
          last_updated: number;
          build_queue: string | null;
          build_start_sec: number | null;
          pulse_laser: number;
          auto_turret: number;
          plasma_lance: number;
          gauss_rifle: number;
          photon_torpedo: number;
          rocket_launcher: number;
          ship_hull: number;
          kinetic_armor: number;
          energy_shield: number;
          missile_jammer: number;
          tech_tree: string;
        }>).map(row => {
          // Parse tech tree to extract ALL research levels
          let researches: Record<string, number> = {};
          try {
            if (row.tech_tree) {
              const parsed = JSON.parse(row.tech_tree);
              // Extract only numeric values (research levels), exclude activeResearch and other non-numeric fields
              for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === 'number') {
                  researches[key] = value;
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse tech_tree for user', row.id, e);
            researches = {};
          }
          
          return {
            id: row.id,
            username: row.username,
            iron: row.iron,
            pulse_laser: row.pulse_laser || 0,
            auto_turret: row.auto_turret || 0,
            plasma_lance: row.plasma_lance || 0,
            gauss_rifle: row.gauss_rifle || 0,
            photon_torpedo: row.photon_torpedo || 0,
            rocket_launcher: row.rocket_launcher || 0,
            ship_hull: row.ship_hull || 0,
            kinetic_armor: row.kinetic_armor || 0,
            energy_shield: row.energy_shield || 0,
            missile_jammer: row.missile_jammer || 0,
            build_queue: row.build_queue,
            build_start_sec: row.build_start_sec,
            last_updated: row.last_updated,
            // All research levels from tech_tree JSON
            researches
          };
        });
        
        resolve(userData);
      });
    });

    // Get all space objects
    const spaceObjects = await new Promise<SpaceObject[]>((resolve, reject) => {
      db.all(`
        SELECT id, x, y, type, speed, angle, last_position_update_ms
        FROM space_objects 
        ORDER BY id
      `, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows as SpaceObject[]);
      });
    });

    const adminData: AdminData = {
      users,
      spaceObjects,
      totalUsers: users.length,
      totalObjects: spaceObjects.length,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(adminData);
    
  } catch (error) {
    return handleApiError(error);
  }
}