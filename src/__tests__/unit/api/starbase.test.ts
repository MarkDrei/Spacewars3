import { describe, expect, test } from 'vitest';
import { GET as shopGET } from '@/app/api/starbase/shop/route';
import { POST as buyPOST } from '@/app/api/starbase/buy/route';
import { POST as sellPOST } from '@/app/api/starbase/sell/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('GET /api/starbase/shop', () => {
  test('shop_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/starbase/shop', 'GET');
    const response = await shopGET(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});

describe('POST /api/starbase/buy', () => {
  test('buy_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/starbase/buy', 'POST', {
      slotIndex: 0,
    });
    const response = await buyPOST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('buy_invalidSlotIndex_returns400', async () => {
    const { createMockSessionCookie } = await import('../../helpers/apiTestHelpers');
    const cookie = await createMockSessionCookie(1);
    const request = createRequest('http://localhost:3000/api/starbase/buy', 'POST', {
      slotIndex: 99,
    }, cookie);
    const response = await buyPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
  });

  test('buy_negativeSlotIndex_returns400', async () => {
    const { createMockSessionCookie } = await import('../../helpers/apiTestHelpers');
    const cookie = await createMockSessionCookie(1);
    const request = createRequest('http://localhost:3000/api/starbase/buy', 'POST', {
      slotIndex: -1,
    }, cookie);
    const response = await buyPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
  });
});

describe('POST /api/starbase/sell', () => {
  test('sell_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/starbase/sell', 'POST', {
      row: 0,
      col: 0,
    });
    const response = await sellPOST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  test('sell_negativeRow_returns400', async () => {
    const { createMockSessionCookie } = await import('../../helpers/apiTestHelpers');
    const cookie = await createMockSessionCookie(1);
    const request = createRequest('http://localhost:3000/api/starbase/sell', 'POST', {
      row: -1,
      col: 0,
    }, cookie);
    const response = await sellPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
  });
});
