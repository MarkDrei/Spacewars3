import { describe, expect, test, afterAll, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/createApp';
import sqlite3 from 'sqlite3';
import { CREATE_TABLES } from '../src/schema';

let db: sqlite3.Database;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = new (sqlite3.verbose().Database)(':memory:');
  app = createApp(db);

  // Create tables using centralized schema
  const tables = CREATE_TABLES;
  await Promise.all(
    tables.map(
      (createTableSQL) =>
        new Promise<void>((resolve, reject) => {
          db.run(createTableSQL, (err) => {
            if (err) reject(err);
            else resolve();
          });
        })
    )
  );
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

describe('TechTree API', () => {
  let agent: ReturnType<typeof request.agent>;
  beforeEach(() => {
    agent = request.agent(app);
  });

  test('techtree_unauthenticated_returns401', async () => {
    const res = await agent.get('/api/techtree');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Not authenticated');
  });

  test('techtree_authenticated_returnsTechTreeAndResearches', async () => {
    // Register and login
    await agent.post('/api/register').send({ username: 'techtreeuser', password: 'pass' });
    const res = await agent.get('/api/techtree');
    expect(res.status).toBe(200);
    expect(res.body.techTree).toBeDefined();
    expect(res.body.researches).toBeDefined();
    expect(res.body.researches.IronHarvesting).toBeDefined();
    expect(res.body.researches.IronHarvesting.name).toBe('Iron Harvesting');
    // Should include all research fields
    expect(res.body.techTree.ironHarvesting).toBeGreaterThanOrEqual(1);
    expect(res.body.techTree.shipVelocity).toBeGreaterThanOrEqual(1);
    expect(res.body.techTree.afterburner).toBeGreaterThanOrEqual(0);
  });
});

describe('UserStats API', () => {
  let agent: ReturnType<typeof request.agent>;
  beforeEach(() => {
    agent = request.agent(app);
  });

  test('userStats_unauthenticated_returns401', async () => {
    const res = await agent.get('/api/user-stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Not authenticated');
  });

  test('userStats_authenticated_returnsStats', async () => {
    await agent.post('/api/register').send({ username: 'statsuser', password: 'pass' });
    const res = await agent.get('/api/user-stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.iron).toBe('number');
    expect(typeof res.body.last_updated).toBe('number');
    expect(typeof res.body.ironPerSecond).toBe('number');
  });
});
