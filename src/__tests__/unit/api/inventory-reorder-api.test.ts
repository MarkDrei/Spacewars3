import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { POST as inventoryReorderPOST } from '@/app/api/inventory/reorder/route';
import { POST as bridgeReorderPOST } from '@/app/api/bridge/reorder/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { InventoryRepo } from '@/lib/server/inventory/InventoryRepo';
import { UserCache } from '@/lib/server/user/userCache';
import { createInitialTechTree, getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import type { CommanderData } from '@/lib/server/inventory/Commander';
import type { InventorySlot } from '@/lib/server/inventory/inventoryTypes';

const commander = (name: string, value = 10): CommanderData => ({
  itemType: 'commander',
  name,
  imageId: 1,
  statBonuses: [{ stat: 'shipSpeed', value }],
} as unknown as CommanderData);

const row = (cols: number, items: InventorySlot[] = []): InventorySlot[] =>
  Array.from({ length: cols }, (_, i) => items[i] ?? null);

const techTree = createInitialTechTree();
const inventoryRows = Math.ceil(Math.floor(getResearchEffectFromTree(techTree, ResearchType.InventorySlots)) / 8);

const emptyInventory = () => Array.from({ length: inventoryRows }, () => row(8));

describe('POST /api/inventory/reorder and /api/bridge/reorder', () => {
  let storedInventory: InventorySlot[][];
  let storedBridge: InventorySlot[][];
  let saveInventory: ReturnType<typeof vi.spyOn>;
  let saveBridge: ReturnType<typeof vi.spyOn>;

  const post = async (handler: typeof inventoryReorderPOST, path: string, body: unknown) => {
    const cookie = await createMockSessionCookie(1);
    const response = await handler(createRequest(`http://localhost${path}`, 'POST', body, cookie));
    return { status: response.status, data: await response.json() };
  };

  beforeEach(() => {
    storedInventory = emptyInventory();
    storedInventory[0][0] = commander('Alpha', 5);
    storedInventory[0][1] = commander('Beta', 7);

    const bridgeTree = { ...createInitialTechTree(), bridgeSlots: 1 };
    const bridgeSlots = Math.floor(getResearchEffectFromTree(bridgeTree, ResearchType.BridgeSlots));
    storedBridge = Array.from({ length: Math.ceil(bridgeSlots / 4) }, () => row(4));
    if (storedBridge.length > 0) storedBridge[0][0] = commander('Gamma', 3);

    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithLock: vi.fn().mockResolvedValue({ techTree: bridgeTree }),
    } as unknown as UserCache);
    vi.spyOn(InventoryRepo.prototype, 'getInventory').mockImplementation(async () => storedInventory);
    vi.spyOn(InventoryRepo.prototype, 'getBridge').mockImplementation(async () => storedBridge);
    saveInventory = vi.spyOn(InventoryRepo.prototype, 'saveInventory').mockResolvedValue(undefined);
    saveBridge = vi.spyOn(InventoryRepo.prototype, 'saveBridge').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('inventoryReorder_notAuthenticated_returns401', async () => {
    const response = await inventoryReorderPOST(createRequest('http://localhost/api/inventory/reorder', 'POST', { grid: [] }));
    expect(response.status).toBe(401);
  });

  test('inventoryReorder_gridNotArray_returns400', async () => {
    const { status } = await post(inventoryReorderPOST, '/api/inventory/reorder', { grid: 'nope' });
    expect(status).toBe(400);
    expect(saveInventory).not.toHaveBeenCalled();
  });

  test('inventoryReorder_swappedItems_savesNewOrder', async () => {
    const grid = emptyInventory();
    grid[0][0] = commander('Beta', 7);
    grid[1 % inventoryRows][3] = commander('Alpha', 5);

    const { status } = await post(inventoryReorderPOST, '/api/inventory/reorder', { grid });

    expect(status).toBe(200);
    expect(saveInventory).toHaveBeenCalledWith(expect.anything(), 1, grid);
  });

  test('inventoryReorder_itemKeysInDifferentOrder_isAccepted', async () => {
    const grid = emptyInventory();
    grid[0][0] = { statBonuses: [{ value: 7, stat: 'shipSpeed' }], name: 'Beta', imageId: 1, itemType: 'commander' } as unknown as CommanderData;
    grid[0][1] = commander('Alpha', 5);

    const { status } = await post(inventoryReorderPOST, '/api/inventory/reorder', { grid });

    expect(status).toBe(200);
  });

  test.each([
    ['injected item', (g: InventorySlot[][]) => { g[0][2] = commander('Forged', 99); }],
    ['duplicated item', (g: InventorySlot[][]) => { g[0][2] = commander('Alpha', 5); }],
    ['dropped item', (g: InventorySlot[][]) => { g[0][1] = null; }],
    ['altered stats', (g: InventorySlot[][]) => { g[0][0] = commander('Alpha', 50); }],
    ['wrong row length', (g: InventorySlot[][]) => { g[0].push(null); }],
    ['missing row', (g: InventorySlot[][]) => { g.pop(); }],
  ])('inventoryReorder_%s_returns400AndSavesNothing', async (_label, mutate) => {
    const grid = storedInventory.map(r => [...r]);
    mutate(grid);

    const { status, data } = await post(inventoryReorderPOST, '/api/inventory/reorder', { grid });

    expect(status).toBe(400);
    expect(data.error).toBe('Reordered grid must contain exactly the current items');
    expect(saveInventory).not.toHaveBeenCalled();
  });

  test('bridgeReorder_injectedCommander_returns400AndSavesNothing', async () => {
    const grid = storedBridge.map(r => [...r]);
    grid[0][1] = commander('Forged', 99);

    const { status } = await post(bridgeReorderPOST, '/api/bridge/reorder', { grid });

    expect(status).toBe(400);
    expect(saveBridge).not.toHaveBeenCalled();
  });

  test('bridgeReorder_movedCommander_savesNewOrder', async () => {
    const grid = storedBridge.map(r => r.map(() => null as InventorySlot));
    grid[0][3] = commander('Gamma', 3);

    const { status } = await post(bridgeReorderPOST, '/api/bridge/reorder', { grid });

    expect(status).toBe(200);
    expect(saveBridge).toHaveBeenCalledWith(expect.anything(), 1, grid);
  });
});
