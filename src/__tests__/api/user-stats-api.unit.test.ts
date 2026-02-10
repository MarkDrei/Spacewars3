import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';

// Mock database to prevent setup.ts from trying to connect
vi.mock('@/lib/server/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  }),
  getDatabasePool: vi.fn().mockResolvedValue({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 }),
      release: vi.fn(),
    }),
  }),
}));

// Mock iron-session
vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

// Mock UserCache - create persistent mock instance
const mockUserCacheInstance = {
  getUserByIdWithLock: vi.fn(),
  updateUserInCache: vi.fn(),
};

vi.mock('@/lib/server/user/userCache', () => ({
  UserCache: {
    getInstance2: vi.fn(() => mockUserCacheInstance),
  },
}));

// Import the API route after mocks are set up
import { GET as userStatsGET } from '@/app/api/user-stats/route';
import { getIronSession, IronSession } from 'iron-session';
import { SessionData } from '@/lib/server/session';

// Get references to mocked functions
const mockGetIronSession = vi.mocked(getIronSession);
const mockGetUserByIdWithLock = mockUserCacheInstance.getUserByIdWithLock;
const mockUpdateUserInCache = mockUserCacheInstance.updateUserInCache;

describe('User stats API - Unit Tests', () => {
  const mockUserId = 123;
  const mockUsername = 'testuser';
  const mockPasswordHash = 'hashedpassword';
  const baseTimestamp = 1700000000; // Fixed timestamp for predictable tests
  
  // Helper to create a mock user with realistic data
  function createMockUser(
    iron: number = 100,
    lastUpdated: number = baseTimestamp - 10,
    techCounts: Partial<TechCounts> = {}
  ): User {
    const saveCallback = vi.fn().mockResolvedValue(undefined);
    
    const defaultTechCounts: TechCounts = {
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
      ...techCounts,
    };
    
    return new User(
      mockUserId,
      mockUsername,
      mockPasswordHash,
      iron,
      lastUpdated,
      createInitialTechTree(),
      saveCallback,
      defaultTechCounts,
      100, // hullCurrent
      100, // armorCurrent
      100, // shieldCurrent
      baseTimestamp, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      undefined // ship_id
    );
  }

  // Helper to create a mock request
  function createMockRequest(url: string, method: string): NextRequest {
    return new NextRequest(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'cookie': 'spacewars-session=mock-session-cookie',
      },
    });
  }

  // Mock Date.now to return consistent timestamp
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTimestamp * 1000); // Date.now() returns milliseconds
    vi.clearAllMocks();
    // Default mock implementation for authenticated session
    const authenticatedSession: IronSession<SessionData> = { 
      userId: mockUserId,
      save: vi.fn(),
      destroy: vi.fn(),
      updateConfig: vi.fn(),
    };
    mockGetIronSession.mockResolvedValue(authenticatedSession);
    mockUpdateUserInCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('userStats_notAuthenticated_returns401', async () => {
    // Arrange - Mock session without userId
    const unauthenticatedSession: IronSession<SessionData> = {
      save: vi.fn(),
      destroy: vi.fn(),
      updateConfig: vi.fn(),
    };
    mockGetIronSession.mockResolvedValue(unauthenticatedSession);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
    expect(mockGetUserByIdWithLock).not.toHaveBeenCalled();
  });

  test('userStats_userNotFound_returns404', async () => {
    // Arrange - Mock user not found
    mockGetUserByIdWithLock.mockResolvedValue(null);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
    expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(
      expect.anything(), // lock context
      mockUserId
    );
  });

  test('userStats_authenticatedUser_returnsStatsWithCorrectShape', async () => {
    // Arrange
    const mockUser = createMockUser(100, baseTimestamp - 10);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('iron');
    expect(data).toHaveProperty('ironPerSecond');
    expect(data).toHaveProperty('last_updated');
    expect(data).toHaveProperty('maxIronCapacity');
    expect(typeof data.iron).toBe('number');
    expect(typeof data.ironPerSecond).toBe('number');
    expect(typeof data.last_updated).toBe('number');
    expect(typeof data.maxIronCapacity).toBe('number');
  });

  test('userStats_authenticatedUser_returnsBaseIronPerSecond', async () => {
    // Arrange
    const mockUser = createMockUser(100, baseTimestamp - 10);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.ironPerSecond).toBe(1); // Base iron harvesting rate
    expect(data.ironPerSecond).toBeGreaterThan(0);
  });

  test('userStats_calculatesIronBasedOnElapsedTime', async () => {
    // Arrange - User last updated 10 seconds ago with 100 iron
    const elapsedSeconds = 10;
    const initialIron = 100;
    const mockUser = createMockUser(initialIron, baseTimestamp - elapsedSeconds);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert - Iron should increase by ironPerSecond * elapsed time
    expect(response.status).toBe(200);
    const expectedIron = initialIron + (1 * elapsedSeconds); // Base rate is 1 iron/sec
    expect(data.iron).toBe(expectedIron);
  });

  test('userStats_updatesLastUpdatedTimestamp', async () => {
    // Arrange
    const oldTimestamp = baseTimestamp - 10;
    const mockUser = createMockUser(100, oldTimestamp);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert - Timestamp should be updated to current time
    expect(response.status).toBe(200);
    expect(data.last_updated).toBeGreaterThan(oldTimestamp);
    expect(data.last_updated).toBeGreaterThanOrEqual(baseTimestamp);
  });

  test('userStats_callsUpdateUserInCache', async () => {
    // Arrange
    const mockUser = createMockUser(100, baseTimestamp - 10);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);

    // Assert - Cache should be updated with modified user
    expect(response.status).toBe(200);
    expect(mockUpdateUserInCache).toHaveBeenCalledWith(
      expect.anything(), // lock context
      mockUser
    );
  });

  test('userStats_zeroElapsedTime_noIronChange', async () => {
    // Arrange - User last updated at current time (0 elapsed)
    const initialIron = 100;
    const mockUser = createMockUser(initialIron, baseTimestamp);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert - Iron should remain unchanged
    expect(response.status).toBe(200);
    expect(data.iron).toBe(initialIron);
  });

  test('userStats_newUser_returnsDefaultCapacity', async () => {
    // Arrange - New user with no tech upgrades
    const mockUser = createMockUser(0, baseTimestamp);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert - Should return default capacity from initial tech tree
    expect(response.status).toBe(200);
    expect(data.maxIronCapacity).toBeGreaterThan(0);
    expect(typeof data.maxIronCapacity).toBe('number');
  });

  test('userStats_usesLockContextForSafeAccess', async () => {
    // Arrange
    const mockUser = createMockUser(100, baseTimestamp - 10);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);

    // Assert - Both cache operations should receive lock context
    expect(response.status).toBe(200);
    expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(
      expect.anything(), // lock context with USER_LOCK
      mockUserId
    );
    expect(mockUpdateUserInCache).toHaveBeenCalledWith(
      expect.anything(), // same lock context
      mockUser
    );
  });

  test('userStats_largeElapsedTime_calculatesCorrectly', async () => {
    // Arrange - User last updated 1 hour ago
    const elapsedSeconds = 3600; // 1 hour
    const initialIron = 50;
    const mockUser = createMockUser(initialIron, baseTimestamp - elapsedSeconds);
    mockGetUserByIdWithLock.mockResolvedValue(mockUser);
    const request = createMockRequest('http://localhost:3000/api/user-stats', 'GET');

    // Act
    const response = await userStatsGET(request);
    const data = await response.json();

    // Assert - Iron should accumulate over the full elapsed time
    expect(response.status).toBe(200);
    const expectedIron = initialIron + (1 * elapsedSeconds);
    expect(data.iron).toBe(expectedIron);
  });
});
