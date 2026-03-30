// ---
// Integration tests for /api/statistics endpoint
// Uses real database via transactions for isolation.
// ---

import { describe, test, beforeEach, afterEach, expect } from 'vitest';
import { GET as statisticsGET } from '@/app/api/statistics/route';
import { createRequest, createAuthenticatedSessionWithUser } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { StatisticsCache } from '@/lib/server/statistics/StatisticsCache';
import { ResearchType } from '@/lib/server/techs/techtree';

describe('Statistics API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('statistics_unauthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/statistics', 'GET');
      const response = await statisticsGET(request);
      expect(response.status).toBe(401);
    });
  });

  test('statistics_newUser_returnsEmptyStats', async () => {
    await withTransaction(async () => {
      const { sessionCookie } = await createAuthenticatedSessionWithUser('statstest');
      const request = createRequest('http://localhost:3000/api/statistics', 'GET', undefined, sessionCookie);
      const response = await statisticsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('global');
      expect(data).toHaveProperty('currentUserId');

      // New user has no events recorded
      expect(data.user.battlesWon).toBe(0);
      expect(data.user.battlesLost).toBe(0);
      expect(data.user.totalDamageDealt).toBe(0);
      expect(data.user.asteroidsCollected).toBe(0);
      expect(data.user.totalIronSpentOnResearch).toBe(0);

      // Global stats shape is present
      expect(typeof data.global.totalPlayers).toBe('number');
      expect(data.global).toHaveProperty('averages');
      expect(data.global).toHaveProperty('top5');
    });
  });

  test('statistics_afterEmittingEvents_returnsCorrectAggregates', async () => {
    await withTransaction(async () => {
      const { sessionCookie } = await createAuthenticatedSessionWithUser('statsevents');

      // Emit a few events via StatisticsCache
      const cache = StatisticsCache.getInstance();

      // Get the userId — call the API first to get it from the session
      const firstRequest = createRequest('http://localhost:3000/api/statistics', 'GET', undefined, sessionCookie);
      const firstResponse = await statisticsGET(firstRequest);
      const firstData = await firstResponse.json();
      const userId: number = firstData.currentUserId;

      expect(userId).toBeGreaterThan(0);

      // Record some events into the cache
      await cache.recordEvent(userId, 'battle_completed', {
        battleId: 999,
        opponentId: 1,
        won: true,
        damageDealt: 500,
        damageReceived: 200,
        ironTransferred: 50,
        xpAwarded: 30,
        durationSec: 60,
      });

      await cache.recordEvent(userId, 'item_collected', {
        objectType: 'asteroid',
        ironAwarded: 25,
      });

      await cache.recordEvent(userId, 'research_spent', {
        researchType: ResearchType.IronHarvesting,
        level: 2,
        ironCost: 1000,
      });

      // Fetch stats again
      const request = createRequest('http://localhost:3000/api/statistics', 'GET', undefined, sessionCookie);
      const response = await statisticsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.battlesWon).toBe(1);
      expect(data.user.totalDamageDealt).toBe(500);
      expect(data.user.totalIronTransferred).toBe(50);
      expect(data.user.asteroidsCollected).toBe(1);
      expect(data.user.totalIronFromCollection).toBe(25);
      expect(data.user.totalIronSpentOnResearch).toBe(1000);
      expect(data.user.researchCount).toBe(1);
    });
  });

  test('statistics_responseShape_hasAllRequiredFields', async () => {
    await withTransaction(async () => {
      const { sessionCookie } = await createAuthenticatedSessionWithUser('statsshape');
      const request = createRequest('http://localhost:3000/api/statistics', 'GET', undefined, sessionCookie);
      const response = await statisticsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // User stats fields
      const userFields = [
        'battlesWon', 'battlesLost', 'totalDamageDealt', 'totalDamageReceived',
        'totalIronTransferred', 'totalXpAwarded', 'totalBattleDurationSec',
        'asteroidsCollected', 'shipwrecksCollected', 'escapePodsCollected',
        'totalIronFromCollection', 'totalIronSpentOnResearch', 'researchCount',
        'totalIronSpentOnBuilds', 'totalBuildsCompleted'
      ];
      for (const field of userFields) {
        expect(data.user).toHaveProperty(field);
      }

      // Global fields
      expect(data.global).toHaveProperty('totalPlayers');
      expect(data.global).toHaveProperty('averages');
      expect(data.global).toHaveProperty('top5');
      expect(data.global.top5).toHaveProperty('battlesWon');
      expect(data.global.top5).toHaveProperty('totalDamageDealt');
      expect(data.global.top5).toHaveProperty('totalIronTransferred');
      expect(data.global.top5).toHaveProperty('totalIronFromCollection');
      expect(data.global.top5).toHaveProperty('totalIronSpentOnResearch');
    });
  });
});
