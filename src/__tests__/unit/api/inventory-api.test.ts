import { describe, it, expect } from 'vitest';
import { GET, DELETE } from '@/app/api/inventory/route';
import { createRequest } from '../../helpers/apiTestHelpers';

// 401 tests for GET and DELETE: requireAuth() fires before UserCache in both handlers.
// inventory/move is excluded — that route calls UserCache.getInstance2() before requireAuth().

describe('Inventory API - auth guards (unit)', () => {
  it('inventoryGet_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/inventory', 'GET');
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('inventoryDelete_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/inventory', 'DELETE', { row: 0, col: 0 });
    const response = await DELETE(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
