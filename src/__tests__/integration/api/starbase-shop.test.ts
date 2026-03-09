import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as buyPOST } from '@/app/api/starbase/buy/route';
import { POST as sellPOST } from '@/app/api/starbase/sell/route';
import { createRequest, createAuthenticatedSession } from '../../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { Commander } from '@/lib/server/inventory/Commander';
import { createEmptyInventoryGrid, DEFAULT_INVENTORY_SLOTS } from '@/lib/server/inventory/inventoryTypes';
import { getDatabase } from '@/lib/server/database';
import { commanderBuyPrice } from '@/lib/server/starbase/commanderPrice';
import { sessionOptions } from '@/lib/server/session';
import { sealData } from 'iron-session';
import { UserCache } from '@/lib/server/user/userCache';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';

async function setUserIronAndEvictCache(userId: number, iron: number): Promise<void> {
  const db = await getDatabase();
  await db.query('UPDATE users SET iron = $1 WHERE id = $2', [iron, userId]);
  // Evict from UserCache so the route loads fresh iron from DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (UserCache.getInstance2() as any).users.delete(userId);
}

async function getLatestUserId(): Promise<number> {
  const db = await getDatabase();
  const result = await db.query<{ id: number }>('SELECT id FROM users ORDER BY id DESC LIMIT 1');
  return result.rows[0].id;
}

async function seedCommanderInInventory(userId: number, commander: Commander): Promise<void> {
  const grid = createEmptyInventoryGrid();
  grid[0][0] = commander.toJSON();
  const db = await getDatabase();
  await db.query(
    `INSERT INTO inventories (user_id, inventory_data)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET inventory_data = EXCLUDED.inventory_data`,
    [userId, JSON.stringify(grid)]
  );
}

/**
 * Set the user's inventorySlots research level and evict the user from cache.
 * At level 2 the formula gives 16 + 8*(2-1) = 24 slots.
 */
async function setInventorySlotsLevelAndEvictCache(userId: number, level: number): Promise<void> {
  const db = await getDatabase();
  await db.query(
    `UPDATE users SET tech_tree = jsonb_set(coalesce(tech_tree::jsonb, '{}'), '{inventorySlots}', to_jsonb($1::int), true) WHERE id = $2`,
    [level, userId]
  );
  // Evict from cache so the route loads fresh tech tree from DB
  const cache = UserCache.getInstance2();
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    const user = await cache.getUserByIdWithLock(userCtx, userId);
    if (user) {
      user.techTree.inventorySlots = level;
      await cache.updateUserInCache(userCtx, user);
    }
  });
}

/**
 * Seed an inventory that fills the first `DEFAULT_INVENTORY_SLOTS` (16) slots with commanders.
 * Used to test that buying into expanded slots (rows ≥ 2) still works.
 */
async function seedFullDefaultInventory(userId: number): Promise<void> {
  const grid = createEmptyInventoryGrid(DEFAULT_INVENTORY_SLOTS);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      grid[r][c] = Commander.random().toJSON();
    }
  }
  const db = await getDatabase();
  await db.query(
    `INSERT INTO inventories (user_id, inventory_data)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET inventory_data = EXCLUDED.inventory_data`,
    [userId, JSON.stringify(grid)]
  );
}

/** Create a session cookie that includes both userId and starbaseShop. */
async function createShopSessionCookie(userId: number, shopCommanders: ReturnType<Commander['toJSON']>[]): Promise<string> {
  const password = sessionOptions.password as string;
  const ttl = (sessionOptions.cookieOptions?.maxAge as number | undefined) ?? 86400;
  const sealed = await sealData({ userId, starbaseShop: shopCommanders }, { password, ttl });
  return `spacewars-session=${sealed}`;
}

