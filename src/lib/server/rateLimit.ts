import { ApiError } from './errors';
import { RATE_LIMITED_CODE } from '@/shared/apiErrorCodes';

/**
 * In-memory rate limiting for the authentication endpoints.
 *
 * Counters live in this server process (one process serves the game, like the caches) and are
 * lost on restart, which only makes the limits more generous for a moment.
 */

export interface RateLimitRule {
  /** Number of counted requests allowed within one window. */
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  windowEnd: number;
}

const MINUTE_MS = 60 * 1000;

/** Keys come from request data (usernames, emails); cap them so they cannot be used to fill memory. */
const MAX_KEY_LENGTH = 100;
const DEFAULT_MAX_ENTRIES = 10_000;

/** Fixed-window counter per key. The window starts with the first counted request. */
export class RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly rule: RateLimitRule,
    private readonly now: () => number = () => Date.now(),
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES
  ) {}

  /** Seconds until the key is allowed again, 0 when it is not limited. */
  retryAfterSeconds(key: string): number {
    const entry = this.activeEntry(key);
    if (!entry || entry.count < this.rule.limit) {
      return 0;
    }
    return Math.ceil((entry.windowEnd - this.now()) / 1000);
  }

  /** Counts one request for the key. */
  hit(key: string): void {
    const entry = this.activeEntry(key);
    if (entry) {
      entry.count++;
      return;
    }
    if (this.entries.size >= this.maxEntries) {
      this.evict();
    }
    this.entries.set(normalizeKey(key), { count: 1, windowEnd: this.now() + this.rule.windowMs });
  }

  /** Forgets the key, e.g. after a successful login. */
  reset(key: string): void {
    this.entries.delete(normalizeKey(key));
  }

  clear(): void {
    this.entries.clear();
  }

  private activeEntry(key: string): RateLimitEntry | undefined {
    const normalized = normalizeKey(key);
    const entry = this.entries.get(normalized);
    if (entry && entry.windowEnd <= this.now()) {
      this.entries.delete(normalized);
      return undefined;
    }
    return entry;
  }

  /** Drops expired entries; if the map is still full, the oldest entry makes room. */
  private evict(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.windowEnd <= now) {
        this.entries.delete(key);
      }
    }
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
  }
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().slice(0, MAX_KEY_LENGTH);
}

/** 429 with the waiting time; `handleApiError` adds it as `Retry-After` header. */
export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds: number) {
    super(429, 'Too many attempts. Please try again later.', RATE_LIMITED_CODE, retryAfterSeconds);
    this.name = 'RateLimitError';
  }
}

/** Throws a RateLimitError when the key has used up its limit. Does not count. */
export function assertNotRateLimited(limiter: RateLimiter, key: string): void {
  const retryAfterSeconds = limiter.retryAfterSeconds(key);
  if (retryAfterSeconds > 0) {
    throw new RateLimitError(retryAfterSeconds);
  }
}

/** Counts the request for the key; throws a RateLimitError when the limit is already used up. */
export function consumeRateLimit(limiter: RateLimiter, key: string): void {
  assertNotRateLimited(limiter, key);
  limiter.hit(key);
}

/**
 * Address of the client as seen by the reverse proxy.
 *
 * The application runs behind exactly one proxy (Traefik), which writes the address of its peer
 * into `X-Forwarded-For`. Only the last entry is written by the proxy; earlier entries can be
 * sent by the client and are ignored. Without the header (local development, tests) all requests
 * share one key.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  const last = forwardedFor?.split(',').pop()?.trim();
  return last || 'unknown';
}

function createAuthRateLimits() {
  return {
    /** All login attempts of an address: bounds password guessing and the bcrypt work it causes. */
    loginByIp: new RateLimiter({ limit: 20, windowMs: 5 * MINUTE_MS }),
    /**
     * Failed logins per username: bounds guessing one account from many addresses.
     * Higher than what one address can reach within the window (60), so a single address cannot
     * lock another player out of their account.
     */
    loginFailuresByUsername: new RateLimiter({ limit: 100, windowMs: 15 * MINUTE_MS }),
    /** Registration attempts of an address, including rejected ones ("username already taken"). */
    registerByIp: new RateLimiter({ limit: 20, windowMs: 60 * MINUTE_MS }),
    /** Reset requests and reset attempts of an address. */
    passwordResetByIp: new RateLimiter({ limit: 10, windowMs: 15 * MINUTE_MS }),
    /** Reset mails per mailbox: nobody can be flooded with reset mails. */
    passwordResetByEmail: new RateLimiter({ limit: 3, windowMs: 60 * MINUTE_MS }),
    /** Wrong current passwords per user (a stolen session must not allow guessing the password). */
    changePasswordFailuresByUser: new RateLimiter({ limit: 10, windowMs: 15 * MINUTE_MS }),
  };
}

export type AuthRateLimits = ReturnType<typeof createAuthRateLimits>;

declare global {
  var authRateLimitsInstance: AuthRateLimits | undefined; // required for globalThis augmentation
}

/** Limiters of the authentication endpoints (on globalThis, like the caches: one set per process). */
export function getAuthRateLimits(): AuthRateLimits {
  globalThis.authRateLimitsInstance ??= createAuthRateLimits();
  return globalThis.authRateLimitsInstance;
}
