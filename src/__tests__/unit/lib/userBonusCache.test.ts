// ---
// Unit tests for UserBonusCache
// All dependencies (UserCache, InventoryService) are mocked.
// No database access.
// ---

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLockContext, LockContext, LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { BASE_REGEN_RATE } from '@/lib/server/bonus/userBonusTypes';
import {
  createInitialTechTree,
  getResearchEffectFromTree,
  getWeaponDamageModifierFromTree,
  getWeaponAccuracyModifierFromTree,
  getWeaponReloadTimeModifierFromTree,
  ResearchType,
  AllResearches,
  triggerResearch,
} from '@/lib/server/techs/techtree';
import { Commander } from '@/lib/server/inventory/Commander';
import { User, type SaveUserCallback } from '@/lib/server/user/user';
import type { UserCache } from '@/lib/server/user/userCache';
import type { InventoryService } from '@/lib/server/inventory/InventoryService';
import type { BridgeGrid } from '@/lib/server/inventory/inventoryTypes';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal User-like mock with the given XP and tech tree overrides.
 * Uses createInitialTechTree() as the default tree.
 */
function makeUser(xp: number, treeOverrides?: Partial<ReturnType<typeof createInitialTechTree>>): User {
  const tree = { ...createInitialTechTree(), ...treeOverrides };

  // Mirror User.getLevel() logic: increment for level N→N+1 is (N*(N+1)/2)*1000
  const getLevel = (): number => {
    let level = 1;
    let totalXpNeeded = 0;
    while (true) {
      const increment = (level * (level + 1) / 2) * 1000;
      if (xp < totalXpNeeded + increment) break;
      totalXpNeeded += increment;
      level++;
    }
    return level;
  };

  return {
    id: 1,
    xp,
    techTree: tree,
    getLevel,
  } as unknown as User;
}

/** Build an empty bridge grid (no commanders). */
function emptyBridge(): BridgeGrid {
  return [];
}

/** Build a bridge grid with a single commander item in the first slot. */
function bridgeWithCommanders(...commanders: ReturnType<typeof Commander.withStats>[]): BridgeGrid {
  const row: (ReturnType<typeof Commander.prototype.toJSON> | null)[] = commanders.map(c => c.toJSON());
  // Pad remaining columns with null
  while (row.length < 4) row.push(null);
  return [row] as BridgeGrid;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMocks(user: User, bridge: BridgeGrid) {
  const mockGetUserByIdFromCache = vi.fn().mockReturnValue(user);
  const mockGetBridge = vi.fn().mockResolvedValue(bridge);

  const userCacheMock = {
    getUserByIdFromCache: mockGetUserByIdFromCache,
  } as unknown as UserCache;

  const inventoryServiceMock = {
    getBridge: mockGetBridge,
  } as unknown as InventoryService;

  return { userCacheMock, inventoryServiceMock, mockGetUserByIdFromCache, mockGetBridge };
}

/** Obtain a HasLock4Context for use in cache calls. */
async function withLock4<T>(fn: (ctx: LockContext<LocksAtMostAndHas4>) => Promise<T>): Promise<T> {
  const ctx = createLockContext();
  return ctx.useLockWithAcquire(USER_LOCK, (lockCtx) => fn(lockCtx));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  UserBonusCache.resetInstance();
});

afterEach(() => {
  UserBonusCache.resetInstance();
});

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

