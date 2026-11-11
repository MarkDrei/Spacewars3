import { describe, it, expect } from 'vitest';
import { getSessionSecret, sessionOptions } from '@/lib/server/session';

const STRONG_SECRET = 'k3Jd9fLq0Zx7Vb2Nw5Tg8Yh1Rm4Pc6Sa-private';

describe('getSessionSecret', () => {
  it('getSessionSecret_developmentWithoutSecret_returnsDevelopmentFallback', () => {
    const secret = getSessionSecret({ NODE_ENV: 'development' });

    expect(secret.length).toBeGreaterThanOrEqual(32);
  });

  it('getSessionSecret_testWithConfiguredSecret_returnsConfiguredSecret', () => {
    expect(getSessionSecret({ NODE_ENV: 'test', SESSION_SECRET: 'short' })).toBe('short');
  });

  it('getSessionSecret_productionWithStrongSecret_returnsConfiguredSecret', () => {
    expect(getSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: STRONG_SECRET })).toBe(STRONG_SECRET);
  });

  it('getSessionSecret_productionWithoutSecret_throws', () => {
    expect(() => getSessionSecret({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('getSessionSecret_productionWithShortSecret_throws', () => {
    expect(() => getSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'only-20-characters!!' })).toThrow(
      /SESSION_SECRET/
    );
  });

  it.each([
    'your-secret-key-must-be-at-least-32-characters-long',
    'CHANGE_ME_IN_PRODUCTION_NEVER_USE_THIS_DEFAULT',
    'change-this-to-a-strong-random-secret-in-production',
  ])('getSessionSecret_productionWithPublishedPlaceholder_throws (%s)', (placeholder) => {
    expect(() => getSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: placeholder })).toThrow(/SESSION_SECRET/);
  });
});

describe('sessionOptions', () => {
  it('sessionOptions_cookie_isHttpOnlyAndSameSiteLax', () => {
    // SameSite=Lax keeps the session cookie out of cross-site POST requests (CSRF protection)
    expect(sessionOptions.cookieOptions?.httpOnly).toBe(true);
    expect(sessionOptions.cookieOptions?.sameSite).toBe('lax');
  });

  it('sessionOptions_password_resolvesSecretOnAccess', () => {
    expect(typeof sessionOptions.password).toBe('string');
    expect((sessionOptions.password as string).length).toBeGreaterThanOrEqual(32);
  });
});
