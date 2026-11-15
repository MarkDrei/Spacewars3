import { createHash, randomBytes } from 'crypto';

/**
 * Tokens for links sent by email (password reset, email verification).
 *
 * The token itself exists only in the email. The database stores its SHA-256 hash, so database
 * content (a backup, a dump, an SQL injection) cannot be used to reset passwords. A fast hash is
 * sufficient: the token has 256 bits of entropy and cannot be guessed, unlike a password.
 */

/** Creates a new random token (64 hex characters). */
export function createLinkToken(): string {
  return randomBytes(32).toString('hex');
}

/** Hash under which a token is stored and looked up. */
export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
