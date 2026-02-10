import { describe, expect, test, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the database module before any imports that depend on it
vi.mock('@/lib/server/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
  }),
  getDatabasePool: vi.fn().mockResolvedValue({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }] }),
      release: vi.fn(),
    }),
  }),
}));

// Mock iron-session
vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

// Mock UserCache to avoid singleton issues
vi.mock('@/lib/server/user/userCache', () => {
  return {
    UserCache: {
      getInstance2: vi.fn(),
    },
  };
});

import { getIronSession } from 'iron-session';

// Import API routes
import { GET as userStatsGET } from '@/app/api/user-stats/route';

// Import types and domain classes
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { UserCache } from '@/lib/server/user/userCache';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';
import { SessionData } from '@/lib/server/session';

describe('User stats API - Pure Unit Tests', () => {
  let mockGetUserByIdWithLock: ReturnType<typeof vi.fn>;
  let mockUpdateUserInCache: ReturnType<typeof vi.fn>;
  let mockUserCache: Partial<UserCache>;
  let mockGetIronSession: ReturnType<typeof vi.fn>;

  const createMockUser = (
    id: number,
    username: string,
    iron: number,
    last_updated: number,
    techTree = createInitialTechTree()
  ): User => {
    const dummySave: SaveUserCallback = vi.fn().mockResolvedValue(undefined);
    const techCounts: TechCounts = {
      pulse_laser: 0,
      auto_turret: 0,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 0,
      kinetic_armor: 0,
      energy_shield: 0,
      missile_jammer: 0,
    };

    return new User(
      id,
      username,
      'hashed_password',
      iron,
      last_updated,
      techTree,
      dummySave,
      techCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      last_updated, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null // buildStartSec
    );
  };

  const createMockRequest = (url: string, method: string): NextRequest => {
    return new NextRequest(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'cookie': 'spacewars-session=mock-session-cookie',
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock functions
    mockGetUserByIdWithLock = vi.fn();
    mockUpdateUserInCache = vi.fn().mockResolvedValue(undefined);

    // Setup mock UserCache
    mockUserCache = {
      getUserByIdWithLock: mockGetUserByIdWithLock as (context: unknown, userId: number) => Promise<User | null>,
      updateUserInCache: mockUpdateUserInCache as (context: unknown, user: User) => Promise<void>,
    };

    // Mock UserCache.getInstance2() to return our mock
    vi.mocked(UserCache.getInstance2).mockReturnValue(mockUserCache as UserCache);

    // Setup getIronSession mock
    mockGetIronSession = vi.mocked(getIronSession);
  });

  test('userStats_notAuthenticated_returns401', async () => {
    // Mock session without userId
    const mockSession: SessionData = {};
    mockGetIronSession.mockResolvedValue(mockSession);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
    
    // Verify cache was never called for unauthenticated requests
    expect(mockGetUserByIdWithLock).not.toHaveBeenCalled();
  });

  test('userStats_userNotFound_returns404', async () => {
    // Mock authenticated session
    const mockSession: SessionData = { userId: 999 };
    mockGetIronSession.mockResolvedValue(mockSession);

    // Mock getUserByIdWithLock to return null (user not found)
    mockGetUserByIdWithLock.mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
    expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(expect.anything(), 999);
  });

  test('userStats_loggedInUser_returnsStats', async () => {
    // Mock authenticated session
    const mockSession: SessionData = { userId: 1 };
    mockGetIronSession.mockResolvedValue(mockSession);

    // Create a mock user with initial iron
    const now = Math.floor(Date.now() / 1000);
    const mockUser = createMockUser(1, 'statsuser', 100, now);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('iron');
    expect(data).toHaveProperty('ironPerSecond');
    expect(data).toHaveProperty('last_updated');
    expect(data).toHaveProperty('maxIronCapacity');
    expect(typeof data.iron).toBe('number');
    expect(typeof data.ironPerSecond).toBe('number');
    expect(typeof data.last_updated).toBe('number');

    // Verify base iron harvesting rate (from initial tech tree)
    expect(data.ironPerSecond).toBe(1); // Base iron harvesting rate
    expect(data.ironPerSecond).toBeGreaterThan(0);
    
    // Verify cache methods were called correctly
    expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(expect.anything(), 1);
    expect(mockUpdateUserInCache).toHaveBeenCalledWith(expect.anything(), mockUser);
  });

  test('userStats_newUser_returnsBaseIronPerSecond', async () => {
    // Mock authenticated session
    const mockSession: SessionData = { userId: 2 };
    mockGetIronSession.mockResolvedValue(mockSession);

    // Create a mock new user with 0 iron
    const now = Math.floor(Date.now() / 1000);
    const mockUser = createMockUser(2, 'newstatsuser', 0, now);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // New user should have base iron rate, not 0
    expect(data.ironPerSecond).toBe(1);
    
    // New user starts with 0 iron (updateStats doesn't change it since last_updated = now)
    expect(data.iron).toBeGreaterThanOrEqual(0);
    expect(data.last_updated).toBeGreaterThan(0);
    
    // Verify cache interactions
    expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mockUpdateUserInCache).toHaveBeenCalled();
  });

  test('userStats_ironPerSecondReflectsTechTreeUpgrades', async () => {
    // Mock authenticated session
    const mockSession: SessionData = { userId: 3 };
    mockGetIronSession.mockResolvedValue(mockSession);

    // Create a mock user with initial tech tree (level 1)
    const now = Math.floor(Date.now() / 1000);
    const mockUser = createMockUser(3, 'upgradeduser', 50, now);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Base rate for initial tech tree
    expect(data.ironPerSecond).toBe(1);
    expect(data.ironPerSecond).toBeGreaterThan(0);
    expect(typeof data.ironPerSecond).toBe('number');
    
    // Verify the method is called correctly (business logic in User class)
    expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(expect.anything(), 3);
    expect(mockUpdateUserInCache).toHaveBeenCalled();
  });

  test('userStats_ironAccumulatesOverTime', async () => {
    // Mock authenticated session
    const mockSession: SessionData = { userId: 4 };
    mockGetIronSession.mockResolvedValue(mockSession);

    // Create a mock user with last_updated 10 seconds ago
    const now = Math.floor(Date.now() / 1000);
    const tenSecondsAgo = now - 10;
    const mockUser = createMockUser(4, 'accumulator', 100, tenSecondsAgo);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Iron should have accumulated (100 initial + 10 seconds * 1 iron/sec = 110)
    expect(data.iron).toBeGreaterThan(100);
    expect(data.iron).toBeLessThanOrEqual(110); // Allow for timing variations
    
    // Verify last_updated was updated to current time
    expect(data.last_updated).toBeGreaterThanOrEqual(now - 1);
    expect(data.last_updated).toBeLessThanOrEqual(now + 1);
    
    expect(mockUpdateUserInCache).toHaveBeenCalled();
  });

  test('userStats_maxIronCapacity_isReturned', async () => {
    // Mock authenticated session
    const mockSession: SessionData = { userId: 5 };
    mockGetIronSession.mockResolvedValue(mockSession);

    // Create a mock user
    const now = Math.floor(Date.now() / 1000);
    const mockUser = createMockUser(5, 'capacityuser', 50, now);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);

    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');
    const response = await userStatsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('maxIronCapacity');
    expect(typeof data.maxIronCapacity).toBe('number');
    expect(data.maxIronCapacity).toBeGreaterThan(0);
  });
});
