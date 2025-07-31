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

describe('Auth API', () => {
  let agent: ReturnType<typeof request.agent>;
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