describe('UserBonusCache singleton', () => {
  test('getInstance_calledTwice_returnsSameInstance', () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });

    const a = UserBonusCache.getInstance();
    const b = UserBonusCache.getInstance();
    expect(a).toBe(b);
  });

  test('resetInstance_clearsInstance_getInstanceCreatesNew', () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });

    const a = UserBonusCache.getInstance();
    UserBonusCache.resetInstance();
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const b = UserBonusCache.getInstance();
    expect(a).not.toBe(b);
  });

  test('getInstance_withoutConfiguredDependencies_stillCreatesInstance', () => {
    // configureDependencies was not called — instance can be created, but
    // getBonuses/updateBonuses will throw on first access.
    const cache = UserBonusCache.getInstance();
    expect(cache).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Lazy initialisation and caching
// ---------------------------------------------------------------------------

describe('UserBonusCache lazy caching', () => {
  test('getBonuses_firstCall_calculatesAndCaches', async () => {
    const user = makeUser(0); // level 1
    const { userCacheMock, inventoryServiceMock, mockGetUserByIdFromCache, mockGetBridge } =
      makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    expect(bonuses).toBeDefined();
    expect(mockGetUserByIdFromCache).toHaveBeenCalledTimes(1);
    expect(mockGetBridge).toHaveBeenCalledTimes(1);
  });

  test('getBonuses_secondCall_returnsCachedWithoutRecalculation', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock, mockGetUserByIdFromCache, mockGetBridge } =
      makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const first = await withLock4(ctx => cache.getBonuses(ctx, 1));
    const second = await withLock4(ctx => cache.getBonuses(ctx, 1));

    expect(first).toBe(second);
    expect(mockGetUserByIdFromCache).toHaveBeenCalledTimes(1);
    expect(mockGetBridge).toHaveBeenCalledTimes(1);
  });

  test('getBonuses_differentUsers_calculatesIndependently', async () => {
    const user1 = { ...makeUser(0), id: 1 } as unknown as User;
    const user2 = { ...makeUser(1000), id: 2 } as unknown as User;

    const mockGetUserById = vi.fn().mockImplementation((_ctx: unknown, id: number) =>
      id === 1 ? user1 : user2
    );
    const mockGetBridge = vi.fn().mockResolvedValue(emptyBridge());

    UserBonusCache.configureDependencies({
      userCache: { getUserByIdFromCache: mockGetUserById } as unknown as UserCache,
      inventoryService: { getBridge: mockGetBridge } as unknown as InventoryService,
    });
    const cache = UserBonusCache.getInstance();

    const b1 = await withLock4(ctx => cache.getBonuses(ctx, 1));
    const b2 = await withLock4(ctx => cache.getBonuses(ctx, 2));

    expect(b1).not.toBe(b2);
    expect(b1.levelMultiplier).toBeCloseTo(1.0, 10);
    expect(b2.levelMultiplier).toBeCloseTo(1.15, 10);
    expect(mockGetBridge).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// invalidateBonuses
// ---------------------------------------------------------------------------

describe('UserBonusCache invalidateBonuses', () => {
  test('invalidateBonuses_causesNextGetBonusesToRecalculate', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock, mockGetUserByIdFromCache, mockGetBridge } =
      makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    await withLock4(ctx => cache.getBonuses(ctx, 1));
    cache.invalidateBonuses(1);
    await withLock4(ctx => cache.getBonuses(ctx, 1));

    expect(mockGetUserByIdFromCache).toHaveBeenCalledTimes(2);
    expect(mockGetBridge).toHaveBeenCalledTimes(2);
  });

  test('invalidateBonuses_returnsNewObject_afterRecalculation', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const first = await withLock4(ctx => cache.getBonuses(ctx, 1));
    cache.invalidateBonuses(1);
    const second = await withLock4(ctx => cache.getBonuses(ctx, 1));

    expect(first).not.toBe(second);
  });

  test('invalidateBonuses_onlyAffectsSpecifiedUser', async () => {
    const user1 = { ...makeUser(0), id: 1 } as unknown as User;
    const user2 = { ...makeUser(0), id: 2 } as unknown as User;

    const mockGetById = vi.fn().mockImplementation((_ctx: unknown, id: number) =>
      id === 1 ? user1 : user2
    );
    const mockGetBridge = vi.fn().mockResolvedValue(emptyBridge());

    UserBonusCache.configureDependencies({
      userCache: { getUserByIdFromCache: mockGetById } as unknown as UserCache,
      inventoryService: { getBridge: mockGetBridge } as unknown as InventoryService,
    });
    const cache = UserBonusCache.getInstance();

    await withLock4(ctx => cache.getBonuses(ctx, 1));
    await withLock4(ctx => cache.getBonuses(ctx, 2));
    cache.invalidateBonuses(1);
    await withLock4(ctx => cache.getBonuses(ctx, 1));
    await withLock4(ctx => cache.getBonuses(ctx, 2)); // should NOT recalculate

    // user1 recalculated twice, user2 only once
    expect(mockGetById.mock.calls.filter(c => c[1] === 1)).toHaveLength(2);
    expect(mockGetById.mock.calls.filter(c => c[1] === 2)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// updateBonuses
// ---------------------------------------------------------------------------

describe('UserBonusCache updateBonuses', () => {
  test('updateBonuses_alwaysRecalculatesEvenWhenCached', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock, mockGetUserByIdFromCache, mockGetBridge } =
      makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    await withLock4(ctx => cache.getBonuses(ctx, 1));    // calculates once
    await withLock4(ctx => cache.updateBonuses(ctx, 1)); // forces recalculation

    expect(mockGetUserByIdFromCache).toHaveBeenCalledTimes(2);
    expect(mockGetBridge).toHaveBeenCalledTimes(2);
  });

  test('updateBonuses_updatesCache_subsequentGetReturnsSameObject', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock, mockGetUserByIdFromCache } =
      makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const updated = await withLock4(ctx => cache.updateBonuses(ctx, 1));
    const cached = await withLock4(ctx => cache.getBonuses(ctx, 1));

    expect(updated).toBe(cached);
    expect(mockGetUserByIdFromCache).toHaveBeenCalledTimes(1); // only updateBonuses called
  });
});

// ---------------------------------------------------------------------------
// discardAllBonuses
// ---------------------------------------------------------------------------

describe('UserBonusCache discardAllBonuses', () => {
  test('discardAllBonuses_clearsAllEntries', async () => {
    const user1 = { ...makeUser(0), id: 1 } as unknown as User;
    const user2 = { ...makeUser(0), id: 2 } as unknown as User;
    const mockGetById = vi.fn().mockImplementation((_ctx: unknown, id: number) =>
      id === 1 ? user1 : user2
    );
    const mockGetBridge = vi.fn().mockResolvedValue(emptyBridge());

    UserBonusCache.configureDependencies({
      userCache: { getUserByIdFromCache: mockGetById } as unknown as UserCache,
      inventoryService: { getBridge: mockGetBridge } as unknown as InventoryService,
    });
    const cache = UserBonusCache.getInstance();

    await withLock4(ctx => cache.getBonuses(ctx, 1));
    await withLock4(ctx => cache.getBonuses(ctx, 2));
    cache.discardAllBonuses();
    await withLock4(ctx => cache.getBonuses(ctx, 1));
    await withLock4(ctx => cache.getBonuses(ctx, 2));

    // Both users recalculated twice total
    expect(mockGetById.mock.calls.filter(c => c[1] === 1)).toHaveLength(2);
    expect(mockGetById.mock.calls.filter(c => c[1] === 2)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Level multiplier calculation
// ---------------------------------------------------------------------------

describe('UserBonusCache level multiplier', () => {
  function setupCache(user: User) {
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    return UserBonusCache.getInstance();
  }

  test('levelMultiplier_level1_is1', async () => {
    const user = makeUser(0); // 0 XP = level 1
    const cache = setupCache(user);
    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.levelMultiplier).toBeCloseTo(1.0, 10);
  });

  test('levelMultiplier_level2_is1point15', async () => {
    const user = makeUser(1000); // 1000 XP = level 2
    expect(user.getLevel()).toBe(2);
    const cache = setupCache(user);
    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.levelMultiplier).toBeCloseTo(1.15, 6);
  });

  test('levelMultiplier_level3_is1point3225', async () => {
    const user = makeUser(4000); // 1000 + 3000 XP = level 3
    expect(user.getLevel()).toBe(3);
    const cache = setupCache(user);
    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.levelMultiplier).toBeCloseTo(1.3225, 6);
  });

  test('levelMultiplier_level4_is1point15cubed', async () => {
    const user = makeUser(10000); // 1000+3000+6000 = 10000 XP = level 4
    expect(user.getLevel()).toBe(4);
    const cache = setupCache(user);
    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.levelMultiplier).toBeCloseTo(Math.pow(1.15, 3), 6);
  });
});

// ---------------------------------------------------------------------------
// Commander multipliers
// ---------------------------------------------------------------------------

describe('UserBonusCache commander multipliers', () => {
  test('commanderMultipliers_noCommanders_allOnes', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    for (const value of Object.values(bonuses.commanderMultipliers)) {
      expect(value).toBeCloseTo(1.0, 10);
    }
  });

  test('commanderMultipliers_singleCommander_correctMultiplier', async () => {
    // Commander with 0.5% shipSpeed bonus → multiplier = 1.005
    const commander = Commander.withStats('Ace', [{ stat: 'shipSpeed', value: 0.5 }]);
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, bridgeWithCommanders(commander));
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    expect(bonuses.commanderMultipliers.shipSpeed).toBeCloseTo(1.005, 6);
    // Other stats should still be 1.0
    expect(bonuses.commanderMultipliers.projectileWeaponDamage).toBeCloseTo(1.0, 10);
  });

  test('commanderMultipliers_twoCommandersSameStat_multiplicativeStacking', async () => {
    // Commander A: +0.5% shipSpeed → factor 1.005
    // Commander B: +1.0% shipSpeed → factor 1.01
    // Combined: 1.005 × 1.01 = 1.01505 → bonusPercent = 1.505 → multiplier = 1.01505
    const cmdA = Commander.withStats('A', [{ stat: 'shipSpeed', value: 0.5 }]);
    const cmdB = Commander.withStats('B', [{ stat: 'shipSpeed', value: 1.0 }]);
    const user = makeUser(0);
    const bridge: BridgeGrid = [[cmdA.toJSON(), cmdB.toJSON(), null, null]];
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, bridge);
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    // calculateBonuses stacks multiplicatively: (1 + 0.5/100) × (1 + 1.0/100) - 1) × 100
    const expectedBonusPct = ((1.005 * 1.01) - 1) * 100;
    const expectedMultiplier = 1 + expectedBonusPct / 100;
    expect(bonuses.commanderMultipliers.shipSpeed).toBeCloseTo(expectedMultiplier, 6);
  });

  test('commanderMultipliers_allStatKeys_present', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expectedKeys = [
      'shipSpeed', 'projectileWeaponDamage', 'projectileWeaponReloadRate',
      'projectileWeaponAccuracy', 'energyWeaponDamage', 'energyWeaponReloadRate',
      'energyWeaponAccuracy',
    ];
    for (const key of expectedKeys) {
      expect(bonuses.commanderMultipliers).toHaveProperty(key);
    }
  });
});

