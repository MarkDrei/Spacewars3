/**
 * HTTP response headers that are sent with every page and API response (see `next.config.ts`).
 *
 * This file is imported by `next.config.ts`, so it must not import anything else.
 */

export interface HttpHeader {
  key: string;
  value: string;
}

/**
 * Only directives that cannot break rendering. A policy for scripts, styles and connections
 * (`script-src`, `connect-src`, ...) needs nonces for the inline scripts of Next.js and is
 * tracked in doc/TechnicalDebt.md.
 */
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'", // the game cannot be embedded in other websites (clickjacking)
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const HSTS_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function buildSecurityHeaders(isProduction: boolean): HttpHeader[] {
  const headers: HttpHeader[] = [
    { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
    // For browsers without frame-ancestors support
    { key: 'X-Frame-Options', value: 'DENY' },
    // Responses are used as the declared Content-Type only (no MIME sniffing)
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Other websites learn the origin, not the page (e.g. /reset-password?token=...)
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ];
  if (isProduction) {
    // Browsers that visited once use HTTPS only. Without includeSubDomains: preview deployments
    // and other services on subdomains decide for themselves.
    headers.push({ key: 'Strict-Transport-Security', value: `max-age=${HSTS_MAX_AGE_SECONDS}` });
  }
  return headers;
}
