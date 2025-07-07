import request from 'supertest';
import { createApp } from '../src/createApp';
import sqlite3 from 'sqlite3';

let db: sqlite3.Database;
let app: ReturnType<typeof createApp>;

beforeAll((done) => {
  db = new (sqlite3.verbose().Database)(':memory:');
  app = createApp(db);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    iron REAL NOT NULL DEFAULT 0.0,
    last_updated INTEGER NOT NULL,
    tech_tree TEXT NOT NULL
  )`, done);
});

afterAll((done) => {
  db.close(done);
});

describe('Auth API', () => {
  let agent: any;
  beforeEach(() => {
    agent = request.agent(app);
  });

  test('register_newUser_success', async () => {
    const res = await agent
      .post('/api/register')
      .send({ username: 'testuser', password: 'testpass' });
    expect(res.body.success).toBe(true);
  });

  test('register_duplicateUser_returnsUsernameTaken', async () => {
    await agent.post('/api/register').send({ username: 'dupe', password: 'pass1' });
    const res = await agent.post('/api/register').send({ username: 'dupe', password: 'pass2' });
    expect(res.body.error).toBe('Username taken');
  });

  test('login_validCredentials_success', async () => {
    await agent.post('/api/register').send({ username: 'loginuser', password: 'mypassword' });
    const res = await agent.post('/api/login').send({ username: 'loginuser', password: 'mypassword' });
    expect(res.body.success).toBe(true);
  });

  test('login_wrongPassword_returnsInvalidCredentials', async () => {
    await agent.post('/api/register').send({ username: 'wrongpass', password: 'right' });
    const res = await agent.post('/api/login').send({ username: 'wrongpass', password: 'wrong' });
    expect(res.body.error).toBe('Invalid credentials');
  });
});
