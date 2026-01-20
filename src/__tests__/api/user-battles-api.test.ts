import { describe, expect, test, beforeEach, afterEach } from 'vitest';

// Import API routes
import { GET as userBattlesGET } from '@/app/api/user-battles/route';

// Import shared test helpers
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';

// Import battle creation utilities
import { endBattle, getBattleCache } from '@/lib/server/battle/BattleCache';
import { getDatabase } from '@/lib/server/database';
import { BattleStats } from '@/lib/server/battle/battleTypes';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';

// Helper to get user ID from username
async function getUserIdByUsername(username: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) throw new Error('User not found');
  return (result.rows[0] as { id: number }).id;
}

// Helper to create a test battle between two users
async function createTestBattle(
  attackerUsername: string,
  attackeeUsername: string,
  attackerWins: boolean = true
): Promise<number> {
  const attackerId = await getUserIdByUsername(attackerUsername);
  const attackeeId = await getUserIdByUsername(attackeeUsername);

  // Create initial battle stats
  const initialStats: BattleStats = {
    hull: { current: 500, max: 500 },
    armor: { current: 500, max: 500 },
    shield: { current: 500, max: 500 },
    weapons: {
      pulse_laser: { count: 5, damage: 10, cooldown: 1000 }
    }
  };

  const emptyCtx = createLockContext();
  return await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
    // Create battle
    const battleCache = getBattleCache();

    const battle = await battleContext.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      return await battleCache.createBattle(
        battleContext,
        userCtx,
        attackerId,
        attackeeId,
        initialStats,
        initialStats,
        {},
        {}
      );
    });
  
    // End battle with winner/loser
    const winnerId = attackerWins ? attackerId : attackeeId;
    const loserId = attackerWins ? attackeeId : attackerId;
  
    const winnerEndStats: BattleStats = {
      hull: { current: 100, max: 500 },
      armor: { current: 50, max: 500 },
      shield: { current: 0, max: 500 },
      weapons: {
        pulse_laser: { count: 5, damage: 10, cooldown: 1000 }
      }
    };
  
    const loserEndStats: BattleStats = {
      hull: { current: 0, max: 500 },
      armor: { current: 0, max: 500 },
      shield: { current: 0, max: 500 },
      weapons: {
        pulse_laser: { count: 5, damage: 10, cooldown: 1000 }
      }
    };
  
    await endBattle(
      battleContext,
      battle.id,
      winnerId,
      loserId,
      attackerWins ? winnerEndStats : loserEndStats,
      attackerWins ? loserEndStats : winnerEndStats
    );
  
    return battle.id;
  });

}

describe('User battles API', () => {
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('userBattles_notAuthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/user-battles', 'GET');
      const response = await userBattlesGET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });

  test('userBattles_noBattles_returnsEmptyArray', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('nobattlesuser');

      const request = createRequest('http://localhost:3000/api/user-battles', 'GET', undefined, sessionCookie);
      const response = await userBattlesGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('battles');
      expect(data).toHaveProperty('totalBattles');
      expect(Array.isArray(data.battles)).toBe(true);
      expect(data.battles.length).toBe(0);
      expect(data.totalBattles).toBe(0);
    });
  });

  test('userBattles_withBattles_returnsBattleHistory', async () => {
    await withTransaction(async () => {
      // Create two users
      const sessionCookie1 = await createAuthenticatedSession('battleuser1');
      await createAuthenticatedSession('battleuser2'); // Create second user but don't need their session

      // Get their user data - the last two created users
      const db = await getDatabase();
      const usersResult = await db.query('SELECT id, username FROM users ORDER BY id DESC LIMIT 2');
      const users = usersResult.rows as Array<{ id: number; username: string }>;

      const user1 = users[1]; // Second to last
      const user2 = users[0]; // Last

      // Create a battle between user1 and user2
      await createTestBattle(user1.username, user2.username, true);

      // Fetch battles for user1
      const request = createRequest('http://localhost:3000/api/user-battles', 'GET', undefined, sessionCookie1);
      const response = await userBattlesGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.battles).toBeDefined();
      expect(Array.isArray(data.battles)).toBe(true);
      expect(data.battles.length).toBeGreaterThan(0);
      expect(data.totalBattles).toBeGreaterThan(0);

      // Verify battle data structure
      const battle = data.battles[0];
      expect(battle).toHaveProperty('id');
      expect(battle).toHaveProperty('opponentUsername');
      expect(battle).toHaveProperty('isAttacker');
      expect(battle).toHaveProperty('didWin');
      expect(battle).toHaveProperty('userDamage');
      expect(battle).toHaveProperty('opponentDamage');
      expect(battle).toHaveProperty('duration');
      expect(battle).toHaveProperty('battleStartTime');
      expect(battle).toHaveProperty('battleEndTime');

      // User1 was the attacker and won
      expect(battle.isAttacker).toBe(true);
      expect(battle.didWin).toBe(true);
      expect(battle.opponentUsername).toBe(user2.username);
    });
  }, 10000); // Increase timeout to 10 seconds

  test('userBattles_battleStatistics_areAccurate', async () => {
    await withTransaction(async () => {
      // Create two users and a battle
      const sessionCookie1 = await createAuthenticatedSession('statuser1');
      await createAuthenticatedSession('statuser2'); // Create second user but don't need their session

      const db = await getDatabase();
      
      // Get user data - last two users
      const usersResult = await db.query('SELECT id, username FROM users ORDER BY id DESC LIMIT 2');
      const users = usersResult.rows as Array<{ id: number; username: string }>;

      const user1 = users[1]; // Second to last
      const user2 = users[0]; // Last

      // Create a battle where user2 wins (user1 is attacker but loses)
      await createTestBattle(user1.username, user2.username, false);

      // Fetch battles for user1 (the loser)
      const request = createRequest('http://localhost:3000/api/user-battles', 'GET', undefined, sessionCookie1);
      const response = await userBattlesGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.battles.length).toBeGreaterThan(0);

      const battle = data.battles[0];
      
      // User1 was the attacker but lost
      expect(battle.isAttacker).toBe(true);
      expect(battle.didWin).toBe(false);
      expect(battle.opponentUsername).toBe(user2.username);
      
      // Verify damage values are numbers
      expect(typeof battle.userDamage).toBe('number');
      expect(typeof battle.opponentDamage).toBe('number');
      
      // Verify duration is calculated
      expect(typeof battle.duration).toBe('number');
      expect(battle.duration).toBeGreaterThanOrEqual(0);
    });
  }, 10000); // Increase timeout to 10 seconds
});
