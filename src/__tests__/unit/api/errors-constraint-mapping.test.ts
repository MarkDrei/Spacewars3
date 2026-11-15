import { describe, it, expect, vi } from 'vitest';
import { handleApiError, ApiError } from '@/lib/server/errors';

/** Shape of a `pg` DatabaseError for a unique violation. */
function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: '23505',
    constraint,
  });
}

describe('handleApiError — unique constraint error mapping', () => {
  it('handleApiError_uniqueViolationOfEmailIndex_returnsEmailAlreadyInUse', async () => {
    const response = handleApiError(uniqueViolation('idx_users_email'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Email already in use' });
  });

  it('handleApiError_uniqueViolationOfAnotherConstraint_returns500', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = handleApiError(uniqueViolation('inventories_pkey'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server error' });
    errorLog.mockRestore();
  });

  it('handleApiError_messageMentionsEmailWithoutErrorCode_returns500', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = handleApiError(new Error('could not send email: duplicate key value violates unique constraint'));

    expect(response.status).toBe(500);
    errorLog.mockRestore();
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
