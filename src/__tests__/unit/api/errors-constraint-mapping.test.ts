import { describe, it, expect } from 'vitest';
import { handleApiError, ApiError } from '@/lib/server/errors';

describe('handleApiError — unique constraint error mapping', () => {
  // ── SQLite ──────────────────────────────────────────────────────────────────

  it('sqlite_uniqueConstraint_username_returnsUsernameTaken', () => {
    const err = new Error('UNIQUE constraint failed: users.username');
    const response = handleApiError(err);
    expect(response.status).toBe(400);

    return response.json().then((body: { error: string }) => {
      expect(body.error).toBe('Username taken');
    });
  });

  it('sqlite_uniqueConstraint_email_returnsEmailAlreadyInUse', () => {
    const err = new Error('UNIQUE constraint failed: users.email');
    const response = handleApiError(err);
    expect(response.status).toBe(400);

    return response.json().then((body: { error: string }) => {
      expect(body.error).toBe('Email already in use');
    });
  });

  // ── PostgreSQL ──────────────────────────────────────────────────────────────

  it('postgres_uniqueConstraint_username_returnsUsernameTaken', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "users_username_key"',
    );
    const response = handleApiError(err);
    expect(response.status).toBe(400);

    return response.json().then((body: { error: string }) => {
      expect(body.error).toBe('Username taken');
    });
  });

  it('postgres_uniqueConstraint_email_returnsEmailAlreadyInUse', () => {
    const err = new Error(
      'duplicate key value violates unique constraint "users_email_key"',
    );
    const response = handleApiError(err);
    expect(response.status).toBe(400);

    return response.json().then((body: { error: string }) => {
      expect(body.error).toBe('Email already in use');
    });
  });

  // ── ApiError passthrough ────────────────────────────────────────────────────

  it('apiError_emailAlreadyInUse_passesThrough', () => {
    const err = new ApiError(400, 'Email already in use');
    const response = handleApiError(err);
    expect(response.status).toBe(400);

    return response.json().then((body: { error: string }) => {
      expect(body.error).toBe('Email already in use');
    });
  });

  it('apiError_usernameTaken_passesThrough', () => {
    const err = new ApiError(400, 'Username taken');
    const response = handleApiError(err);
    expect(response.status).toBe(400);

    return response.json().then((body: { error: string }) => {
      expect(body.error).toBe('Username taken');
    });
  });

  // ── Unknown errors ──────────────────────────────────────────────────────────

  it('unknownError_returns500', () => {
    const response = handleApiError('some string error');
    expect(response.status).toBe(500);
  });
});

describe('handleApiError — malformed request body', () => {
  it('handleApiError_syntaxErrorFromRequestJson_returns400', async () => {
    const response = handleApiError(new SyntaxError('Unexpected token } in JSON at position 1'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON in request body' });
  });

  it('routeHandler_malformedJsonBody_returns400InsteadOf500', async () => {
    const { POST: sellPOST } = await import('@/app/api/starbase/sell/route');
    const { createMockSessionCookie } = await import('../../helpers/apiTestHelpers');
    const { NextRequest } = await import('next/server');
    const request = new NextRequest('http://localhost/api/starbase/sell', {
      method: 'POST',
      body: '{ "row": 0, ',
      headers: { 'content-type': 'application/json', cookie: await createMockSessionCookie(1) },
    });

    const response = await sellPOST(request);

    expect(response.status).toBe(400);
  });
});
