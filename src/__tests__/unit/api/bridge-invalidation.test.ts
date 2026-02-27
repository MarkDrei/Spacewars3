// ---
// Unit tests: verify that UserBonusCache.invalidateBonuses() is called for every
// bridge route that modifies bridge contents (DELETE, move, transfer, auto-transfer).
//
// All external dependencies (iron-session, UserCache, InventoryService) are mocked
// so no database or server is needed.
// ---

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { getIronSession } from 'iron-session';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { createInitialTechTree } from '@/lib/server/techs/techtree';
import { createRequest } from '../../helpers/apiTestHelpers';

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Vitest to run before imports of the route modules)
// ---------------------------------------------------------------------------

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

vi.mock('@/lib/server/user/userCache', () => ({
  UserCache: {
    getInstance2: vi.fn(),
  },
}));

vi.mock('@/lib/server/inventory/InventoryService', () => {
  // Provide all error classes referenced by bridge route catch-blocks
  class BridgeSlotEmptyError extends Error { name = 'BridgeSlotEmptyError'; }
  class BridgeSlotInvalidError extends Error { name = 'BridgeSlotInvalidError'; }
  class BridgeSlotOccupiedError extends Error { name = 'BridgeSlotOccupiedError'; }
  class InventorySlotEmptyError extends Error { name = 'InventorySlotEmptyError'; }
  class InventorySlotInvalidError extends Error { name = 'InventorySlotInvalidError'; }
  class InventorySlotOccupiedError extends Error { name = 'InventorySlotOccupiedError'; }
  class BridgeItemIncompatibleError extends Error { name = 'BridgeItemIncompatibleError'; }
  class InventoryFullError extends Error { name = 'InventoryFullError'; }
  class BridgeFullError extends Error { name = 'BridgeFullError'; }

  class InventoryService {
    removeFromBridge = vi.fn().mockResolvedValue({ itemType: 'commander', name: 'MockCommander' });
    moveBridgeItem = vi.fn().mockResolvedValue(undefined);
    moveInventoryToBridge = vi.fn().mockResolvedValue(undefined);
    moveBridgeToInventory = vi.fn().mockResolvedValue(undefined);
    moveInventoryToBridgeFirstFree = vi.fn().mockResolvedValue({ row: 0, col: 1 });
    moveBridgeToInventoryFirstFree = vi.fn().mockResolvedValue({ row: 0, col: 1 });
  }

  return {
    InventoryService,
    BridgeSlotEmptyError,
    BridgeSlotInvalidError,
    BridgeSlotOccupiedError,
    InventorySlotEmptyError,
    InventorySlotInvalidError,
    InventorySlotOccupiedError,
    BridgeItemIncompatibleError,
    InventoryFullError,
    BridgeFullError,
  };
});

// ---------------------------------------------------------------------------
// Lazy-imported route handlers (must be imported AFTER vi.mock() declarations)
// ---------------------------------------------------------------------------

import { DELETE as bridgeDELETE } from '@/app/api/bridge/route';
import { POST as bridgeMovePOST } from '@/app/api/bridge/move/route';
import { POST as bridgeTransferPOST } from '@/app/api/bridge/transfer/route';
import { POST as bridgeAutoTransferPOST } from '@/app/api/bridge/transfer/auto/route';
import { UserCache } from '@/lib/server/user/userCache';

// ---------------------------------------------------------------------------
// Test userId used across all tests
// ---------------------------------------------------------------------------

const TEST_USER_ID = 42;

// ---------------------------------------------------------------------------
// Setup and teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset UserBonusCache singleton between tests
  UserBonusCache.resetInstance();

  // Configure iron-session mock to return an authenticated session
  vi.mocked(getIronSession).mockResolvedValue({ userId: TEST_USER_ID } as never);

  // Configure UserCache mock: getInstance2() returns a mock with getUserByIdWithLock
  const mockUserCacheInstance = {
    getUserByIdWithLock: vi.fn().mockResolvedValue({
      id: TEST_USER_ID,
      techTree: createInitialTechTree(),
    }),
  };
  vi.mocked(UserCache.getInstance2).mockReturnValue(mockUserCacheInstance as never);
});

