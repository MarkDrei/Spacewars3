import { describe, expect, test } from 'vitest';
import { POST as buildItemPOST } from '@/app/api/build-item/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';

// Auth guard and input-validation tests for the build-item route.
// requireAuth() fires before any DB/cache access — no DB needed.

describe('Build Item API - auth guard (unit)', () => {
  test('buildItem_notAuthenticated_returns401', async () => {
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'pulse_laser',
      itemType: 'weapon',
    });
    const response = await buildItemPOST(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});

describe('Build Item API - input validation (unit)', () => {
  test('buildItem_invalidItemType_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'pulse_laser',
      itemType: 'invalid',
    }, sessionCookie);
    const response = await buildItemPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid item type');
  });

  test('buildItem_countZero_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'pulse_laser',
      itemType: 'weapon',
      count: 0,
    }, sessionCookie);
    const response = await buildItemPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Count must be an integer between 1 and 100');
  });

  test('buildItem_countTooLarge_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'pulse_laser',
      itemType: 'weapon',
      count: 101,
    }, sessionCookie);
    const response = await buildItemPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Count must be an integer between 1 and 100');
  });

  test('buildItem_countNonInteger_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'pulse_laser',
      itemType: 'weapon',
      count: 1.5,
    }, sessionCookie);
    const response = await buildItemPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Count must be an integer between 1 and 100');
  });

  test('buildItem_unknownItem_returns400', async () => {
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'nonexistent_weapon',
      itemType: 'weapon',
      count: 1,
    }, sessionCookie);
    const response = await buildItemPOST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('Unknown weapon');
  });

  test('buildItem_defaultCount_passesCountValidation', async () => {
    // count defaults to 1, validation should not trigger for a valid item type
    // Route proceeds past count validation and fails at item lookup (no DB)
    const sessionCookie = await createMockSessionCookie();
    const request = createRequest('http://localhost:3000/api/build-item', 'POST', {
      itemKey: 'nonexistent_weapon',
      itemType: 'weapon',
      // no count provided — defaults to 1
    }, sessionCookie);
    const response = await buildItemPOST(request);
    const data = await response.json();
    // Should fail at item lookup, not at count validation
    expect(data.error).not.toContain('Count must be an integer');
  });
});
