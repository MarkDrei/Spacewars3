import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as autoTransferPOST } from '@/app/api/bridge/transfer/auto/route';
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { Commander } from '@/lib/server/inventory/Commander';
import { createEmptyInventoryGrid, createEmptyBridgeGrid, InventoryGrid } from '@/lib/server/inventory/inventoryTypes';
import { getDatabase } from '@/lib/server/database';

async function seedInventoryAndBridge(
  userId: number,
  invMutator: (grid: InventoryGrid) => void,
  bridgeMutator: (grid: InventoryGrid) => void = () => {},
  bridgeSlotCount: number | null = null
) {
  const inv = createEmptyInventoryGrid();
  invMutator(inv);
  const bridge = createEmptyBridgeGrid(bridgeSlotCount ?? undefined);
  bridgeMutator(bridge);
  const db = await getDatabase();
  await db.query(
    `INSERT INTO inventories (user_id, inventory_data, bridge_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
     SET inventory_data = EXCLUDED.inventory_data,
         bridge_data = EXCLUDED.bridge_data`,
    [userId, JSON.stringify(inv), JSON.stringify(bridge)]
  );

  if (bridgeSlotCount !== null) {
    // compute research level from desired slot count (4 slots per level)
    const level = Math.max(1, Math.floor(bridgeSlotCount / 4));

    // update user's tech tree to grant this bridge research level
    await db.query(
      `UPDATE users SET tech_tree = jsonb_set(coalesce(tech_tree::jsonb, '{}'), '{bridgeSlots}', to_jsonb($1::int), true) WHERE id = $2`,
      [level, userId]
    );

    // ensure cache reflects the change so subsequent API calls use updated slot count
    try {
      const { UserCache } = await import('@/lib/server/user/userCache');
      const { USER_LOCK } = await import('@/lib/server/typedLocks');
      const { createLockContext } = await import('@markdrei/ironguard-typescript-locks');
      const cache = UserCache.getInstance2();
      const ctx = createLockContext();
      await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await cache.getUserByIdWithLock(userCtx, userId);
        if (user) {
          user.techTree.bridgeSlots = level;
          await cache.updateUserInCache(userCtx, user);
        }
      });
    } catch {
      // if cache isn't initialized yet or import fails, ignore
    }
  }
}

