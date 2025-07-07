// ---
// File responsibilities:
// Provides a function to create the Express application, wiring up all API routes and middleware, and allowing the database to be injected for flexibility and testability.
// ---

import express from 'express';
import session from 'express-session';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import cors from 'cors';

// Define User interface locally to avoid circular dependencies
export interface User {
  id: number;
  username: string;
  iron: number;
  lastUpdated: number;
}

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
    origin: 'http://localhost:3000',
    credentials: true
  }));
  app.use(session({
    secret: 'spacewars-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Authentication endpoints
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row: any) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      const passwordMatch = await bcrypt.compare(password, row.password_hash);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Set session
      req.session.userId = row.id;
      
      // Return user info (excluding password)
      const user: User = {
        id: row.id,
        username: row.username,
        iron: row.iron,
        lastUpdated: row.last_updated
      };
      
      res.json({ user });
    });
  });

  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if username already exists
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (row) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      
      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      const now = Math.floor(Date.now() / 1000);
      
      // Create new user
      db.run(
        'INSERT INTO users (username, password_hash, iron, last_updated) VALUES (?, ?, ?, ?)',
        [username, passwordHash, 0, now],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          const userId = this.lastID;
          req.session.userId = userId;
          
          const user: User = {
            id: userId,
            username,
            iron: 0,
            lastUpdated: now
          };
          
          res.status(201).json({ user });
        }
      );
    });
  });

  app.get('/api/user', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    db.get('SELECT id, username, iron, last_updated FROM users WHERE id = ?', [req.session.userId], (err, row: any) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user: User = {
        id: row.id,
        username: row.username,
        iron: row.iron,
        lastUpdated: row.last_updated
      };
      
      res.json({ user });
    });
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Game stats endpoints
  app.get('/api/stats', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    db.get('SELECT * FROM game_stats WHERE user_id = ?', [req.session.userId], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        // Create default stats if none exist
        const now = Math.floor(Date.now() / 1000);
        const defaultStats = {
          user_id: req.session.userId,
          score: 0,
          fuel: 0,
          weapons: 0,
          tech: 0,
          generic: 0,
          created_at: now
        };
        
        db.run(
          'INSERT INTO game_stats (user_id, score, fuel, weapons, tech, generic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [defaultStats.user_id, defaultStats.score, defaultStats.fuel, defaultStats.weapons, defaultStats.tech, defaultStats.generic, defaultStats.created_at],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            
            res.json({ stats: defaultStats });
          }
        );
      } else {
        res.json({ stats: row });
      }
    });
  });

  app.put('/api/stats', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { score, fuel, weapons, tech, generic } = req.body;
    
    db.run(
      'UPDATE game_stats SET score = ?, fuel = ?, weapons = ?, tech = ?, generic = ? WHERE user_id = ?',
      [score, fuel, weapons, tech, generic, req.session.userId],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Stats not found' });
        }
        
        res.json({ success: true });
      }
    );
  });

  return app;
}
