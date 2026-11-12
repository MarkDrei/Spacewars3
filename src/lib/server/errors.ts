import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    /** Sent as `Retry-After` header (429 responses). */
    public retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Turns an error thrown in a route handler into the JSON error response.
 *
 * Only unexpected errors are logged. A rejected request (401 of a logged-out tab that keeps
 * polling, 400, 429 of the rate limiter, malformed JSON) is normal operation and is caused by the
 * client: logging it with a stack trace would let anyone fill the log without being logged in.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) {
      console.error('API Error:', error);
    }
    return NextResponse.json(
      { error: error.message, code: error.code },
      {
        status: error.statusCode,
        headers: error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : undefined,
      }
    );
  }

  // request.json() throws a SyntaxError for a malformed body: a client error, not a server error
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  // Backstop for the check in the register route (two requests with the same address at once)
  if (isEmailUniqueViolation(error)) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
  }

  console.error('API Error:', error);
  return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

/** PostgreSQL error code of a unique violation. */
const PG_UNIQUE_VIOLATION = '23505';
/** Partial unique index on `users.email` (see `schema.ts`). */
const EMAIL_UNIQUE_INDEX = 'idx_users_email';

function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const { code, constraint } = error as Error & { code?: unknown; constraint?: unknown };
  return code === PG_UNIQUE_VIOLATION && constraint === EMAIL_UNIQUE_INDEX;
}

export function requireAuth(userId?: number): asserts userId is number {
  if (!userId) {
    throw new ApiError(401, 'Not authenticated');
  }
}

export function validateRequired(value: unknown, fieldName: string): asserts value is string {
  if (!value || typeof value !== 'string') {
    throw new ApiError(400, `Missing or invalid ${fieldName}`);
  }
}