describe('Bridge auto-transfer API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  it('autoTransfer_notAuthenticated_returns401', async () => {
    await withTransaction(async () => {
      const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
        direction: 'inventoryToBridge',
        from: { row: 0, col: 0 },
      });
      const response = await autoTransferPOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });

  it('inventoryToBridge_emptySlot_returns400', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('auto1');
      const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
        direction: 'inventoryToBridge',
        from: { row: 0, col: 0 },
      }, sessionCookie);
      const response = await autoTransferPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('empty');
    });
  });

  it('inventoryToBridge_validMove_placesItemAndRespondsWithDest', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('auto2');
      const db = await getDatabase();
      const userRow = await db.query<{ id: number }>(
        `SELECT id FROM users ORDER BY id DESC LIMIT 1`
      );
      const userId = userRow.rows[0].id;
      const commander = Commander.random('Zed');
      await seedInventoryAndBridge(
        userId,
        (grid) => { grid[0][0] = commander.toJSON(); },
        () => {},
        4 // give at least one bridge level (4 slots)
      );

      const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
        direction: 'inventoryToBridge',
        from: { row: 0, col: 0 },
      }, sessionCookie);
      const response = await autoTransferPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.to).toEqual({ row: 0, col: 0 });

      // verify inventory is now empty and bridge has the commander
      const { GET: invGET } = await import('@/app/api/inventory/route');
      const invReq = createRequest('http://localhost:3000/api/inventory', 'GET', undefined, sessionCookie);
      const invResp = await invGET(invReq);
      const invGrid = (await invResp.json()).grid;
      expect(invGrid[0][0]).toBeNull();

      const { GET: bridgeGET } = await import('@/app/api/bridge/route');
      const bridgeReq = createRequest('http://localhost:3000/api/bridge', 'GET', undefined, sessionCookie);
      const bridgeResp = await bridgeGET(bridgeReq);
      const bridgeGrid = (await bridgeResp.json()).grid;
      expect(bridgeGrid[0][0]).not.toBeNull();
      expect(bridgeGrid[0][0].name).toBe(commander.name);
    });
  });

  it('inventoryToBridge_fullBridge_returns400', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('auto3');
      const db = await getDatabase();
      const userRow = await db.query<{ id: number }>(
        `SELECT id FROM users ORDER BY id DESC LIMIT 1`
      );
      const userId = userRow.rows[0].id;
      // put item in inventory and fill bridge
      await seedInventoryAndBridge(
        userId,
        (grid) => { grid[0][0] = Commander.random('X').toJSON(); },
        (grid) => {
          for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
              grid[r][c] = Commander.random('B').toJSON();
            }
          }
        },
        4
      );

      // sanity-check: bridge should be full
      const { GET: bridgeGET } = await import('@/app/api/bridge/route');
      const bridgeReq = createRequest('http://localhost:3000/api/bridge', 'GET', undefined, sessionCookie);
      const bridgeResp = await bridgeGET(bridgeReq);
      const bgrid = (await bridgeResp.json()).grid;
      console.log('DEBUG fullBridge bgrid', JSON.stringify(bgrid));
      // all slots should be occupied
      for (const row of bgrid) {
        for (const slot of row) {
          expect(slot).not.toBeNull();
        }
      }

      const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
        direction: 'inventoryToBridge',
        from: { row: 0, col: 0 },
      }, sessionCookie);
      const response = await autoTransferPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('full');
    });
  });

  it('bridgeToInventory_validMove_placesItemAndRespondsWithDest', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('auto4');
      const db = await getDatabase();
      const userRow = await db.query<{ id: number }>(
        `SELECT id FROM users ORDER BY id DESC LIMIT 1`
      );
      const userId = userRow.rows[0].id;
      await seedInventoryAndBridge(
        userId,
        () => {},
        (grid) => { grid[0][0] = Commander.random('Y').toJSON(); },
        4
      );

      const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
        direction: 'bridgeToInventory',
        from: { row: 0, col: 0 },
      }, sessionCookie);
      const response = await autoTransferPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.to).toEqual({ row: 0, col: 0 });

      // inventory should now contain the commander
      const { GET: invGET } = await import('@/app/api/inventory/route');
      const invReq = createRequest('http://localhost:3000/api/inventory', 'GET', undefined, sessionCookie);
      const invResp = await invGET(invReq);
      const invGrid = (await invResp.json()).grid;
      expect(invGrid[0][0]).not.toBeNull();

      const { GET: bridgeGET } = await import('@/app/api/bridge/route');
      const bridgeReq = createRequest('http://localhost:3000/api/bridge', 'GET', undefined, sessionCookie);
      const bridgeResp = await bridgeGET(bridgeReq);
      const bridgeGrid = (await bridgeResp.json()).grid;
      expect(bridgeGrid[0][0]).toBeNull();
    });
  });

  it('bridgeToInventory_fullInventory_returns400', async () => {
    await withTransaction(async () => {
      const sessionCookie = await createAuthenticatedSession('auto5');
      const db = await getDatabase();
      const userRow = await db.query<{ id: number }>(
        `SELECT id FROM users ORDER BY id DESC LIMIT 1`
      );
      const userId = userRow.rows[0].id;
      // fill inventory but place one item on bridge
      await seedInventoryAndBridge(
        userId,
        (grid) => {
          for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
              grid[r][c] = Commander.random('I').toJSON();
            }
          }
        },
        (grid) => { grid[0][0] = Commander.random('J').toJSON(); },
        4
      );

      const request = createRequest('http://localhost:3000/api/bridge/transfer/auto', 'POST', {
        direction: 'bridgeToInventory',
        from: { row: 0, col: 0 },
      }, sessionCookie);
      const response = await autoTransferPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('full');
    });
  });
});
