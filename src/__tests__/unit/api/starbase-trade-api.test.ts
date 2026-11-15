import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { sealData } from 'iron-session';
import { POST as buyPOST } from '@/app/api/starbase/buy/route';
import { POST as sellPOST } from '@/app/api/starbase/sell/route';
import { createRequest } from '../../helpers/apiTestHelpers';
import { sessionOptions } from '@/lib/server/session';
import { UserCache } from '@/lib/server/user/userCache';
import { InventoryRepo } from '@/lib/server/inventory/InventoryRepo';
import { User } from '@/lib/server/user/user';
import { createInitialTechTree, getResearchEffectFromTree, ResearchType } from '@/lib/server/techs/techtree';
import { commanderBuyPrice, commanderSellPrice } from '@/lib/server/starbase/commanderPrice';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { StarbaseShop } from '@/lib/server/starbase/StarbaseShop';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import type { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';
import type { TechCounts } from '@/lib/server/techs/TechFactory';
import type { CommanderData } from '@/lib/server/inventory/Commander';
import type { InventorySlot } from '@/lib/server/inventory/inventoryTypes';

const NO_TECHS = {
  pulse_laser: 0, auto_turret: 0, plasma_lance: 0, gauss_rifle: 0, photon_torpedo: 0,
  rocket_launcher: 0, ship_hull: 0, kinetic_armor: 0, energy_shield: 0, missile_jammer: 0,
} as TechCounts;

const commander = (name: string, value = 5): CommanderData =>
  ({ itemType: 'commander', name, imageId: 1, statBonuses: [{ stat: 'shipSpeed', value }] }) as unknown as CommanderData;

const tree = createInitialTechTree();
const BASE_CAPACITY = getResearchEffectFromTree(tree, ResearchType.IronCapacity);
const INVENTORY_ROWS = Math.ceil(Math.floor(getResearchEffectFromTree(tree, ResearchType.InventorySlots)) / 8);
/** Level bonus: capacity 50% above the research-only value */
const BONUSED_CAPACITY = BASE_CAPACITY * 1.5;

const sessionCookie = async (data: Record<string, unknown>) => {
  const sealed = await sealData({ userId: 1, ...data }, { password: sessionOptions.password as string, ttl: 86400 });
  return `spacewars-session=${sealed}`;
};

describe('starbase buy / sell', () => {
  let user: User;
  let storedInventory: InventorySlot[][];

  const emptyInventory = () => Array.from({ length: INVENTORY_ROWS }, () => Array.from({ length: 8 }, () => null as InventorySlot));

  beforeEach(() => {
    const bonuses = { ironStorageCapacity: BONUSED_CAPACITY } as UserBonuses;
    const bonusCache = { getBonuses: async () => bonuses, invalidateBonuses: () => {} } as unknown as UserBonusCache;
    const now = Math.floor(Date.now() / 1000);
    user = new User(
      1, 'a', 'h', 0, 0, now, createInitialTechTree(), async () => {}, { ...NO_TECHS },
      100, 100, 100, now, false, null, [], null, 0, now, 42, bonusCache, TimeMultiplierService.getInstance(),
    );
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithLock: vi.fn().mockResolvedValue(user),
      getBonusesByUserIdWithLock: vi.fn().mockResolvedValue(bonuses),
      updateUserInCache: vi.fn().mockResolvedValue(undefined),
    } as unknown as UserCache);

    storedInventory = emptyInventory();
    vi.spyOn(InventoryRepo.prototype, 'getInventory').mockImplementation(async () => storedInventory);
    vi.spyOn(InventoryRepo.prototype, 'saveInventory').mockImplementation(async (_ctx, _id, grid) => {
      storedInventory = grid;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    StarbaseShop.resetInstance();
  });

  const openShop = (offers: (CommanderData | null)[]) =>
    createLockContext().useLockWithAcquire(USER_LOCK, async (ctx) => StarbaseShop.getInstance().setOffers(ctx, 1, offers));

  const buy = async (slotIndex: number, shop?: (CommanderData | null)[]) => {
    if (shop) await openShop(shop);
    const cookie = await sessionCookie({});
    const response = await buyPOST(createRequest('http://localhost/api/starbase/buy', 'POST', { slotIndex }, cookie));
    return { status: response.status, data: await response.json() };
  };

  const sell = async (row: number, col: number) => {
    const cookie = await sessionCookie({});
    const response = await sellPOST(createRequest('http://localhost/api/starbase/sell', 'POST', { row, col }, cookie));
    return { status: response.status, data: await response.json() };
  };

  test('buy_enoughIron_deductsPriceAndAddsCommander', async () => {
    const offer = commander('Offer');
    user.iron = commanderBuyPrice(offer) + 10;

    const { status, data } = await buy(0, [offer]);

    expect(status).toBe(200);
    expect(data.newIron).toBe(10);
    expect(storedInventory[0][0]).toMatchObject({ name: 'Offer' });
  });

  test('buy_inventoryFull_returns400AndKeepsIron', async () => {
    const offer = commander('Offer');
    user.iron = commanderBuyPrice(offer) + 10;
    storedInventory = storedInventory.map((row) => row.map(() => commander('Owned')));

    const { status } = await buy(0, [offer]);

    expect(status).toBe(400);
    expect(user.iron).toBe(commanderBuyPrice(offer) + 10);
  });

  test('buy_sameOfferTwice_secondPurchaseFailsAndChargesOnce', async () => {
    const offer = commander('Offer');
    user.iron = 3 * commanderBuyPrice(offer);

    expect((await buy(0, [offer])).status).toBe(200);
    // A replayed request (formerly possible with the old shop cookie) finds the slot empty
    const second = await buy(0);

    expect(second.status).toBe(400);
    expect(user.iron).toBe(2 * commanderBuyPrice(offer));
    expect(storedInventory.flat().filter(Boolean)).toHaveLength(1);
  });

  test('buy_withoutOpeningShop_returns400', async () => {
    const { status, data } = await buy(0);
    expect(status).toBe(400);
    expect(data.error).toBe('No shop available. Visit the shop first.');
  });

  test('buy_inventoryFull_offerStaysAvailable', async () => {
    const offer = commander('Offer');
    user.iron = commanderBuyPrice(offer);
    storedInventory = storedInventory.map((row) => row.map(() => commander('Owned')));
    await buy(0, [offer]);

    storedInventory = emptyInventory();
    const retry = await buy(0);

    expect(retry.status).toBe(200);
    expect(storedInventory[0][0]).toMatchObject({ name: 'Offer' });
  });

  test('sell_ironAboveResearchCapacityButBelowBonusedCapacity_addsFullPrice', async () => {
    const owned = commander('Owned', 0.5);
    storedInventory[0][0] = owned;
    user.iron = BASE_CAPACITY + 100; // allowed because of the level bonus
    expect(BASE_CAPACITY + 100 + commanderSellPrice(owned)).toBeLessThan(BONUSED_CAPACITY);

    const { status, data } = await sell(0, 0);

    expect(status).toBe(200);
    expect(data.ironEarned).toBe(commanderSellPrice(owned));
    expect(user.iron).toBe(BASE_CAPACITY + 100 + commanderSellPrice(owned));
    expect(storedInventory[0][0]).toBeNull();
  });

  test('sell_nearBonusedCapacity_capsAtBonusedCapacityAndReportsActualGain', async () => {
    storedInventory[0][0] = commander('Owned');
    user.iron = BONUSED_CAPACITY - 1;

    const { data } = await sell(0, 0);

    expect(user.iron).toBe(BONUSED_CAPACITY);
    expect(data.ironEarned).toBe(1);
    expect(data.newIron).toBe(BONUSED_CAPACITY);
  });
});
