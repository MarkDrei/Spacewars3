import request from 'supertest';
import { createApp } from '../src/createApp';
import sqlite3 from 'sqlite3';
import { CREATE_TABLES } from '../src/schema';

let db: sqlite3.Database;
let app: ReturnType<typeof createApp>;

beforeAll((done) => {
  db = new (sqlite3.verbose().Database)(':memory:');
  app = createApp(db);
  
  // Create tables using centralized schema
  let completed = 0;
  const tables = CREATE_TABLES;
  
  tables.forEach((createTableSQL) => {
    db.run(createTableSQL, (err) => {
      if (err) {
        done(err);
        return;
      }
      completed++;
      if (completed === tables.length) {
        done();
      }
    });
  });
});

afterAll((done) => {
  db.close(done);
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
