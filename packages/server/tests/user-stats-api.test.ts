import { describe, expect, test, afterAll, beforeAll, beforeEach } from 'vitest';
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

describe('User stats API', () => {
  let agent: ReturnType<typeof request.agent>;
  beforeEach(() => {
    agent = request.agent(app);
  });

  test('userStats_notAuthenticated_returns401', async () => {
    const res = await agent.get('/api/user-stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Not authenticated');
  });

  test('userStats_loggedInUser_returnsStats', async () => {
    await agent.post('/api/register').send({ username: 'statsuser', password: 'statspass' });
    await agent.post('/api/login').send({ username: 'statsuser', password: 'statspass' });
    const res = await agent.get('/api/user-stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.iron).toBe('number');
    expect(typeof res.body.last_updated).toBe('number');
    expect(typeof res.body.ironPerSecond).toBe('number');
    // ironPerSecond should match the techtree default for ironHarvesting (should be 1)
    expect(res.body.ironPerSecond).toBe(1);
  });
});
