import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { TechService } from '@/lib/server/techs/TechService';
import { userCache } from '@/lib/server/user/userCache';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { User } from '@/lib/server/user/user';
import { TechCounts, BuildQueueItem } from '@/lib/server/techs/TechFactory';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';

describe('TechService - Unit Tests', () => {
    let techService: TechService;
    let mockUserCache: Partial<userCache>;
    let mockMessageCache: Partial<MessageCache>;
    let mockCreateMessage: ReturnType<typeof vi.fn>;
    let mockGetUserByIdWithLock: ReturnType<typeof vi.fn>;
    let mockUpdateUserInCache: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        await initializeIntegrationTestServer();

        // Create mock functions
        mockCreateMessage = vi.fn().mockResolvedValue(1);
        mockGetUserByIdWithLock = vi.fn();
        mockUpdateUserInCache = vi.fn();

        // Create mock caches
        mockUserCache = {
            getUserByIdWithLock: mockGetUserByIdWithLock,
            updateUserInCache: mockUpdateUserInCache
        };

        mockMessageCache = {
            createMessage: mockCreateMessage
        };

        // Get TechService instance and inject mocks
        techService = TechService.getInstance();
        techService.setUserCacheForTesting(mockUserCache as userCache);
        techService.setMessageCacheForTesting(mockMessageCache as MessageCache);
    });

    afterEach(async () => {
        await shutdownIntegrationTestServer();
    });

    describe('getTechCounts', () => {
        test('getTechCounts_userExists_returnsTechCounts', async () => {
            // Arrange
            const techCounts = {
                pulse_laser: 5,
                auto_turret: 3
            } as TechCounts;
            const mockUser = { techCounts } as User;
            mockGetUserByIdWithLock.mockResolvedValue(mockUser);

            const context = createLockContext();

            // Act
            const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
                return await techService.getTechCounts(1, userContext);
            });

            // Assert
            expect(result).toEqual(techCounts);
            expect(mockGetUserByIdWithLock).toHaveBeenCalledWith(expect.anything(), 1);
        });

        test('getTechCounts_userNotFound_returnsNull', async () => {
            // Arrange
            mockGetUserByIdWithLock.mockResolvedValue(null);
            const context = createLockContext();

            // Act
            const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
                return await techService.getTechCounts(999, userContext);
            });

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('addTechItemToBuildQueue', () => {
        test('addTechItemToBuildQueue_validWeapon_addsToQueue', async () => {
            // Arrange
            const mockUser = {
                iron: 1000,
                buildQueue: [],
                buildStartSec: null
            } as unknown as User;
            mockGetUserByIdWithLock.mockResolvedValue(mockUser);
            const context = createLockContext();

            // Act
            const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
                return await techService.addTechItemToBuildQueue(1, 'pulse_laser', 'weapon', userContext);
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockUser.buildQueue).toHaveLength(1);
            expect(mockUser.buildQueue[0].itemKey).toBe('pulse_laser');
            expect(mockUser.buildStartSec).toBeGreaterThan(0);
            expect(mockUpdateUserInCache).toHaveBeenCalled();
        });

        test('addTechItemToBuildQueue_insufficientIron_returnsError', async () => {
            // Arrange
            const mockUser = {
                iron: 10, // Not enough for pulse_laser (costs 100)
                buildQueue: [],
                buildStartSec: null
            } as unknown as User;
            mockGetUserByIdWithLock.mockResolvedValue(mockUser);
            const context = createLockContext();

            // Act
            const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
                return await techService.addTechItemToBuildQueue(1, 'pulse_laser', 'weapon', userContext);
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient iron');
            expect(mockUpdateUserInCache).not.toHaveBeenCalled();
        });
    });

    describe('processCompletedBuilds', () => {
        test('processCompletedBuilds_oneCompleted_incrementsCountAndSendsNotification', async () => {
            // Arrange
            const now = Math.floor(Date.now() / 1000);
            const mockUser = {
                buildQueue: [
                    { itemKey: 'pulse_laser', itemType: 'weapon', completionTime: 0 }
                ] as BuildQueueItem[],
                buildStartSec: now - 200, // Started 200 seconds ago (pulse_laser takes 120s)
                techCounts: { pulse_laser: 2 } as TechCounts
            } as unknown as User;
            mockGetUserByIdWithLock.mockResolvedValue(mockUser);
            const context = createLockContext();

            // Act
            const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
                return await techService.processCompletedBuilds(1, userContext);
            });

            // Assert
            expect(result.completed).toHaveLength(1);
            expect(result.completed[0].itemKey).toBe('pulse_laser');
            expect((mockUser.techCounts as TechCounts).pulse_laser).toBe(3); // Incremented
            expect(mockUser.buildQueue).toHaveLength(0); // Removed from queue
            expect(mockCreateMessage).toHaveBeenCalledWith(1, expect.stringContaining('Pulse Laser'));
            expect(mockUpdateUserInCache).toHaveBeenCalled();
        });
    });

    describe('getTechLoadoutAnalysis', () => {
        test('getTechLoadoutAnalysis_validUser_returnsCalculatedEffects', async () => {
            // Arrange
            const techCounts = {
                pulse_laser: 3,
                auto_turret: 2
            } as TechCounts;
            const mockUser = { techCounts } as User;
            mockGetUserByIdWithLock.mockResolvedValue(mockUser);
            const context = createLockContext();

            // Act
            const result = await context.useLockWithAcquire(USER_LOCK, async (userContext) => {
                return await techService.getTechLoadoutAnalysis(1, userContext);
            });

            // Assert
            expect(result).toBeDefined();
            expect(result.weapons.totalDPS).toBeGreaterThan(0);
            expect(result.weapons.totalAccuracy).toBeGreaterThan(0);
        });
    });
});