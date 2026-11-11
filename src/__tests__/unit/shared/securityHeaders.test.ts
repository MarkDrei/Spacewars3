import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders } from '@/shared/securityHeaders';

function headerValue(isProduction: boolean, key: string): string | undefined {
  return buildSecurityHeaders(isProduction).find(header => header.key === key)?.value;
}

describe('buildSecurityHeaders', () => {
  it('buildSecurityHeaders_anyEnvironment_forbidsEmbeddingInOtherWebsites', () => {
    expect(headerValue(false, 'Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(headerValue(false, 'X-Frame-Options')).toBe('DENY');
  });

  it('buildSecurityHeaders_anyEnvironment_restrictsBaseUriFormTargetsAndPlugins', () => {
    const policy = headerValue(true, 'Content-Security-Policy');

    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("object-src 'none'");
  });

  it('buildSecurityHeaders_anyEnvironment_disablesMimeSniffingAndLimitsReferrer', () => {
    expect(headerValue(false, 'X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue(false, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('buildSecurityHeaders_production_enforcesHttpsWithoutSubdomains', () => {
    const hsts = headerValue(true, 'Strict-Transport-Security');

    expect(hsts).toBe('max-age=15552000');
    expect(hsts).not.toContain('includeSubDomains');
  });

  it('buildSecurityHeaders_development_doesNotEnforceHttps', () => {
    expect(headerValue(false, 'Strict-Transport-Security')).toBeUndefined();
  });
});
