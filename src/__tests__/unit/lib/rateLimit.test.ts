import { describe, it, expect } from 'vitest';
import {
  RateLimiter,
  RateLimitError,
  assertNotRateLimited,
  consumeRateLimit,
  getAuthRateLimits,
  getClientIp,
} from '@/lib/server/rateLimit';
import { handleApiError } from '@/lib/server/errors';

const NOW = 1_700_000_000_000;

function createLimiter(limit: number, windowMs: number, maxEntries?: number) {
  const clock = { now: NOW };
  const limiter = new RateLimiter({ limit, windowMs }, () => clock.now, maxEntries);
  return { limiter, clock };
}

describe('RateLimiter', () => {
  it('retryAfterSeconds_belowLimit_returnsZero', () => {
    const { limiter } = createLimiter(3, 60_000);

    limiter.hit('1.2.3.4');
    limiter.hit('1.2.3.4');

    expect(limiter.retryAfterSeconds('1.2.3.4')).toBe(0);
  });

  it('retryAfterSeconds_limitReached_returnsRemainingWindowInSeconds', () => {
    const { limiter, clock } = createLimiter(2, 60_000);
    limiter.hit('1.2.3.4');
    clock.now += 10_000;
    limiter.hit('1.2.3.4');

    // The window started with the first hit: 50 s of 60 s are left
    expect(limiter.retryAfterSeconds('1.2.3.4')).toBe(50);
  });

  it('retryAfterSeconds_otherKey_isNotAffected', () => {
    const { limiter } = createLimiter(1, 60_000);
    limiter.hit('1.2.3.4');

    expect(limiter.retryAfterSeconds('5.6.7.8')).toBe(0);
  });

  it('retryAfterSeconds_windowExpired_returnsZeroAndStartsNewWindow', () => {
    const { limiter, clock } = createLimiter(1, 60_000);
    limiter.hit('1.2.3.4');
    clock.now += 60_000;

    expect(limiter.retryAfterSeconds('1.2.3.4')).toBe(0);
    limiter.hit('1.2.3.4');
    expect(limiter.retryAfterSeconds('1.2.3.4')).toBe(60);
  });

  it('reset_limitedKey_isAllowedAgain', () => {
    const { limiter } = createLimiter(1, 60_000);
    limiter.hit('alice');

    limiter.reset('alice');

    expect(limiter.retryAfterSeconds('alice')).toBe(0);
  });

  it('hit_keyInDifferentCaseAndWithSpaces_countsForTheSameKey', () => {
    const { limiter } = createLimiter(2, 60_000);

    limiter.hit('Alice');
    limiter.hit(' alice ');

    expect(limiter.retryAfterSeconds('ALICE')).toBeGreaterThan(0);
  });

  it('hit_veryLongKeys_areCappedSoTheyShareACounter', () => {
    const { limiter } = createLimiter(2, 60_000);
    const prefix = 'x'.repeat(100);

    limiter.hit(prefix + 'first-tail');
    limiter.hit(prefix + 'second-tail');

    expect(limiter.retryAfterSeconds(prefix)).toBeGreaterThan(0);
  });

  it('hit_moreKeysThanMaxEntries_dropsExpiredEntriesFirst', () => {
    const { limiter, clock } = createLimiter(1, 60_000, 2);
    limiter.hit('expired');
    clock.now += 60_000;
    limiter.hit('active');

    limiter.hit('new');

    expect(limiter.retryAfterSeconds('active')).toBeGreaterThan(0);
    expect(limiter.retryAfterSeconds('new')).toBeGreaterThan(0);
  });

  it('hit_moreActiveKeysThanMaxEntries_dropsTheOldestEntry', () => {
    const { limiter } = createLimiter(1, 60_000, 2);
    limiter.hit('oldest');
    limiter.hit('second');

    limiter.hit('third');

    expect(limiter.retryAfterSeconds('oldest')).toBe(0);
    expect(limiter.retryAfterSeconds('second')).toBeGreaterThan(0);
    expect(limiter.retryAfterSeconds('third')).toBeGreaterThan(0);
  });
});

describe('consumeRateLimit', () => {
  it('consumeRateLimit_upToTheLimit_doesNotThrow', () => {
    const { limiter } = createLimiter(2, 60_000);

    expect(() => {
      consumeRateLimit(limiter, '1.2.3.4');
      consumeRateLimit(limiter, '1.2.3.4');
    }).not.toThrow();
  });

  it('consumeRateLimit_beyondTheLimit_throwsRateLimitErrorWithWaitingTime', () => {
    const { limiter } = createLimiter(1, 90_000);
    consumeRateLimit(limiter, '1.2.3.4');

    let thrown: unknown;
    try {
      consumeRateLimit(limiter, '1.2.3.4');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RateLimitError);
    expect((thrown as RateLimitError).statusCode).toBe(429);
    expect((thrown as RateLimitError).code).toBe('RATE_LIMITED');
    expect((thrown as RateLimitError).retryAfterSeconds).toBe(90);
  });

  it('assertNotRateLimited_calledRepeatedly_doesNotCount', () => {
    const { limiter } = createLimiter(1, 60_000);

    expect(() => {
      assertNotRateLimited(limiter, 'alice');
      assertNotRateLimited(limiter, 'alice');
    }).not.toThrow();
  });
});

describe('handleApiError', () => {
  it('handleApiError_rateLimitError_returns429WithRetryAfterHeader', async () => {
    const response = handleApiError(new RateLimitError(42));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(data.code).toBe('RATE_LIMITED');
  });
});

describe('getClientIp', () => {
  it('getClientIp_singleForwardedAddress_returnsIt', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('getClientIp_clientSentForwardedAddresses_usesOnlyTheEntryOfTheProxy', () => {
    // A client can send its own X-Forwarded-For; the proxy appends the real peer address last
    const headers = new Headers({ 'x-forwarded-for': '10.0.0.1, 198.51.100.9 , 203.0.113.7' });

    expect(getClientIp(headers)).toBe('203.0.113.7');
  });

  it('getClientIp_noForwardedHeader_returnsSharedKey', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});

describe('getAuthRateLimits', () => {
  it('getAuthRateLimits_calledTwice_returnsTheSameCounters', () => {
    expect(getAuthRateLimits()).toBe(getAuthRateLimits());
  });

  it('getAuthRateLimits_countersOfTheProcessCleared_startsWithFreshCounters', () => {
    const { loginByIp } = getAuthRateLimits();
    for (let i = 0; i < 100; i++) loginByIp.hit('1.2.3.4');
    expect(getAuthRateLimits().loginByIp.retryAfterSeconds('1.2.3.4')).toBeGreaterThan(0);

    // What the test setup does before every test
    globalThis.authRateLimitsInstance = undefined;

    expect(getAuthRateLimits().loginByIp.retryAfterSeconds('1.2.3.4')).toBe(0);
  });
});
