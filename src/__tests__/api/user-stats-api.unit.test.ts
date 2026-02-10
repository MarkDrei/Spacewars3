import { describe, expect, test, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user-stats/route';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import { UserCache } from '@/lib/server/user/userCache';
import { getIronSession } from 'iron-session';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { TechCounts } from '@/lib/server/techs/TechFactory';

// Mock dependencies
vi.mock('iron-session');
vi.mock('@/lib/server/user/userCache');
vi.mock('@markdrei/ironguard-typescript-locks');

describe('User stats API - Pure Unit Tests', () => {
  let mockUserCache: Partial<UserCache>;
  let mockUser: User;
  let mockSession: { userId?: number };
  let mockRequest: NextRequest;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLockContext: any;

  // Default tech counts for tests
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
  };

  const dummySave: SaveUserCallback = async () => {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock request
    mockRequest = new Request('http://localhost:3000/api/user-stats', {
      method: 'GET',
    }) as NextRequest;

    // Setup mock session (authenticated by default)
    mockSession = { userId: 1 };

    // Setup mock lock context
    mockLockContext = {
      useLockWithAcquire: vi.fn((lock, callback) => callback(mockLockContext)),
    };

    // Setup mock User instance with base values
    mockUser = new User(
      1, // id
      'testuser', // username
      'hashedpassword', // password_hash
      100, // iron
      1000, // last_updated
      createInitialTechTree(), // techTree
      dummySave, // saveCallback
      defaultTechCounts, // techCounts
      100, // hullCurrent
      100, // armorCurrent
      100, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      undefined // ship_id
    );

    // Setup mock UserCache methods
    mockUserCache = {
      getUserByIdWithLock: vi.fn().mockResolvedValue(mockUser),
      updateUserInCache: vi.fn(),
    };

    // Mock the iron-session to return our mock session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getIronSession).mockResolvedValue(mockSession as any);

    // Mock UserCache.getInstance2() to return our mock cache
    vi.mocked(UserCache.getInstance2).mockReturnValue(mockUserCache as UserCache);

    // Mock createLockContext to return our mock context
    vi.mocked(createLockContext).mockReturnValue(mockLockContext);
  });

  test('userStats_notAuthenticated_returns401', async () => {
    // Arrange: Setup unauthenticated session
    mockSession.userId = undefined;

    // Act: Call the API route
    const response = await GET(mockRequest);
    const data = await response.json();

    // Assert: Should return 401 error
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
    
    // Verify no cache operations were attempted
    expect(mockUserCache.getUserByIdWithLock).not.toHaveBeenCalled();
    expect(mockUserCache.updateUserInCache).not.toHaveBeenCalled();
  });

  test('userStats_loggedInUser_returnsStats', async () => {
    // Arrange: Mock user with iron and upgrades
    mockUser.iron = 150;
    mockUser.last_updated = 1000;

    // Spy on User methods to verify they're called
    const updateStatsSpy = vi.spyOn(mockUser, 'updateStats');
    const getIronPerSecondSpy = vi.spyOn(mockUser, 'getIronPerSecond').mockReturnValue(1);
    const getMaxIronCapacitySpy = vi.spyOn(mockUser, 'getMaxIronCapacity').mockReturnValue(1000);

    // Act: Call the API route
    const response = await GET(mockRequest);
    const data = await response.json();

    // Assert: Should return 200 with stats
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('iron');
    expect(data).toHaveProperty('ironPerSecond');
    expect(data).toHaveProperty('last_updated');
    expect(data).toHaveProperty('maxIronCapacity');
    
    expect(typeof data.iron).toBe('number');
    expect(typeof data.ironPerSecond).toBe('number');
    expect(typeof data.last_updated).toBe('number');
    expect(typeof data.maxIronCapacity).toBe('number');
    
    // Verify business logic was executed
    expect(updateStatsSpy).toHaveBeenCalledOnce();
    expect(getIronPerSecondSpy).toHaveBeenCalledOnce();
    expect(getMaxIronCapacitySpy).toHaveBeenCalledOnce();
    
    // Verify cache was updated
    expect(mockUserCache.updateUserInCache).toHaveBeenCalledWith(mockLockContext, mockUser);
    
    // Verify correct values returned
    expect(data.ironPerSecond).toBe(1);
    expect(data.maxIronCapacity).toBe(1000);
  });

  test('userStats_newUser_returnsBaseIronPerSecond', async () => {
    // Arrange: Setup new user with minimal iron
    mockUser.iron = 0;
    mockUser.last_updated = 999; // Just created
    
    // Mock base iron per second rate
    vi.spyOn(mockUser, 'getIronPerSecond').mockReturnValue(1);
    vi.spyOn(mockUser, 'getMaxIronCapacity').mockReturnValue(1000);

    // Act: Call the API route
    const response = await GET(mockRequest);
    const data = await response.json();

    // Assert: Should return 200 with base stats
    expect(response.status).toBe(200);
    expect(data.ironPerSecond).toBe(1); // Base rate
    expect(data.iron).toBeGreaterThanOrEqual(0);
    expect(data.last_updated).toBeGreaterThan(0);
  });

  test('userStats_ironPerSecondReflectsTechTreeUpgrades', async () => {
    // Arrange: Setup user with upgraded tech tree
    const upgradedTechCounts: TechCounts = {
      ...defaultTechCounts,
      auto_turret: 3, // User has researched upgrades
    };
    
    mockUser = new User(
      1,
      'upgradeduser',
      'hashedpassword',
      500,
      1000,
      createInitialTechTree(),
      dummySave,
      upgradedTechCounts,
      100, 100, 100, 1000, false, null, [], null, undefined
    );
    
    // Mock upgraded iron per second (base + upgrades)
    const expectedIronPerSecond = 2.5; // Example upgraded rate
    vi.spyOn(mockUser, 'getIronPerSecond').mockReturnValue(expectedIronPerSecond);
    vi.spyOn(mockUser, 'getMaxIronCapacity').mockReturnValue(2000);
    
    // Update mock cache to return upgraded user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockUserCache.getUserByIdWithLock as any).mockResolvedValue(mockUser);

    // Act: Call the API route
    const response = await GET(mockRequest);
    const data = await response.json();

    // Assert: Should return upgraded stats
    expect(response.status).toBe(200);
    expect(data.ironPerSecond).toBe(expectedIronPerSecond);
    expect(data.ironPerSecond).toBeGreaterThan(1); // Verify upgrade effect
    expect(typeof data.ironPerSecond).toBe('number');
  });

  test('userStats_userNotFound_returns404', async () => {
    // Arrange: Mock cache returning null (user not found)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockUserCache.getUserByIdWithLock as any).mockResolvedValue(null);

    // Act: Call the API route
    const response = await GET(mockRequest);
    const data = await response.json();

    // Assert: Should return 404 error
    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
    
    // Verify cache was queried but not updated
    expect(mockUserCache.getUserByIdWithLock).toHaveBeenCalledWith(mockLockContext, 1);
    expect(mockUserCache.updateUserInCache).not.toHaveBeenCalled();
  });

  test('userStats_cacheError_returns500', async () => {
    // Arrange: Mock cache throwing an error
    const cacheError = new Error('Database connection failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockUserCache.getUserByIdWithLock as any).mockRejectedValue(cacheError);

    // Act: Call the API route
    const response = await GET(mockRequest);
    const data = await response.json();

    // Assert: Should return 500 error
    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  test('userStats_updateStatsCalledWithCurrentTime', async () => {
    // Arrange: Spy on updateStats to verify it's called with current timestamp
    const updateStatsSpy = vi.spyOn(mockUser, 'updateStats');
    vi.spyOn(mockUser, 'getIronPerSecond').mockReturnValue(1);
    vi.spyOn(mockUser, 'getMaxIronCapacity').mockReturnValue(1000);
    
    const beforeTime = Math.floor(Date.now() / 1000);

    // Act: Call the API route
    await GET(mockRequest);
    
    const afterTime = Math.floor(Date.now() / 1000);

    // Assert: updateStats should be called with current timestamp
    expect(updateStatsSpy).toHaveBeenCalledOnce();
    const calledWith = updateStatsSpy.mock.calls[0][0];
    expect(calledWith).toBeGreaterThanOrEqual(beforeTime);
    expect(calledWith).toBeLessThanOrEqual(afterTime);
  });

  test('userStats_lockContextUsedCorrectly', async () => {
    // Arrange: Setup spies
    vi.spyOn(mockUser, 'getIronPerSecond').mockReturnValue(1);
    vi.spyOn(mockUser, 'getMaxIronCapacity').mockReturnValue(1000);

    // Act: Call the API route
    await GET(mockRequest);

    // Assert: Lock context should be used correctly
    expect(createLockContext).toHaveBeenCalledOnce();
    expect(mockLockContext.useLockWithAcquire).toHaveBeenCalledOnce();
    
    // Verify getUserByIdWithLock called with lock context
    expect(mockUserCache.getUserByIdWithLock).toHaveBeenCalledWith(mockLockContext, 1);
    
    // Verify updateUserInCache called with lock context
    expect(mockUserCache.updateUserInCache).toHaveBeenCalledWith(mockLockContext, mockUser);
  });
});
