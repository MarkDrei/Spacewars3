import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { GET as worldGET } from '@/app/api/world/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { WorldCache } from '@/lib/server/world/worldCache';
import { World } from '@/lib/server/world/world';
import type { DatabaseConnection } from '@/lib/server/database';
import { DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT } from '@shared/worldConstants';

const createMockDb = () =>
  ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
  }) as unknown as DatabaseConnection;

describe('World API', () => {
  test('world_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/world', 'GET');

    const response = await worldGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  describe('authenticated requests', () => {
    beforeEach(() => {
      const db = createMockDb();
      const world = new World(
        { width: DEFAULT_WORLD_WIDTH, height: DEFAULT_WORLD_HEIGHT },
        [],
        async () => {},
        db,
      );
      WorldCache.resetInstance();
      WorldCache.initializeWithWorld(world, db, { enableAutoPersistence: false });
    });

    afterEach(async () => {
      try {
        await WorldCache.getInstance().shutdown();
      } catch {
        // ignore if already torn down
      }
      WorldCache.resetInstance();
    });

    test('world_authenticated_returnsStarbasesInSpaceObjects', async () => {
      const sessionCookie = await createMockSessionCookie();
      const request = createRequest('http://localhost:3000/api/world', 'GET', undefined, sessionCookie);

      const response = await worldGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.spaceObjects).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'starbase', id: 9001 })]),
      );
    });
  });
});