// ---------------------------------------------------------------------------
// Pre-computed final values — iron economy
// ---------------------------------------------------------------------------

describe('UserBonusCache iron economy', () => {
  test('ironRechargeRate_level1_noCommander_equalsResearchEffect', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    const expected = getResearchEffectFromTree(user.techTree, ResearchType.IronHarvesting);
    expect(bonuses.ironRechargeRate).toBeCloseTo(expected, 6);
  });

  test('ironRechargeRate_level2_scaledByLevelMultiplier', async () => {
    const user = makeUser(1000); // level 2
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    const research = getResearchEffectFromTree(user.techTree, ResearchType.IronHarvesting);
    expect(bonuses.ironRechargeRate).toBeCloseTo(research * 1.15, 6);
  });

  test('ironStorageCapacity_level1_equalsResearchEffect', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    const expected = getResearchEffectFromTree(user.techTree, ResearchType.IronCapacity);
    expect(bonuses.ironStorageCapacity).toBeCloseTo(expected, 6);
  });

  test('ironStorageCapacity_level3_scaledByLevelMultiplier', async () => {
    const user = makeUser(4000); // level 3
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    const research = getResearchEffectFromTree(user.techTree, ResearchType.IronCapacity);
    expect(bonuses.ironStorageCapacity).toBeCloseTo(research * 1.3225, 6);
  });
});

