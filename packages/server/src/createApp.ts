// ---
// File responsibilities:
// Provides a function to create the Express application, wiring up all API routes and middleware, and allowing the database to be injected for flexibility and testability.
// ---

import express from 'express';
import session from 'express-session';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { getUserById, getUserByUsername, createUser, saveUserToDb } from './userRepo';
import { loadWorld, saveWorldToDb } from './worldRepo';
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType, triggerResearch, TechTree, getResearchEffectFromTree } from './techtree';
import { calculateToroidalDistance } from '@spacewars-ironcore/shared';

// Extend express-session to include userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export function createApp(db: sqlite3.Database) {
  const app = express();
  app.use(express.json());
  
  // Configure CORS for both development and production
  const allowedOrigins = [
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:5173',
    'https://spacewars-ironcore-q7n3.onrender.com'
  ];
  
  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  }));

  // Register endpoint
  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    
    try {
      // Hash password with automatic salt generation
      const hash = await bcrypt.hash(password, 10);
      
      const user = await createUser(db, username, hash, saveUserToDb(db));
      req.session.userId = user.id;
      console.log(`🔐 Register - Setting session userId: ${user.id} for user: ${username}`);
      res.json({ success: true });
    } catch (e) {
      console.error('User creation error:', e);
      if (e instanceof Error && e.message && e.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Username taken' });
      } else if (typeof e === 'object' && e !== null && 'message' in e && 
                 typeof e.message === 'string' && e.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Username taken' });
      } else if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: 'Username taken' });
      } else {
        console.error('User creation error:', e);
        res.status(500).json({ error: 'Server error' });
      }
    }
  });

  // Login endpoint
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    
    try {
      const user = await getUserByUsername(db, username, saveUserToDb(db));
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      bcrypt.compare(password, user.password_hash, async (err, result) => {
        if (err) {
          console.error('Password comparison error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (result) {
          const now = Math.floor(Date.now() / 1000);
          user.updateStats(now);
          await user.save();
          req.session.userId = user.id;
          console.log(`🔐 Login - Setting session userId: ${user.id} for user: ${username}`);
          res.json({ success: true });
        } else {
          res.status(400).json({ error: 'Invalid credentials' });
        }
      });
    } catch (e) {
      console.error('Login error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Session check
  app.get('/api/session', (req, res) => {
    console.log(`🔍 Session check - userId in session: ${req.session.userId}`);
    if (req.session.userId) {
      db.get('SELECT username, ship_id FROM users WHERE id = ?', [req.session.userId], (err, userRow) => {
        const user = userRow as { username: string; ship_id: number };
        if (user) {
          console.log(`✅ Session valid - user: ${user.username}, shipId: ${user.ship_id}`);
          return res.json({ loggedIn: true, username: user.username, shipId: user.ship_id });
        }
        console.log(`❌ Session invalid - user not found for userId: ${req.session.userId}`);
        res.json({ loggedIn: false });
      });
    } else {
      console.log(`❌ Session invalid - no userId in session`);
      res.json({ loggedIn: false });
    }
  });

  // Logout
  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Get user stats endpoint
  app.get('/api/user-stats', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const user = await getUserById(db, req.session.userId, saveUserToDb(db));
      if (!user) return res.status(404).json({ error: 'User not found' });
      const now = Math.floor(Date.now() / 1000);
      user.updateStats(now);
      await user.save();
      
      const responseData = { 
        iron: user.iron, 
        last_updated: user.last_updated, 
        ironPerSecond: user.getIronPerSecond() 
      };
      
      res.json(responseData);
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get tech tree and research details endpoint
  app.get('/api/techtree', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const user = await getUserById(db, req.session.userId, saveUserToDb(db));
      if (!user) return res.status(404).json({ error: 'User not found' });
      // Build research definitions with next upgrade cost/duration for the user
      const researches: Record<string, {
        name: string;
        description: string;
        nextUpgradeCost: number;
        nextUpgradeDuration: number;
        currentEffect: number;
        nextEffect: number;
      }> = {};
      (Object.values(ResearchType) as ResearchType[]).forEach(type => {
        const research = AllResearches[type];
        const key = research.treeKey as keyof typeof user.techTree;
        const currentLevel = user.techTree[key];
        const nextLevel = typeof currentLevel === 'number' ? currentLevel + 1 : 1;
        researches[type] = {
          ...research,
          nextUpgradeCost: getResearchUpgradeCost(research, nextLevel),
          nextUpgradeDuration: getResearchUpgradeDuration(research, nextLevel),
          currentEffect: getResearchEffect(research, typeof currentLevel === 'number' ? currentLevel : 0),
          nextEffect: getResearchEffect(research, nextLevel),
        };
      });
      res.json({
        techTree: user.techTree,
        researches
      });
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Trigger research endpoint
  app.post('/api/trigger-research', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { type } = req.body;
    if (!type) return res.status(400).json({ error: 'Missing research type' });
    try {
      const user = await getUserById(db, req.session.userId, saveUserToDb(db));
      if (!user) return res.status(404).json({ error: 'User not found' });
      const now = Math.floor(Date.now() / 1000);
      user.updateStats(now);
      if (user.techTree.activeResearch) {
        return res.status(400).json({ error: 'Research already in progress' });
      }
      if (!Object.values(ResearchType).includes(type)) {
        return res.status(400).json({ error: 'Invalid research type' });
      }
      const research = AllResearches[type as ResearchType];
      const key = research.treeKey as keyof TechTree;
      const currentLevel = user.techTree[key];
      if (typeof currentLevel !== 'number') {
        return res.status(500).json({ error: 'Invalid tech tree state' });
      }
      const cost = getResearchUpgradeCost(research, currentLevel + 1);
      if (user.iron < cost) {
        return res.status(400).json({ error: 'Not enough iron' });
      }
      user.iron -= cost;
      triggerResearch(user.techTree, type);
      await user.save();
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get ship stats endpoint - returns current ship position, speed, angle, and max speed
  app.get('/api/ship-stats', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
      // Load user and world data
      const user = await getUserById(db, req.session.userId, saveUserToDb(db));
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const world = await loadWorld(db, saveWorldToDb(db));
      
      // Update physics for all objects first
      const currentTime = Date.now();
      world.updatePhysics(currentTime);
      
      // Find player's ship in the world
      const playerShips = world.getSpaceObjectsByType('player_ship');
      const playerShip = playerShips.find(ship => ship.id === user.ship_id);
      
      if (!playerShip) {
        return res.status(404).json({ error: 'Player ship not found' });
      }
      
      // Calculate max speed from tech tree
      const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
      const afterburnerBonus = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
      const maxSpeed = baseSpeed * (1 + afterburnerBonus / 100);
      
      const responseData = {
        x: playerShip.x,
        y: playerShip.y,
        speed: playerShip.speed,
        angle: playerShip.angle,
        maxSpeed: maxSpeed,
        last_position_update_ms: playerShip.last_position_update_ms
      };
      
      // console.log(`📤 Sending ship stats response:`, responseData);
      
      res.json(responseData);
      
    } catch (error) {
      console.error('❌ Ship stats error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get world data endpoint - retrieves and updates all space objects
  app.get('/api/world', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    // console.log(`🌍 World data request - userId: ${req.session.userId}`);

    try {
      // Load world data from database
      const world = await loadWorld(db, saveWorldToDb(db));
      
      // Update physics for all objects
      const currentTime = Date.now();
      world.updatePhysics(currentTime);
      
      // Log all ships in the world for debugging
      // const ships = world.getSpaceObjectsByType('player_ship');
      // console.log(`🚢 All ships in world (${ships.length} total):`);
      // ships.forEach(ship => {
      //   console.log(`  Ship ID: ${ship.id}, position: (${ship.x}, ${ship.y}), speed: ${ship.speed}, angle: ${ship.angle}, lastUpdate: ${ship.last_position_update_ms}`);
      // });
      
      // // Log total object counts
      // const objectCounts = world.spaceObjects.reduce((counts: Record<string, number>, obj) => {
      //   counts[obj.type] = (counts[obj.type] || 0) + 1;
      //   return counts;
      // }, {});
      // console.log(`📊 Object counts:`, objectCounts);
      
      // Save updated positions back to database
      await world.save();
      
      // Return world data
      const worldData = world.getWorldData();
      res.json(worldData);
      
    } catch (error) {
      console.error('❌ World data error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Collect space object endpoint - allows players to collect asteroids, wrecks, and escape pods
  app.post('/api/collect', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    
    const { objectId } = req.body;
    if (!objectId) return res.status(400).json({ error: 'Missing object ID' });
    
    try {
      // Load user and world data
      const user = await getUserById(db, req.session.userId, saveUserToDb(db));
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const world = await loadWorld(db, saveWorldToDb(db));
      
      // Update physics for all objects first
      const currentTime = Date.now();
      world.updatePhysics(currentTime);
      
      // Find the object to collect
      const targetObject = world.getSpaceObject(objectId);
      if (!targetObject) {
        return res.status(404).json({ error: 'Object not found' });
      }
      
      // Check if object is collectible
      if (targetObject.type === 'player_ship') {
        return res.status(400).json({ error: 'Cannot collect player ships' });
      }
      
      // Find player's ship in the world
      const playerShips = world.getSpaceObjectsByType('player_ship');
      const playerShip = playerShips.find(ship => ship.id === user.ship_id);
      
      if (!playerShip) {
        return res.status(404).json({ error: 'Player ship not found' });
      }
      
      // Calculate distance between player ship and target object using toroidal distance
      const distance = calculateToroidalDistance(
        playerShip,
        targetObject,
        world.worldSize
      );
      
      // Check if within collection range (125 units)
      if (distance > 125) {
        return res.status(400).json({ error: 'Object too far away' });
      }
      
      // Collect the object
      user.collected(targetObject.type);
      await world.collected(objectId);
      
      // Save changes
      await user.save();
      await world.save();
      
      res.json({ success: true, distance });
      
    } catch (error) {
      console.error('Collection error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Navigate ship endpoint - allows players to change their ship's speed and/or angle
  app.post('/api/navigate', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    
    const { speed, angle } = req.body;
    // Must provide at least one parameter
    if (speed === undefined && angle === undefined) {
      return res.status(400).json({ error: 'Must provide speed and/or angle' });
    }
    
    try {
      // Load user and world data
      const user = await getUserById(db, req.session.userId, saveUserToDb(db));
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const world = await loadWorld(db, saveWorldToDb(db));
      
      // Update physics for all objects first
      const currentTime = Date.now();
      world.updatePhysics(currentTime);
      
      // Find player's ship in the world
      const playerShips = world.getSpaceObjectsByType('player_ship');
      const playerShip = playerShips.find(ship => ship.id === user.ship_id);
      
      if (!playerShip) {
        return res.status(404).json({ error: 'Player ship not found' });
      }
      
      // Calculate max speed from tech tree
      const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
      const afterburnerBonus = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
      const maxSpeed = baseSpeed * (1 + afterburnerBonus / 100);
      
      // Validate and update speed if provided
      let newSpeed = playerShip.speed;
      if (speed !== undefined) {
        if (typeof speed !== 'number' || speed < 0) {
          return res.status(400).json({ error: 'Speed must be a non-negative number' });
        }
        if (speed > maxSpeed) {
          return res.status(400).json({ error: `Speed cannot exceed ${maxSpeed.toFixed(1)} units` });
        }
        newSpeed = speed;
      }
      
      // Validate and update angle if provided
      let newAngle = playerShip.angle;
      if (angle !== undefined) {
        if (typeof angle !== 'number') {
          return res.status(400).json({ error: 'Angle must be a number' });
        }
        // Normalize angle to 0-360 degrees
        newAngle = ((angle % 360) + 360) % 360;
      }
      
      // Update ship's speed and angle
      await world.updateSpaceObject(playerShip.id, {
        speed: newSpeed,
        angle: newAngle,
        last_position_update_ms: currentTime
      });
      
      // Save changes
      await world.save();
      
      res.json({ 
        success: true, 
        speed: newSpeed, 
        angle: newAngle,
        maxSpeed: maxSpeed
      });
      
    } catch (error) {
      console.error('❌ Navigation error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return app;
}
