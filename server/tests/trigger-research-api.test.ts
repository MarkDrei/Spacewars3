import request from 'supertest';
import { createApp } from '../createApp';
import sqlite3 from 'sqlite3';

describe('Trigger Research API', () => {
  let db: sqlite3.Database;
  let app: ReturnType<typeof createApp>;
  let agent: any;

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

  beforeEach(() => {
    agent = request.agent(app);
  });

  test('triggerResearch_unauthenticated_returns401', async () => {
    const res = await agent.post('/api/trigger-research').send({ type: 'IronHarvesting' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Not authenticated');
  });

  test('triggerResearch_notEnoughIron_returns400', async () => {
    await agent.post('/api/register').send({ username: 'user1', password: 'pass' });
    // User starts with 0 iron, so cannot upgrade
    const res = await agent.post('/api/trigger-research').send({ type: 'IronHarvesting' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Not enough iron');
  });

  test('triggerResearch_success_startsResearchAndDeductsIron', async () => {
    await agent.post('/api/register').send({ username: 'user2', password: 'pass' });
    // Give user enough iron
    await db.run('UPDATE users SET iron = 1000 WHERE username = ?', ['user2']);
    await agent.post('/api/login').send({ username: 'user2', password: 'pass' });
    const res = await agent.post('/api/trigger-research').send({ type: 'IronHarvesting' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Check that research is in progress and iron is deducted
    const techtreeRes = await agent.get('/api/techtree');
    expect(techtreeRes.body.techTree.activeResearch).toBeDefined();
    expect(techtreeRes.body.techTree.activeResearch.type).toBe('IronHarvesting');
    // Should have less iron than before
    const statsRes = await agent.get('/api/user-stats');
    expect(statsRes.body.iron).toBeLessThan(1000);
  });

  test('triggerResearch_alreadyInProgress_returns400', async () => {
    await agent.post('/api/register').send({ username: 'user3', password: 'pass' });
    await db.run('UPDATE users SET iron = 1000 WHERE username = ?', ['user3']);
    await agent.post('/api/login').send({ username: 'user3', password: 'pass' });
    // Start first research
    await agent.post('/api/trigger-research').send({ type: 'IronHarvesting' });
    // Try to start another
    const res = await agent.post('/api/trigger-research').send({ type: 'ShipVelocity' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Research already in progress');
  });

  test('triggerResearch_invalidType_returns400', async () => {
    await agent.post('/api/register').send({ username: 'user4', password: 'pass' });
    await db.run('UPDATE users SET iron = 1000 WHERE username = ?', ['user4']);
    await agent.post('/api/login').send({ username: 'user4', password: 'pass' });
    const res = await agent.post('/api/trigger-research').send({ type: 'NotARealResearch' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid research type');
  });
});