// ---------------------------------------------------------------------------
// Pre-computed final values — defense regen (no research, no commander)
// ---------------------------------------------------------------------------

describe('UserBonusCache defense regen', () => {
  test('hullRepairSpeed_level1_equalsBaseRegenRate', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.hullRepairSpeed).toBeCloseTo(BASE_REGEN_RATE, 10);
  });

  test('hullRepairSpeed_level2_scaledByLevelMultiplier', async () => {
    const user = makeUser(1000);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.hullRepairSpeed).toBeCloseTo(BASE_REGEN_RATE * 1.15, 6);
  });

  test('armorRepairSpeed_sameAsHullRepairSpeed', async () => {
    const user = makeUser(1000);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.armorRepairSpeed).toBeCloseTo(bonuses.hullRepairSpeed, 10);
  });

  test('shieldRechargeRate_sameAsHullRepairSpeed', async () => {
    const user = makeUser(1000);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.shieldRechargeRate).toBeCloseTo(bonuses.hullRepairSpeed, 10);
  });
});

// ---------------------------------------------------------------------------
// Pre-computed final values — ship speed
// ---------------------------------------------------------------------------

describe('UserBonusCache maxShipSpeed', () => {
  test('maxShipSpeed_level1_noAfterburner_noCommander_equalsResearchEffect', async () => {
    const user = makeUser(0); // level 1, no afterburner (level 0)
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    const afterburner = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner); // 0
    const expected = baseSpeed * (1 + afterburner / 100);
    expect(bonuses.maxShipSpeed).toBeCloseTo(expected, 6);
  });

  test('maxShipSpeed_level2_scaledByLevelMultiplier', async () => {
    const user = makeUser(1000);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    const afterburner = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
    const expected = baseSpeed * (1 + afterburner / 100) * 1.15;
    expect(bonuses.maxShipSpeed).toBeCloseTo(expected, 6);
  });

  test('maxShipSpeed_withAfterburner_appliesAfterburnerBonus', async () => {
    // Afterburner level 1 = 100% base, with 1.2 factor: 100 * 1.2^0 = 100
    // Actually Afterburner baseValue=100, level=1 → effect=100
    // Let's set afterburner to level 2 to get effect=120
    const afterburnerResearch = AllResearches[ResearchType.Afterburner];
    // level 0 = 0, level 1 = 100, level 2 = 100 * 1.2^1 = 120
    const user = makeUser(0, { afterburner: 1 }); // afterburner level 1 → effect=100
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    const afterburnerEffect = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
    const expected = baseSpeed * (1 + afterburnerEffect / 100);
    expect(bonuses.maxShipSpeed).toBeCloseTo(expected, 6);
    void afterburnerResearch; // suppress unused variable lint
  });

  test('maxShipSpeed_withCommanderBonus_appliesCommanderMultiplier', async () => {
    const commander = Commander.withStats('Speed', [{ stat: 'shipSpeed', value: 1.0 }]);
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, bridgeWithCommanders(commander));
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const baseSpeed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    const afterburner = getResearchEffectFromTree(user.techTree, ResearchType.Afterburner);
    const commanderMult = 1 + 1.0 / 100; // = 1.01
    const expected = baseSpeed * (1 + afterburner / 100) * commanderMult;
    expect(bonuses.maxShipSpeed).toBeCloseTo(expected, 6);
  });
});

