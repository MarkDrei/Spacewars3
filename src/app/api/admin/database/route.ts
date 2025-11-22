// ---
// Route to get complete database dump for admin users
// Used by admin dashboard to show full user and object data
//
// Access restricted to developer users only ('a' and 'q')
//
// CRITICAL: Flushes all cache data to database before reading
// to ensure admin page shows current values, not stale cached data
//
// CRITICAL: This is the only route that directly reads from the database
// ---

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/server/session';
import { handleApiError, requireAuth, ApiError } from '@/lib/server/errors';
import { getDatabase } from '@/lib/server/database';
import { getBattleCacheInitialized } from '@/lib/server/battle/BattleCache';
import type { Battle } from '@/lib/server/battle/battleTypes';
import { createLockContext, IronGuardManager, LOCK_2, LOCK_4 } from '@markdrei/ironguard-typescript-locks';
import { getUserWorldCache } from '@/lib/server/user/userCache';
import { a } from 'vitest/dist/chunks/suite.d.FvehnV49.js';

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
  battles: Battle[];
  totalUsers: number;
  totalObjects: number;
  totalBattles: number;
  timestamp: string;
}

export async function GET(request: NextRequest) {

  const debugInfo = IronGuardManager.getInstance().getGlobalLocks();

  console.log('🔒🔒🔒🔒 Active writers:', debugInfo.writers);
  console.log('🔒🔒🔒🔒 Active readers:', debugInfo.readers);
  console.log('🔒🔒🔒🔒 Pending writers:', debugInfo.pendingWriters);
  console.log('🔒🔒🔒🔒 Full debug info:', debugInfo);

  try {
    const session = await getIronSession<SessionData>(request, NextResponse.json({}), sessionOptions);
    requireAuth(session.userId);
    
    // Get user data to check username for admin access
    const emptyCtx = createLockContext();
    const userWorldCache = await getUserWorldCache(emptyCtx);
    return await emptyCtx.useLockWithAcquire(LOCK_4, async (userContext) => {
      const userData = await userWorldCache.getUserByIdWithLock(userContext, session.userId!);
      if (!userData) {
        throw new ApiError(404, 'User not found');
      }
      
      // Admin access restricted to developers (users 'a' and 'q')
      if (userData.username !== 'a' && userData.username !== 'q') {
        throw new ApiError(403, 'Admin access restricted to developers');
      }

      if (userData.username == 'a') {
        IronGuardManager.getInstance().enableDebugMode();
        console.log('🔒🔒 Active writers:', debugInfo.writers);
        console.log('🔒🔒 Active readers:', debugInfo.readers);
        console.log('🔒🔒 Pending writers:', debugInfo.pendingWriters);
        console.log('🔒🔒 Full debug info:', debugInfo);
      }

      
      // CRITICAL: Flush all cache data to database before reading
      // This ensures the admin page shows current values, not stale cached data
      if (userWorldCache.isReady) {
        await userWorldCache.flushAllToDatabase(userContext);
        console.log('✅ Cache flushed to database for admin query');
        // TODO: should probably also flush other caches (e.g. battle cache) if they exist
      }

      const db = await getDatabase();
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
  
      // Get all battles
      const cache = await getBattleCacheInitialized();
      const battles = await cache.getAllBattles();
  
      const adminData: AdminData = {
        users,
        spaceObjects,
        battles,
        totalUsers: users.length,
        totalObjects: spaceObjects.length,
        totalBattles: battles.length,
        timestamp: new Date().toISOString()
      };
  
      return NextResponse.json(adminData);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
