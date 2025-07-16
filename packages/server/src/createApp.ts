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
import { AllResearches, getResearchUpgradeCost, getResearchUpgradeDuration, getResearchEffect, ResearchType, triggerResearch, TechTree } from './techtree';

// Extend express-session to include userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export function createApp(db: sqlite3.Database) {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    credentials: true
  }));
  app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
  }));

  // Register endpoint
  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    
    bcrypt.hash(password, 10, async (err, hash) => {
      if (err) {
        console.error('Password hashing error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      try {
        const user = await createUser(db, username, hash, saveUserToDb(db));
        req.session.userId = user.id;
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
    if (req.session.userId) {
      db.get('SELECT username FROM users WHERE id = ?', [req.session.userId], (err, userRow) => {
        const user = userRow as { username: string };
        if (user) return res.json({ loggedIn: true, username: user.username });
        res.json({ loggedIn: false });
      });
    } else {
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
      res.json({ iron: user.iron, last_updated: user.last_updated, ironPerSecond: user.getIronPerSecond() });
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

  return app;
}