// ---------------------------------------------------------------------------
// Pre-computed weapon factors
// ---------------------------------------------------------------------------

describe('UserBonusCache weapon factors', () => {
  test('projectileWeaponDamageFactor_level1_noCommander_equalsResearchMod', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expected = getWeaponDamageModifierFromTree(user.techTree, 'auto_turret');
    expect(bonuses.projectileWeaponDamageFactor).toBeCloseTo(expected, 6);
  });

  test('projectileWeaponReloadFactor_level1_noCommander_equalsResearchMod', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expected = getWeaponReloadTimeModifierFromTree(user.techTree, 'auto_turret');
    expect(bonuses.projectileWeaponReloadFactor).toBeCloseTo(expected, 6);
  });

  test('projectileWeaponAccuracyFactor_level1_noCommander_equalsResearchMod', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expected = getWeaponAccuracyModifierFromTree(user.techTree, 'auto_turret');
    expect(bonuses.projectileWeaponAccuracyFactor).toBeCloseTo(expected, 6);
  });

  test('energyWeaponDamageFactor_level1_noCommander_equalsResearchMod', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expected = getWeaponDamageModifierFromTree(user.techTree, 'pulse_laser');
    expect(bonuses.energyWeaponDamageFactor).toBeCloseTo(expected, 6);
  });

  test('energyWeaponReloadFactor_level1_noCommander_equalsResearchMod', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expected = getWeaponReloadTimeModifierFromTree(user.techTree, 'pulse_laser');
    expect(bonuses.energyWeaponReloadFactor).toBeCloseTo(expected, 6);
  });

  test('energyWeaponAccuracyFactor_level1_noCommander_equalsResearchMod', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const expected = getWeaponAccuracyModifierFromTree(user.techTree, 'pulse_laser');
    expect(bonuses.energyWeaponAccuracyFactor).toBeCloseTo(expected, 6);
  });

  test('projectileWeaponDamageFactor_level2_withCommander_correctCombinedValue', async () => {
    const commander = Commander.withStats('DmgCmdr', [{ stat: 'projectileWeaponDamage', value: 1.0 }]);
    const user = makeUser(1000); // level 2 → levelMult = 1.15
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, bridgeWithCommanders(commander));
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const researchMod = getWeaponDamageModifierFromTree(user.techTree, 'auto_turret');
    const commanderMult = 1 + 1.0 / 100; // 1.01
    const expected = researchMod * 1.15 * commanderMult;
    expect(bonuses.projectileWeaponDamageFactor).toBeCloseTo(expected, 6);
  });

  test('energyWeaponReloadFactor_level3_withCommander_correctCombinedValue', async () => {
    const commander = Commander.withStats('ReloadCmdr', [{ stat: 'energyWeaponReloadRate', value: 0.5 }]);
    const user = makeUser(4000); // level 3 → levelMult = 1.3225
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, bridgeWithCommanders(commander));
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    const researchMod = getWeaponReloadTimeModifierFromTree(user.techTree, 'pulse_laser');
    const commanderMult = 1 + 0.5 / 100; // 1.005
    const expected = researchMod * 1.3225 * commanderMult;
    expect(bonuses.energyWeaponReloadFactor).toBeCloseTo(expected, 6);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('UserBonusCache edge cases', () => {
  test('getBonuses_userNotFound_throws', async () => {
    const mockGetById = vi.fn().mockReturnValue(null);
    const mockGetBridge = vi.fn().mockResolvedValue(emptyBridge());

    UserBonusCache.configureDependencies({
      userCache: { getUserByIdFromCache: mockGetById } as unknown as UserCache,
      inventoryService: { getBridge: mockGetBridge } as unknown as InventoryService,
    });
    const cache = UserBonusCache.getInstance();

    await expect(withLock4(ctx => cache.getBonuses(ctx, 99))).rejects.toThrow(
      'user 99 not found in cache'
    );
  });

  test('getBonuses_noDependenciesConfigured_throws', async () => {
    // resetInstance was called in beforeEach, but configureDependencies was NOT called
    const cache = UserBonusCache.getInstance();

    await expect(
      withLock4(ctx => cache.getBonuses(ctx, 1))
    ).rejects.toThrow('dependencies not configured');
  });

  test('getBonuses_level1_noAfterburner_levelMultiplierIs1', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));
    expect(bonuses.levelMultiplier).toBe(1.0);
  });

  test('getBonuses_emptyBridge_commanderMultipliersAllOne', async () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    const bonuses = await withLock4(ctx => cache.getBonuses(ctx, 1));

    for (const val of Object.values(bonuses.commanderMultipliers)) {
      expect(val).toBe(1.0);
    }
  });

  test('invalidateBonuses_nonExistentUser_doesNotThrow', () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    // userId 999 was never cached — should not throw
    expect(() => cache.invalidateBonuses(999)).not.toThrow();
  });

  test('discardAllBonuses_emptyCache_doesNotThrow', () => {
    const user = makeUser(0);
    const { userCacheMock, inventoryServiceMock } = makeMocks(user, emptyBridge());
    UserBonusCache.configureDependencies({ userCache: userCacheMock, inventoryService: inventoryServiceMock });
    const cache = UserBonusCache.getInstance();

    expect(() => cache.discardAllBonuses()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Helper: create a real User instance for invalidation trigger tests
// ---------------------------------------------------------------------------

const DUMMY_SAVE: SaveUserCallback = async () => { /* no-op */ };
const DEFAULT_TECH_COUNTS = {
  pulse_laser: 0, auto_turret: 0, plasma_lance: 0, gauss_rifle: 0,
  photon_torpedo: 0, rocket_launcher: 0, ship_hull: 0, kinetic_armor: 0,
  energy_shield: 0, missile_jammer: 0,
};

function makeRealUser(id: number, xp: number): User {
  return new User(
    id, 'testuser', 'hash',
    /* iron */ 0, xp, /* last_updated */ 1000,
    createInitialTechTree(), DUMMY_SAVE, DEFAULT_TECH_COUNTS,
    /* hull */ 100, /* armor */ 100, /* shield */ 100,
    /* defenseLastRegen */ 1000,
    /* inBattle */ false, /* currentBattleId */ null,
    /* buildQueue */ [], /* buildStartSec */ null,
    /* teleportCharges */ 0, /* teleportLastRegen */ 0
  );
}

// ---------------------------------------------------------------------------
// Invalidation trigger tests — User.addXp()
// ---------------------------------------------------------------------------

describe('UserBonusCache invalidation triggers — User.addXp()', () => {
  // addXp() calls UserBonusCache.getInstance().invalidateBonuses(userId) when a level-up occurs.
  // These tests verify that path using vi.spyOn on the cache instance.

  test('addXp_causesLevelUp_callsInvalidateBonuses', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(7, /* xp */ 0);
    // Level 1→2 requires 1000 XP: increment = (1*(1+1)/2)*1000 = 1000
    user.addXp(1000);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(7);

    spy.mockRestore();
  });

  test('addXp_noLevelUp_doesNotCallInvalidateBonuses', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(7, /* xp */ 0);
    // Only 500 XP — not enough to reach level 2 (needs 1000)
    user.addXp(500);

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  test('addXp_multiLevelJump_callsInvalidateBonusesOnce', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(7, /* xp */ 0);
    // Award 5000 XP — enough to skip several levels at once
    // Level 1→2: 1000, L2→3: 3000 = 4000 total, L3→4: 6000 = 10000 total
    // 5000 XP reaches level 3
    user.addXp(5000);

    // invalidateBonuses is called once (from addXp), not once per level
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(7);

    spy.mockRestore();
  });

  test('addXp_zeroAmount_returnsUndefinedAndNoInvalidation', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(7, /* xp */ 0);
    const result = user.addXp(0);

    expect(result).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Invalidation trigger tests — User.updateStats() research completion
// ---------------------------------------------------------------------------

describe('UserBonusCache invalidation triggers — User.updateStats() research', () => {
  // updateStats() calls UserBonusCache.getInstance().invalidateBonuses(userId) when
  // updateTechTree() reports a completed research.
  // These tests verify that path using vi.spyOn on the cache instance.

  test('updateStats_researchCompletes_callsInvalidateBonuses', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(42, /* xp */ 0);
    // Start IronHarvesting research (level 1 → 2, duration = 10 s at default time multiplier=1)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    expect(user.techTree.activeResearch).toBeDefined();

    // Advance time by 15 s — research completes (duration = 10 s)
    user.updateStats(1000 + 15);

    expect(spy).toHaveBeenCalledWith(42);

    spy.mockRestore();
  });

  test('updateStats_researchNotYetComplete_doesNotCallInvalidateBonuses', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(42, /* xp */ 0);
    // Start IronHarvesting research (duration = 10 s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);

    // Only 5 s pass — research is still in progress
    user.updateStats(1000 + 5);

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  test('updateStats_noActiveResearch_doesNotCallInvalidateBonuses', () => {
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const user = makeRealUser(42, /* xp */ 0);
    // No research started — just time passing
    user.updateStats(1000 + 10);

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  test('updateStats_researchCompletesAndLevelsUp_callsInvalidateBonusesAtLeastOnce', () => {
    // When research completes AND the XP reward causes a level-up,
    // invalidateBonuses should be called (at minimum once for the research,
    // and once more for the level-up — both calls are with the same userId).
    const cache = UserBonusCache.getInstance();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    // Give the user enough XP to be just below the level-2 threshold (999 XP)
    const user = makeRealUser(42, /* xp */ 999);
    // Start ShipSpeed research; XP reward will push user over the 1000 XP threshold
    triggerResearch(user.techTree, ResearchType.ShipSpeed);
    // ShipSpeed baseUpgradeDuration = 30 s; pass enough time to guarantee completion
    const enoughTime = 100;

    // Complete the research
    user.updateStats(1000 + enoughTime);

    // At minimum one call (from research completion); possibly two (if level-up occurred too)
    expect(spy).toHaveBeenCalledWith(42);
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });
});