afterEach(() => {
  UserBonusCache.resetInstance();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: pre-populate UserBonusCache so invalidation has something to delete
// ---------------------------------------------------------------------------

function seedCacheEntry(): UserBonusCache {
  // Use a minimal mock for the cache configuration
  const userCacheMock = {
    getUserByIdFromCache: vi.fn().mockReturnValue({
      id: TEST_USER_ID,
      xp: 0,
      techTree: createInitialTechTree(),
      getLevel: () => 1,
    }),
  };
  const inventoryServiceMock = {
    getBridge: vi.fn().mockResolvedValue([]),
  };
  UserBonusCache.configureDependencies({
    userCache: userCacheMock as never,
    inventoryService: inventoryServiceMock as never,
  });
  return UserBonusCache.getInstance();
}

// ---------------------------------------------------------------------------
// DELETE /api/bridge — remove item from bridge
// ---------------------------------------------------------------------------

describe('Bridge route invalidation — DELETE /api/bridge', () => {
  test('removeFromBridge_success_callsInvalidateBonuses', async () => {
    const cache = seedCacheEntry();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const request = createRequest('http://localhost:3000/api/bridge', 'DELETE', {
      row: 0,
      col: 0,
    });
    const response = await bridgeDELETE(request);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(TEST_USER_ID);

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// POST /api/bridge/move — move item within bridge
// ---------------------------------------------------------------------------

describe('Bridge route invalidation — POST /api/bridge/move', () => {
  test('moveBridgeItem_success_callsInvalidateBonuses', async () => {
    const cache = seedCacheEntry();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const request = createRequest('http://localhost:3000/api/bridge/move', 'POST', {
      from: { row: 0, col: 0 },
      to: { row: 0, col: 1 },
    });
    const response = await bridgeMovePOST(request);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(TEST_USER_ID);

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// POST /api/bridge/transfer — inventory ↔ bridge transfer
// ---------------------------------------------------------------------------

describe('Bridge route invalidation — POST /api/bridge/transfer', () => {
  test('inventoryToBridge_success_callsInvalidateBonuses', async () => {
    const cache = seedCacheEntry();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const request = createRequest('http://localhost:3000/api/bridge/transfer', 'POST', {
      direction: 'inventoryToBridge',
      from: { row: 0, col: 0 },
      to: { row: 0, col: 0 },
    });
    const response = await bridgeTransferPOST(request);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(TEST_USER_ID);

    spy.mockRestore();
  });

  test('bridgeToInventory_success_callsInvalidateBonuses', async () => {
    const cache = seedCacheEntry();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const request = createRequest('http://localhost:3000/api/bridge/transfer', 'POST', {
      direction: 'bridgeToInventory',
      from: { row: 0, col: 0 },
      to: { row: 0, col: 0 },
    });
    const response = await bridgeTransferPOST(request);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(TEST_USER_ID);

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// POST /api/bridge/transfer/auto — auto-transfer to first free slot
// ---------------------------------------------------------------------------

describe('Bridge route invalidation — POST /api/bridge/transfer/auto', () => {
  test('inventoryToBridgeFirstFree_success_callsInvalidateBonuses', async () => {
    const cache = seedCacheEntry();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
      direction: 'inventoryToBridge',
      from: { row: 0, col: 0 },
    });
    const response = await bridgeAutoTransferPOST(request);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(TEST_USER_ID);

    spy.mockRestore();
  });

  test('bridgeToInventoryFirstFree_success_callsInvalidateBonuses', async () => {
    const cache = seedCacheEntry();
    const spy = vi.spyOn(cache, 'invalidateBonuses');

    const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
      direction: 'bridgeToInventory',
      from: { row: 0, col: 0 },
    });
    const response = await bridgeAutoTransferPOST(request);

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(TEST_USER_ID);

    spy.mockRestore();
  });
});