describe('Starbase Shop API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  describe('buyCommander', () => {
    it('buyCommander_sufficientIron_deductsIronAndAddsToInventory', async () => {
      await withTransaction(async () => {
        await createAuthenticatedSession('buyok');
        const userId = await getLatestUserId();

        const shopCommanders = Array.from({ length: 10 }, () => Commander.random().toJSON());
        const price = commanderBuyPrice(shopCommanders[0]);

        await setUserIronAndEvictCache(userId, price);

        const shopCookie = await createShopSessionCookie(userId, shopCommanders);

        const buyReq = createRequest('http://localhost:3000/api/starbase/buy', 'POST', { slotIndex: 0 }, shopCookie);
        const buyRes = await buyPOST(buyReq);
        const buyData = await buyRes.json();

        expect(buyRes.status).toBe(200);
        expect(buyData.success).toBe(true);
        expect(buyData.newIron).toBe(0);
      });
    });

    it('buyCommander_insufficientIron_returns400', async () => {
      await withTransaction(async () => {
        await createAuthenticatedSession('buyfail');
        const userId = await getLatestUserId();

        const shopCommanders = Array.from({ length: 10 }, () => Commander.random().toJSON());

        await setUserIronAndEvictCache(userId, 0);

        const shopCookie = await createShopSessionCookie(userId, shopCommanders);

        const buyReq = createRequest('http://localhost:3000/api/starbase/buy', 'POST', { slotIndex: 0 }, shopCookie);
        const buyRes = await buyPOST(buyReq);

        expect(buyRes.status).toBe(400);
      });
    });

    it('buyCommander_invalidSlotIndex_returns400', async () => {
      await withTransaction(async () => {
        await createAuthenticatedSession('buybadslot');
        const userId = await getLatestUserId();

        const shopCommanders = Array.from({ length: 10 }, () => Commander.random().toJSON());
        const shopCookie = await createShopSessionCookie(userId, shopCommanders);

        const buyReq = createRequest('http://localhost:3000/api/starbase/buy', 'POST', { slotIndex: 15 }, shopCookie);
        const buyRes = await buyPOST(buyReq);

        expect(buyRes.status).toBe(400);
      });
    });

    it('buyCommander_expandedInventory_addsToSlotBeyondDefault16', async () => {
      await withTransaction(async () => {
        await createAuthenticatedSession('buyexpand');
        const userId = await getLatestUserId();

        // Give user 24 inventory slots (level 2 research) and fill the first 16
        await setInventorySlotsLevelAndEvictCache(userId, 2);
        await seedFullDefaultInventory(userId);

        const shopCommanders = Array.from({ length: 10 }, () => Commander.random().toJSON());
        const price = commanderBuyPrice(shopCommanders[0]);
        await setUserIronAndEvictCache(userId, price);

        const shopCookie = await createShopSessionCookie(userId, shopCommanders);

        const buyReq = createRequest('http://localhost:3000/api/starbase/buy', 'POST', { slotIndex: 0 }, shopCookie);
        const buyRes = await buyPOST(buyReq);
        const buyData = await buyRes.json();

        expect(buyRes.status).toBe(200);
        expect(buyData.success).toBe(true);
        expect(buyData.newIron).toBe(0);
      });
    });
  });

  describe('sellCommander', () => {
    it('sellCommander_commanderInInventory_addsIronAndRemovesItem', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('sellok');
        const userId = await getLatestUserId();

        const commander = Commander.random();
        await seedCommanderInInventory(userId, commander);

        const sellReq = createRequest('http://localhost:3000/api/starbase/sell', 'POST', { row: 0, col: 0 }, sessionCookie);
        const sellRes = await sellPOST(sellReq);
        const sellData = await sellRes.json();

        expect(sellRes.status).toBe(200);
        expect(sellData.success).toBe(true);
        expect(sellData.ironEarned).toBeGreaterThan(0);
        expect(sellData.newIron).toBe(sellData.ironEarned);
      });
    });

    it('sellCommander_emptySlot_returns400', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('sellempty');

        const sellReq = createRequest('http://localhost:3000/api/starbase/sell', 'POST', { row: 0, col: 0 }, sessionCookie);
        const sellRes = await sellPOST(sellReq);

        expect(sellRes.status).toBe(400);
      });
    });

    it('sellCommander_expandedInventoryRow2_addsIronAndRemovesItem', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('sellrow2');
        const userId = await getLatestUserId();

        // Give the user 24 inventory slots (level 2 = 16 + 8*(2-1) = 24 slots)
        await setInventorySlotsLevelAndEvictCache(userId, 2);

        // Place a commander in row 2 (slot 17) — only valid with 24-slot inventory
        const commander = Commander.random();
        const grid = createEmptyInventoryGrid(24);
        grid[2][0] = commander.toJSON();
        const db = await getDatabase();
        await db.query(
          `INSERT INTO inventories (user_id, inventory_data)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET inventory_data = EXCLUDED.inventory_data`,
          [userId, JSON.stringify(grid)]
        );

        const sellReq = createRequest('http://localhost:3000/api/starbase/sell', 'POST', { row: 2, col: 0 }, sessionCookie);
        const sellRes = await sellPOST(sellReq);
        const sellData = await sellRes.json();

        expect(sellRes.status).toBe(200);
        expect(sellData.success).toBe(true);
        expect(sellData.ironEarned).toBeGreaterThan(0);
        expect(sellData.newIron).toBe(sellData.ironEarned);
      });
    });
  });
});
