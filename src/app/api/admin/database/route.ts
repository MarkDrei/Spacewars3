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
    const db = getDatabase();
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
          tech_tree, build_queue, build_start_sec
        FROM users 
        ORDER BY id
      `, [], (err, rows) => {
        if (err) return reject(err);
        
        const userData = (rows as Array<{
          id: number;
          username: string;
          iron: number;
          last_updated: number;
          tech_tree: string;
          build_queue: string | null;
          build_start_sec: number | null;
        }>).map(row => {
          // Parse tech tree to extract individual tech levels
          let techTree: Record<string, number> = {};
          try {
            techTree = row.tech_tree ? JSON.parse(row.tech_tree) : {};
          } catch {
            techTree = {};
          }
          
          return {
            id: row.id,
            username: row.username,
            iron: row.iron,
            pulse_laser: techTree['pulse_laser'] || 0,
            auto_turret: techTree['auto_turret'] || 0,
            plasma_lance: techTree['plasma_lance'] || 0,
            gauss_rifle: techTree['gauss_rifle'] || 0,
            photon_torpedo: techTree['photon_torpedo'] || 0,
            rocket_launcher: techTree['rocket_launcher'] || 0,
            ship_hull: techTree['ship_hull'] || 0,
            kinetic_armor: techTree['kinetic_armor'] || 0,
            energy_shield: techTree['energy_shield'] || 0,
            missile_jammer: techTree['missile_jammer'] || 0,
            build_queue: row.build_queue,
            build_start_sec: row.build_start_sec,
            last_updated: row.last_updated
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