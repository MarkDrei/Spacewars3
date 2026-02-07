import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/user-stats/route';
import { NextRequest } from 'next/server';
import { createAuthenticatedSession } from '../helpers/apiTestHelpers';
import { withTransaction } from '../helpers/transactionHelper';
import { getDatabase } from '@/lib/server/database';

describe('User Stats API - XP and Level', () => {
  describe('GET /api/user-stats', () => {
    it('should include xp, level, and xpForNextLevel in response', async () => {
      await withTransaction(async () => {
        const cookie = await createAuthenticatedSession('xpuser1');

        const request = new NextRequest('http://localhost:3000/api/user-stats', {
          method: 'GET',
          headers: {
            Cookie: cookie
          }
        });

        const response = await GET(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        
        // Verify XP/Level fields are present
        expect(data).toHaveProperty('xp');
        expect(data).toHaveProperty('level');
        expect(data).toHaveProperty('xpForNextLevel');

        // Verify types
        expect(typeof data.xp).toBe('number');
        expect(typeof data.level).toBe('number');
        expect(typeof data.xpForNextLevel).toBe('number');

        // Verify reasonable values
        expect(data.xp).toBeGreaterThanOrEqual(0);
        expect(data.level).toBeGreaterThanOrEqual(1);
        expect(data.xpForNextLevel).toBeGreaterThan(0);

        // Verify legacy fields still present
        expect(data).toHaveProperty('iron');
        expect(data).toHaveProperty('ironPerSecond');
        expect(data).toHaveProperty('last_updated');
        expect(data).toHaveProperty('maxIronCapacity');
      });
    });

    it('should return level 1 for new user with 0 XP', async () => {
      await withTransaction(async () => {
        const cookie = await createAuthenticatedSession('newuser1');

        const request = new NextRequest('http://localhost:3000/api/user-stats', {
          method: 'GET',
          headers: {
            Cookie: cookie
          }
        });

        const response = await GET(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        
        expect(data.xp).toBe(0);
        expect(data.level).toBe(1);
        expect(data.xpForNextLevel).toBe(1000); // Level 2 threshold
      });
    });

    it('should return correct level for user with 1500 XP', async () => {
      await withTransaction(async () => {
        const cookie = await createAuthenticatedSession('xpuser2');

        // Get userId from cookie to update XP
        const db = await getDatabase();
        const userResult = await db.query<{ id: number }>(
          'SELECT id FROM users WHERE username = ?',
          ['xpuser2']
        );
        const userId = userResult.rows[0].id;

        // Manually set user XP to 1500 (should be level 2)
        await db.query('UPDATE users SET xp = ? WHERE id = ?', [1500, userId]);

        const request = new NextRequest('http://localhost:3000/api/user-stats', {
          method: 'GET',
          headers: {
            Cookie: cookie
          }
        });

        const response = await GET(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        
        expect(data.xp).toBe(1500);
        expect(data.level).toBe(2);
        expect(data.xpForNextLevel).toBe(3000); // Level 3 threshold
      });
    });

    it('should calculate correct progress percentage', async () => {
      await withTransaction(async () => {
        const cookie = await createAuthenticatedSession('xpuser3');

        // Set XP to 2500 (level 2, halfway to level 3)
        const db = await getDatabase();
        const userResult = await db.query<{ id: number }>(
          'SELECT id FROM users WHERE username = ?',
          ['xpuser3']
        );
        const userId = userResult.rows[0].id;
        await db.query('UPDATE users SET xp = ? WHERE id = ?', [2500, userId]);

        const request = new NextRequest('http://localhost:3000/api/user-stats', {
          method: 'GET',
          headers: {
            Cookie: cookie
          }
        });

        const response = await GET(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        
        expect(data.xp).toBe(2500);
        expect(data.level).toBe(2);
        expect(data.xpForNextLevel).toBe(3000);
        
        // Progress: 2500 / 3000 = 83.3%
        const progress = Math.floor((data.xp / data.xpForNextLevel) * 100);
        expect(progress).toBe(83);
      });
    });
  });
});
