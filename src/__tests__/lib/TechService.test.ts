import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { TechService } from '@/lib/server/techs/TechService';
import { UserCache } from '@/lib/server/user/userCache';
import { MessageCache } from '@/lib/server/messages/MessageCache';
import { User } from '@/lib/server/user/user';
import { TechCounts, BuildQueueItem } from '@/lib/server/techs/TechFactory';
import { ResearchType, createInitialTechTree } from '@/lib/server/techs/techtree';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';

describe('TechService - Unit Tests', () => {
    let techService: TechService;
    let mockUserCache: Partial<UserCache>;
    let mockMessageCache: Partial<MessageCache>;
    let mockCreateMessage: ReturnType<typeof vi.fn>;
    let mockGetUserByIdWithLock: ReturnType<typeof vi.fn>;
    let mockUpdateUserInCache: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        await initializeIntegrationTestServer();

        // Create mock functions
        mockCreateMessage = vi.fn().mockResolvedValue(1);
        mockGetUserByIdWithLock = vi.fn();
        mockUpdateUserInCache = vi.fn().mockResolvedValue(undefined);

        // Create mock caches
        mockUserCache = {
            getUserByIdWithLock: mockGetUserByIdWithLock as (context: unknown, userId: number) => Promise<User | null>,
            updateUserInCache: mockUpdateUserInCache as (context: unknown, user: User) => Promise<void>
        };

        mockMessageCache = {
            createMessage: mockCreateMessage as (userId: number, message: string) => Promise<number>
        };

        // Get TechService instance and inject mocks
        techService = TechService.getInstance();
        techService.setUserCacheForTesting(mockUserCache as UserCache);
        techService.setMessageCacheForTesting(mockMessageCache as MessageCache);
    });

    afterEach(async () => {
        await shutdownIntegrationTestServer();
    });

    describe('getTechCounts', () => {
        test('getTechCounts_userExists_returnsTechCounts', async () => {
            await withTransaction(async () => {
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
        });

        test('getTechCounts_userNotFound_returnsNull', async () => {
            await withTransaction(async () => {
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
    });

    describe('addTechItemToBuildQueue', () => {
        test('addTechItemToBuildQueue_validWeapon_addsToQueue', async () => {
            await withTransaction(async () => {
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
        });

        test('addTechItemToBuildQueue_insufficientIron_returnsError', async () => {
            await withTransaction(async () => {
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
    });

    describe('processCompletedBuilds', () => {
        test('processCompletedBuilds_oneCompleted_incrementsCountAndSendsNotification', async () => {
            await withTransaction(async () => {
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
    });

    describe('getTechLoadoutAnalysis', () => {
        test('getTechLoadoutAnalysis_validUser_returnsCalculatedEffects', async () => {
            await withTransaction(async () => {
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
});

describe('getDefenseStats', () => {
    test('getDefenseStats_basicCounts_returnsCorrectCalculations', async () => {
        await withTransaction(async () => {
            const techCounts: TechCounts = {
                pulse_laser: 0,
                auto_turret: 0,
                plasma_lance: 0,
                gauss_rifle: 0,
                photon_torpedo: 0,
                rocket_launcher: 0,
                ship_hull: 2,
                kinetic_armor: 5,
                energy_shield: 3,
                missile_jammer: 0
            };

            // Default tech tree (level 0 researches -> factor 1.0)
            const techTree = createInitialTechTree();

            const currentValues = { hull: 100, armor: 250, shield: 150 };

            const result = TechService.getDefenseStats(techCounts, techTree, currentValues);

            // Hull: 2 * 150 (base) = 300 max
            expect(result.hull.max).toBe(300);
            expect(result.hull.current).toBe(100);

            // Armor: 5 * 250 (base) = 1250 max
            expect(result.armor.max).toBe(1250);
            expect(result.armor.current).toBe(250);

            // Shield: 3 * 250 (base) = 750 max
            expect(result.shield.max).toBe(750);
            expect(result.shield.current).toBe(150);
        });
    });

    test('getDefenseStats_hullResearch_increasesIncrementallyAndIsolated', async () => {
        await withTransaction(async () => {
            const techCounts: TechCounts = {
                pulse_laser: 0, auto_turret: 0, plasma_lance: 0, gauss_rifle: 0, photon_torpedo: 0, rocket_launcher: 0,
                ship_hull: 10, kinetic_armor: 10, energy_shield: 10, missile_jammer: 0
            };
            const currentValues = { hull: 500, armor: 500, shield: 500 };

            // Base values (Level 1)
            const techTreeBase = createInitialTechTree();
            // Ensure level 1
            techTreeBase[ResearchType.HullStrength] = 1;
            techTreeBase[ResearchType.ArmorEffectiveness] = 1;
            techTreeBase[ResearchType.ShieldEffectiveness] = 1;

            const resultBase = TechService.getDefenseStats(techCounts, techTreeBase, currentValues);
            let previousHullMax = resultBase.hull.max;
            const baseArmorMax = resultBase.armor.max;
            const baseShieldMax = resultBase.shield.max;

            // Iterate levels 2 to 5
            for (let level = 2; level <= 5; level++) {
                const techTree = createInitialTechTree();
                techTree[ResearchType.HullStrength] = level;
                // Keep others at base
                techTree[ResearchType.ArmorEffectiveness] = 1;
                techTree[ResearchType.ShieldEffectiveness] = 1;

                const result = TechService.getDefenseStats(techCounts, techTree, currentValues);

                // Verify Hull increased
                expect(result.hull.max).toBeGreaterThan(previousHullMax);
                previousHullMax = result.hull.max;

                // Verify Isolation (Armor and Shield should remain unchanged)
                expect(result.armor.max).toBe(baseArmorMax);
                expect(result.shield.max).toBe(baseShieldMax);
            }
        });
    });

    test('getDefenseStats_armorResearch_increasesIncrementallyAndIsolated', async () => {
        await withTransaction(async () => {
            const techCounts: TechCounts = {
                pulse_laser: 0, auto_turret: 0, plasma_lance: 0, gauss_rifle: 0, photon_torpedo: 0, rocket_launcher: 0,
                ship_hull: 10, kinetic_armor: 10, energy_shield: 10, missile_jammer: 0
            };
            const currentValues = { hull: 500, armor: 500, shield: 500 };

            // Base values (Level 1)
            const techTreeBase = createInitialTechTree();
            techTreeBase[ResearchType.HullStrength] = 1;
            techTreeBase[ResearchType.ArmorEffectiveness] = 1;
            techTreeBase[ResearchType.ShieldEffectiveness] = 1;

            const resultBase = TechService.getDefenseStats(techCounts, techTreeBase, currentValues);
            const baseHullMax = resultBase.hull.max;
            let previousArmorMax = resultBase.armor.max;
            const baseShieldMax = resultBase.shield.max;

            // Iterate levels 2 to 5
            for (let level = 2; level <= 5; level++) {
                const techTree = createInitialTechTree();
                techTree[ResearchType.ArmorEffectiveness] = level;
                // Keep others at base
                techTree[ResearchType.HullStrength] = 1;
                techTree[ResearchType.ShieldEffectiveness] = 1;

                const result = TechService.getDefenseStats(techCounts, techTree, currentValues);

                // Verify Armor increased
                expect(result.armor.max).toBeGreaterThan(previousArmorMax);
                previousArmorMax = result.armor.max;

                // Verify Isolation
                expect(result.hull.max).toBe(baseHullMax);
                expect(result.shield.max).toBe(baseShieldMax);
            }
        });
    });

    test('getDefenseStats_shieldResearch_increasesIncrementallyAndIsolated', async () => {
        await withTransaction(async () => {
            const techCounts: TechCounts = {
                pulse_laser: 0, auto_turret: 0, plasma_lance: 0, gauss_rifle: 0, photon_torpedo: 0, rocket_launcher: 0,
                ship_hull: 10, kinetic_armor: 10, energy_shield: 10, missile_jammer: 0
            };
            const currentValues = { hull: 500, armor: 500, shield: 500 };

            // Base values (Level 1)
            const techTreeBase = createInitialTechTree();
            techTreeBase[ResearchType.HullStrength] = 1;
            techTreeBase[ResearchType.ArmorEffectiveness] = 1;
            techTreeBase[ResearchType.ShieldEffectiveness] = 1;

            const resultBase = TechService.getDefenseStats(techCounts, techTreeBase, currentValues);
            const baseHullMax = resultBase.hull.max;
            const baseArmorMax = resultBase.armor.max;
            let previousShieldMax = resultBase.shield.max;

            // Iterate levels 2 to 5
            for (let level = 2; level <= 5; level++) {
                const techTree = createInitialTechTree();
                techTree[ResearchType.ShieldEffectiveness] = level;
                // Keep others at base
                techTree[ResearchType.HullStrength] = 1;
                techTree[ResearchType.ArmorEffectiveness] = 1;

                const result = TechService.getDefenseStats(techCounts, techTree, currentValues);

                // Verify Shield increased
                expect(result.shield.max).toBeGreaterThan(previousShieldMax);
                previousShieldMax = result.shield.max;

                // Verify Isolation
                expect(result.hull.max).toBe(baseHullMax);
                expect(result.armor.max).toBe(baseArmorMax);
            }
        });
    });
});
