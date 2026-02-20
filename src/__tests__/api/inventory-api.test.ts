import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, DELETE } from '@/app/api/inventory/route';
import { POST as inventoryMovePOST } from '@/app/api/inventory/move/route';
import { createRequest, createAuthenticatedSession } from '../helpers/apiTestHelpers';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';
import { Commander } from '@/lib/server/inventory/Commander';
import { createEmptyInventoryGrid } from '@/lib/server/inventory/inventoryTypes';
import { getDatabase } from '@/lib/server/database';

/**
 * Seed inventory data for a user directly via SQL, staying within the test transaction.
 * Using InventoryService would break AsyncLocalStorage context due to ironguard lock scheduling.
 */
async function seedInventory(
  userId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gridMutator: (grid: any[][]) => void
): Promise<void> {
  const grid = createEmptyInventoryGrid();
  gridMutator(grid);
  const db = await getDatabase();
  await db.query(
    `INSERT INTO inventories (user_id, inventory_data)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET inventory_data = EXCLUDED.inventory_data`,
    [userId, JSON.stringify(grid)]
  );
}

describe('Inventory API', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  // ---------------------------------------------------------------------------
  // GET /api/inventory
  // ---------------------------------------------------------------------------

  describe('GET /api/inventory', () => {
    it('inventoryGet_notAuthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest('http://localhost:3000/api/inventory', 'GET');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Not authenticated');
      });
    });

    it('inventoryGet_authenticatedUser_returnsEmptyGrid', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invgetuser');

        const request = createRequest(
          'http://localhost:3000/api/inventory',
          'GET',
          undefined,
          sessionCookie
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('grid');
        expect(data).toHaveProperty('maxSlots');
        expect(Array.isArray(data.grid)).toBe(true);
        expect(data.grid).toHaveLength(2);   // DEFAULT_INVENTORY_SLOTS=16 → 2 rows
        expect(data.grid[0]).toHaveLength(8); // INVENTORY_COLS=8
        expect(data.maxSlots).toBe(16);       // level 1 = 16 slots
        // All slots should be null for a new user
        for (const row of data.grid) {
          for (const slot of row) {
            expect(slot).toBeNull();
          }
        }
      });
    });

    it('inventoryGet_userWithItem_returnsGridWithItem', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invitemuser');

        const db = await getDatabase();
        const userRow = await db.query<{ id: number }>(
          `SELECT id FROM users ORDER BY id DESC LIMIT 1`
        );
        const userId = userRow.rows[0].id;

        const commander = Commander.random('Aria');
        await seedInventory(userId, (grid) => { grid[0][0] = commander.toJSON(); });

        const request = createRequest(
          'http://localhost:3000/api/inventory',
          'GET',
          undefined,
          sessionCookie
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.grid[0][0]).not.toBeNull();
        expect(data.grid[0][0].itemType).toBe('commander');
        expect(data.grid[0][0].name).toBe('Aria');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/inventory
  // ---------------------------------------------------------------------------

  describe('DELETE /api/inventory', () => {
    it('inventoryDelete_notAuthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest(
          'http://localhost:3000/api/inventory',
          'DELETE',
          { row: 0, col: 0 }
        );
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Not authenticated');
      });
    });

    it('inventoryDelete_emptySlot_returns400', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invdeluser');

        const request = createRequest(
          'http://localhost:3000/api/inventory',
          'DELETE',
          { row: 0, col: 0 },
          sessionCookie
        );
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('empty');
      });
    });

    it('inventoryDelete_existingItem_removesItem', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invdelitemuser');

        const db = await getDatabase();
        const userRow = await db.query<{ id: number }>(
          `SELECT id FROM users ORDER BY id DESC LIMIT 1`
        );
        const userId = userRow.rows[0].id;

        const commander = Commander.random('Zara');
        await seedInventory(userId, (grid) => { grid[0][3] = commander.toJSON(); });

        const request = createRequest(
          'http://localhost:3000/api/inventory',
          'DELETE',
          { row: 0, col: 3 },
          sessionCookie
        );
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.removed).toBeDefined();
        expect(data.removed.itemType).toBe('commander');
        expect(data.removed.name).toBe('Zara');

        // Verify grid is empty at that slot via the GET API
        const getReq = createRequest('http://localhost:3000/api/inventory', 'GET', undefined, sessionCookie);
        const getResp = await GET(getReq);
        const getGrid = (await getResp.json()).grid;
        expect(getGrid[0][3]).toBeNull();
      });
    });

    it('inventoryDelete_missingRowCol_returns400', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invdelbaduser');

        const request = createRequest(
          'http://localhost:3000/api/inventory',
          'DELETE',
          { foo: 'bar' },
          sessionCookie
        );
        const response = await DELETE(request);
        await response.json();

        expect(response.status).toBe(400);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/inventory/move
  // ---------------------------------------------------------------------------

  describe('POST /api/inventory/move', () => {
    it('inventoryMove_notAuthenticated_returns401', async () => {
      await withTransaction(async () => {
        const request = createRequest(
          'http://localhost:3000/api/inventory/move',
          'POST',
          { from: { row: 0, col: 0 }, to: { row: 1, col: 1 } }
        );
        const response = await inventoryMovePOST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Not authenticated');
      });
    });

    it('inventoryMove_emptySourceSlot_returns400', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invmovempty');

        const request = createRequest(
          'http://localhost:3000/api/inventory/move',
          'POST',
          { from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
          sessionCookie
        );
        const response = await inventoryMovePOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('empty');
      });
    });

    it('inventoryMove_validMove_movesItem', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invmoveuser');

        const db = await getDatabase();
        const userRow = await db.query<{ id: number }>(
          `SELECT id FROM users ORDER BY id DESC LIMIT 1`
        );
        const userId = userRow.rows[0].id;

        const commander = Commander.random('Kyra');
        await seedInventory(userId, (grid) => { grid[0][0] = commander.toJSON(); });

        const request = createRequest(
          'http://localhost:3000/api/inventory/move',
          'POST',
          { from: { row: 0, col: 0 }, to: { row: 1, col: 5 } },
          sessionCookie
        );
        const response = await inventoryMovePOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify via GET API
        const getReq = createRequest('http://localhost:3000/api/inventory', 'GET', undefined, sessionCookie);
        const afterGrid = (await (await GET(getReq)).json()).grid;
        expect(afterGrid[0][0]).toBeNull();
        expect(afterGrid[1][5]).not.toBeNull();
        expect((afterGrid[1][5] as { name: string }).name).toBe('Kyra');
      });
    });

    it('inventoryMove_destinationOccupied_returns400', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invmoveoccupied');

        const db = await getDatabase();
        const userRow = await db.query<{ id: number }>(
          `SELECT id FROM users ORDER BY id DESC LIMIT 1`
        );
        const userId = userRow.rows[0].id;

        await seedInventory(userId, (grid) => {
          grid[0][0] = Commander.random('A').toJSON();
          grid[1][0] = Commander.random('B').toJSON();
        });

        const request = createRequest(
          'http://localhost:3000/api/inventory/move',
          'POST',
          { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } },
          sessionCookie
        );
        const response = await inventoryMovePOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('occupied');
      });
    });

    it('inventoryMove_missingPayload_returns400', async () => {
      await withTransaction(async () => {
        const sessionCookie = await createAuthenticatedSession('invmovebad');

        const request = createRequest(
          'http://localhost:3000/api/inventory/move',
          'POST',
          { from: { row: 0 } }, // missing col and to
          sessionCookie
        );
        const response = await inventoryMovePOST(request);
        await response.json();

        expect(response.status).toBe(400);
      });
    });
  });
});
