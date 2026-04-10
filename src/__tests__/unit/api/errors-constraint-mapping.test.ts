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
