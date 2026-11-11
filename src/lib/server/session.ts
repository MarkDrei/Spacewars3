import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
}

/** Used outside production only, so that development and tests work without configuration. */
const DEVELOPMENT_SESSION_SECRET = 'your-secret-key-must-be-at-least-32-characters-long';

/** Placeholders from `.env.example`, `docker-compose.yml` and the docs: publicly known, never valid. */
const PLACEHOLDER_SESSION_SECRETS = new Set([
  DEVELOPMENT_SESSION_SECRET,
  'CHANGE_ME_IN_PRODUCTION_NEVER_USE_THIS_DEFAULT',
  'change-this-to-a-strong-random-secret-in-production',
]);

const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Returns the secret that seals the session cookie.
 *
 * The cookie is the only proof of identity: whoever knows the secret can create a session for any
 * user id. In production a missing, short or placeholder `SESSION_SECRET` is therefore an error
 * instead of a silent fallback to a secret that is published in this repository.
 */
export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET;
  if (env.NODE_ENV !== 'production') {
    return secret || DEVELOPMENT_SESSION_SECRET;
  }
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH || PLACEHOLDER_SESSION_SECRETS.has(secret)) {
    throw new Error(
      `SESSION_SECRET must be set to a private random value of at least ${MIN_SESSION_SECRET_LENGTH} characters in production`
    );
  }
  return secret;
}

export const sessionOptions: SessionOptions = {
  // Getter: resolved per request, so `next build` (which loads this module without runtime
  // configuration) works, and a misconfigured production server fails every session access.
  get password(): string {
    return getSessionSecret();
  },
  cookieName: 'spacewars-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    // 'lax': the cookie is not sent with cross-site POST/fetch requests. API routes parse the body
    // as JSON regardless of its Content-Type, so with 'none' any website could trigger game
    // actions (attack, sell, admin calls) in the name of a logged-in visitor (CSRF).
    sameSite: 'lax',
  },
};

export { getIronSession } from 'iron-session';
