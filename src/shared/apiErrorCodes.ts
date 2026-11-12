/**
 * Machine-readable `code` values of API error responses that the client reacts to
 * (in addition to the human-readable `error` text, which is English only).
 */

/** HTTP 429: too many attempts for an authentication endpoint (see `src/lib/server/rateLimit.ts`). */
export const RATE_LIMITED_CODE = 'RATE_LIMITED';
